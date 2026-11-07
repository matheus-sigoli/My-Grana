"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { hojeISO } from "@/lib/datas";
import {
  ErroPluggy, atualizarItem, buscarItem, criarConnectToken, excluirItemPluggy, listarContas, listarTransacoes, pluggyConfigurado, valorComSinal,
} from "@/lib/openfinance/pluggy";
import { ehUuid, texto } from "@/lib/seguranca";
import { requireUser } from "@/lib/supabase/server";

const ITEM = /^[0-9A-Za-z-]{1,64}$/;
const mensagem = (e: unknown) =>
  e instanceof ErroPluggy && e.status === 0 ? "A conexão com bancos ainda não está disponível." : "Não foi possível falar com a Pluggy agora. Tente de novo em instantes.";

/** Token para abrir o widget (vale 30 min). */
export async function pedirTokenConexao(itemIdParaAtualizar?: string): Promise<{ token?: string; erro?: string }> {
  const { user } = await requireUser();
  if (!pluggyConfigurado()) return { erro: "A conexão com bancos ainda não está disponível." };
  if (itemIdParaAtualizar && !ITEM.test(itemIdParaAtualizar)) return { erro: "Conexão inválida." };
  try {
    return { token: await criarConnectToken(user.id, itemIdParaAtualizar) };
  } catch (e) {
    return { erro: mensagem(e) };
  }
}

/** Depois do widget: confere na Pluggy que o item é deste usuário e salva a conexão. */
export async function salvarConexao(itemId: string): Promise<{ erro?: string }> {
  const { supabase, user } = await requireUser();
  if (typeof itemId !== "string" || !ITEM.test(itemId)) return { erro: "Conexão inválida." };
  try {
    const item = await buscarItem(itemId);
    if (item.clientUserId !== user.id) return { erro: "Essa conexão não pertence à sua conta." };
    const { data: existente } = await supabase.from("conexoes_bancarias").select("id").eq("pluggy_item_id", itemId).maybeSingle();
    let conexaoId = existente?.id as string | undefined;
    if (!conexaoId) {
      const { data, error } = await supabase
        .from("conexoes_bancarias")
        .insert({ pluggy_item_id: itemId, instituicao: (item.connector?.name ?? "Banco").slice(0, 120), status: item.status?.slice(0, 40) ?? null })
        .select("id")
        .single();
      if (error) return { erro: "Não foi possível salvar a conexão." };
      conexaoId = data.id;
    }
    await sincronizarConexao(conexaoId!);
    revalidatePath("/", "layout");
    return {};
  } catch (e) {
    return { erro: mensagem(e) };
  }
}

/** Busca contas e transações novas. Transações vão para a caixa de entrada (nunca direto para lançamentos). */
async function sincronizarConexao(conexaoId: string) {
  const { supabase, user } = await requireUser();
  const { data: conexao } = await supabase.from("conexoes_bancarias").select("*").eq("id", conexaoId).maybeSingle();
  if (!conexao) throw new ErroPluggy(404, "Conexão não encontrada");

  const item = await buscarItem(conexao.pluggy_item_id);
  if (item.clientUserId !== user.id) throw new ErroPluggy(403, "Conexão de outro usuário");
  await supabase.from("conexoes_bancarias").update({
    status: item.status?.slice(0, 40) ?? null,
    erro: item.error?.message?.slice(0, 300) ?? null,
    instituicao: (item.connector?.name ?? conexao.instituicao).slice(0, 120),
  }).eq("id", conexaoId);

  const contas = await listarContas(conexao.pluggy_item_id);
  const trintaDias = new Date(Date.parse(hojeISO()) - 30 * 86_400_000).toISOString().slice(0, 10);
  for (const c of contas) {
    if (!ITEM.test(c.id)) continue;
    const dados = {
      conexao_id: conexaoId,
      pluggy_account_id: c.id,
      nome: (c.marketingName || c.name || "Conta").slice(0, 120),
      tipo: c.type?.slice(0, 40) ?? null,
      numero: c.number?.slice(0, 40) ?? null,
      saldo_centavos: typeof c.balance === "number" ? Math.round(c.balance * 100) : null,
    };
    const { data: ja } = await supabase.from("contas_externas").select("id").eq("pluggy_account_id", c.id).maybeSingle();
    if (ja) await supabase.from("contas_externas").update(dados).eq("id", ja.id);
    else await supabase.from("contas_externas").insert({ ...dados, importar_desde: trintaDias });
  }

  // Só contas de banco vinculadas a uma Conta do MyGrana trazem transações (cartão chega com o M2).
  const { data: vinculadas } = await supabase
    .from("contas_externas")
    .select("id,pluggy_account_id,importar_desde,tipo")
    .eq("conexao_id", conexaoId)
    .not("conta_id", "is", null);
  for (const ce of vinculadas ?? []) {
    if (ce.tipo && ce.tipo !== "BANK") continue;
    const txs = await listarTransacoes(ce.pluggy_account_id, ce.importar_desde);
    const linhas = txs
      .filter((t) => ITEM.test(t.id) && /^\d{4}-\d{2}-\d{2}/.test(t.date) && valorComSinal(t) !== 0)
      .map((t) => ({
        user_id: user.id,
        conta_externa_id: ce.id,
        pluggy_transaction_id: t.id,
        data: t.date.slice(0, 10),
        descricao: (t.description || "Sem descrição").slice(0, 200),
        valor_centavos: valorComSinal(t),
        categoria_externa: t.category?.slice(0, 80) ?? null,
      }));
    for (let i = 0; i < linhas.length; i += 500) {
      await supabase.from("transacoes_importadas").upsert(linhas.slice(i, i + 500), { onConflict: "user_id,pluggy_transaction_id", ignoreDuplicates: true });
    }
  }
  await supabase.from("conexoes_bancarias").update({ ultima_sincronizacao: new Date().toISOString() }).eq("id", conexaoId);
}

