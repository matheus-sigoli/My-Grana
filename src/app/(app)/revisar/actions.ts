"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { chaveRecebedor } from "@/lib/fatura-importada";
import { datasEntre, type Recorrencia } from "@/lib/recorrencias";
import { ehUuid } from "@/lib/seguranca";
import { requireUser } from "@/lib/supabase/server";

/**
 * Processa as transações marcadas na caixa de entrada.
 * - importar: cria o lançamento com a categoria escolhida (ou confirma a ocorrência prevista indicada),
 *   ou registra o pagamento de fatura ("fat:<cartão>|<fatura>") — ADR-0012;
 * - aprende a regra do recebedor (categoria e/ou conta fixa) a cada importação com recebedor;
 * - ignorar: marca como ignorada (ex.: transferência entre suas contas que já foi lançada).
 */
export async function processarCaixa(fd: FormData) {
  const { supabase } = await requireUser();
  const acao = fd.get("acao") === "ignorar" ? "ignorar" : "importar";
  const ids = fd.getAll("sel").map(String).filter(ehUuid).slice(0, 200);
  if (ids.length === 0) redirect("/revisar?erro=nada");

  if (acao === "ignorar") {
    await supabase.from("transacoes_importadas").update({ situacao: "ignorada" }).in("id", ids).eq("situacao", "pendente");
    revalidatePath("/", "layout");
    redirect(`/revisar?ok=ignoradas&n=${ids.length}`);
  }

  const { data: txs } = await supabase
    .from("transacoes_importadas")
    .select("id,data,descricao,valor_centavos,situacao,conta_id,cartao_id,recebedor,contas_externas(conta_id)")
    .in("id", ids)
    .eq("situacao", "pendente");
  const { data: cats } = await supabase.from("categorias").select("id,tipo");
  const tipoCat = new Map((cats ?? []).map((c) => [c.id as string, c.tipo as string]));
  const { data: regrasAtuais } = await supabase.from("regras_recebedor").select("chave,tipo,usos");
  const usos = new Map((regrasAtuais ?? []).map((r) => [`${r.tipo}|${r.chave}`, Number(r.usos)]));

  let feitas = 0;
  let faturas = 0;
  let puladas = 0;
  for (const t of txs ?? []) {
    const cartaoId = (t.cartao_id as string | null) ?? null;
    const contaId = cartaoId ? null : ((t.conta_id as string | null) ?? (t.contas_externas as unknown as { conta_id: string | null } | null)?.conta_id ?? null);
    const valor = Number(t.valor_centavos);
    const tipo = valor > 0 ? "receita" : "despesa";
    if (!contaId && !cartaoId) { puladas++; continue; }
    if (cartaoId && tipo !== "despesa") { puladas++; continue; }

    // Pagamento de fatura: só saída de conta; as FKs garantem que cartão e conta são do usuário.
    const destino = String(fd.get(`cat_${t.id}`) ?? "");
    if (destino.startsWith("fat:")) {
      const [cartao, fatura] = destino.slice(4).split("|");
      if (!contaId || valor >= 0 || !ehUuid(cartao) || !/^\d{4}-\d{2}-01$/.test(fatura ?? "")) { puladas++; continue; }
      const { error } = await supabase.from("pagamentos_fatura").insert({
        cartao_id: cartao, fatura, conta_id: contaId, data: t.data, valor_centavos: Math.abs(valor),
      });
      if (error) { puladas++; continue; }
      await supabase.from("transacoes_importadas").update({ situacao: "importada" }).eq("id", t.id);
      faturas++;
      continue;
    }

    // Confirmar ocorrência prevista? (valor "recorrenciaId|AAAA-MM-DD")
    const prev = String(fd.get(`prev_${t.id}`) ?? "");
    const [recId, dataOc] = prev.split("|");
    let recorrencia: Recorrencia | null = null;
    if (contaId && ehUuid(recId) && /^\d{4}-\d{2}-\d{2}$/.test(dataOc ?? "")) {
      const { data: r } = await supabase.from("recorrencias").select("*").eq("id", recId).maybeSingle();
      if (r && (r.tipo === tipo) && datasEntre(r as Recorrencia, dataOc, dataOc).length === 1) recorrencia = r as Recorrencia;
    }

    const categoria = recorrencia?.categoria_id ?? String(fd.get(`cat_${t.id}`) ?? "");
    if (!ehUuid(categoria) || tipoCat.get(categoria) !== tipo) { puladas++; continue; }

    const { data: lanc, error } = await supabase
      .from("lancamentos")
      .insert({
        tipo,
        descricao: (recorrencia?.descricao ?? (t.recebedor ? `${t.descricao} · ${t.recebedor}` : t.descricao)).slice(0, 120),
        valor_centavos: Math.abs(valor),
        data: t.data,
        conta_id: contaId,
        cartao_id: cartaoId,
        categoria_id: categoria,
      })
      .select("id")
      .single();
    if (error || !lanc) { puladas++; continue; }

    if (recorrencia) {
      const { error: e2 } = await supabase.from("ocorrencias_tratadas").insert({
        recorrencia_id: recorrencia.id, data_ocorrencia: dataOc, situacao: "confirmada", lancamento_id: lanc.id,
      });
      if (e2) { /* ocorrência já tratada por outro caminho: mantém só o lançamento */ }
    }
    await supabase.from("transacoes_importadas").update({ situacao: "importada", lancamento_id: lanc.id }).eq("id", t.id);
    feitas++;

    // Aprende: este recebedor = esta categoria (e esta conta fixa, se confirmou uma). Vale a última escolha.
    const chave = t.recebedor ? chaveRecebedor(t.recebedor as string) : "";
    if (chave) {
      const k = `${tipo}|${chave}`;
      const n = (usos.get(k) ?? 0) + 1;
      usos.set(k, n);
      await supabase.from("regras_recebedor").upsert({
        chave, nome: String(t.recebedor).slice(0, 120), tipo, categoria_id: categoria,
        recorrencia_id: recorrencia?.id ?? null, usos: n, updated_at: new Date().toISOString(),
      }, { onConflict: "user_id,chave,tipo" });
    }
  }
  revalidatePath("/", "layout");
  redirect(`/revisar?ok=importadas&n=${feitas}${faturas ? `&f=${faturas}` : ""}${puladas ? `&p=${puladas}` : ""}`);
}