export async function sincronizar(fd: FormData) {
  const id = texto(fd, "id", 64);
  if (!ehUuid(id)) redirect("/conexoes");
  let erro = "";
  try {
    const { supabase } = await requireUser();
    const { data } = await supabase.from("conexoes_bancarias").select("pluggy_item_id").eq("id", id).maybeSingle();
    if (data) await atualizarItem(data.pluggy_item_id).catch(() => undefined); // pede ao banco dados frescos
    await sincronizarConexao(id);
  } catch (e) {
    erro = mensagem(e);
  }
  revalidatePath("/", "layout");
  redirect(erro ? `/conexoes?erro=sync` : "/conexoes?ok=sync");
}

/** Sincroniza em silêncio as conexões com mais de 6 h (chamado ao abrir a caixa de entrada). */
export async function sincronizarAntigas() {
  const { supabase } = await requireUser();
  if (!pluggyConfigurado()) return;
  const limite = new Date(Date.now() - 6 * 3600_000).toISOString();
  const { data } = await supabase.from("conexoes_bancarias").select("id,ultima_sincronizacao");
  for (const c of data ?? []) {
    if (c.ultima_sincronizacao && c.ultima_sincronizacao > limite) continue;
    await sincronizarConexao(c.id).catch(() => undefined);
  }
}

export async function vincularConta(fd: FormData) {
  const { supabase } = await requireUser();
  const id = texto(fd, "id", 64);
  const contaId = texto(fd, "conta_id", 64);
  const desde = texto(fd, "importar_desde", 10);
  if (!ehUuid(id) || (contaId && !ehUuid(contaId))) redirect("/conexoes");
  const dados: Record<string, unknown> = { conta_id: contaId || null };
  if (/^\d{4}-\d{2}-\d{2}$/.test(desde) && desde >= "2000-01-01" && desde <= hojeISO()) dados.importar_desde = desde;
  await supabase.from("contas_externas").update(dados).eq("id", id);
  revalidatePath("/conexoes");
  redirect("/conexoes?ok=vinculo");
}

export async function removerConexao(fd: FormData) {
  const { supabase } = await requireUser();
  const id = texto(fd, "id", 64);
  if (!ehUuid(id)) redirect("/conexoes");
  const { data } = await supabase.from("conexoes_bancarias").select("pluggy_item_id").eq("id", id).maybeSingle();
  if (data) await excluirItemPluggy(data.pluggy_item_id).catch(() => undefined); // revoga o acesso na Pluggy
  await supabase.from("conexoes_bancarias").delete().eq("id", id);
  revalidatePath("/", "layout");
  redirect("/conexoes?ok=removida");
}
