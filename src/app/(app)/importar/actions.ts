"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { chaveDuplicado, decodificar, lerCsv, lerOfx, MAX_BYTES, normalizarSinalCartao, type LinhaImportada } from "@/lib/importacao";
import { ehUuid, texto } from "@/lib/seguranca";
import { requireUser } from "@/lib/supabase/server";
import type { EstadoForm } from "@/lib/tipos";

/**
 * Recebe um OFX/CSV, valida tamanho e formato, e põe as linhas na caixa de entrada (revisão obrigatória).
 * O arquivo nunca é salvo: só o texto é lido em memória e descartado.
 */
export async function importarArquivo(_: EstadoForm, fd: FormData): Promise<EstadoForm> {
  const { supabase } = await requireUser();
  const [destTipo, destId] = texto(fd, "destino", 80).split(":");
  if (!ehUuid(destId) || (destTipo !== "conta" && destTipo !== "cartao")) return { erro: "Escolha a conta ou o cartão do extrato." };

  // O destino precisa ser do usuário (RLS devolve vazio se não for).
  const tabela = destTipo === "conta" ? "contas" : "cartoes";
  const { data: destino } = await supabase.from(tabela).select("id").eq("id", destId).maybeSingle();
  if (!destino) return { erro: "Conta ou cartão não encontrado." };

  const arquivo = fd.get("arquivo");
  if (!(arquivo instanceof File) || arquivo.size === 0) return { erro: "Escolha o arquivo do extrato." };
  if (arquivo.size > MAX_BYTES) return { erro: "Arquivo grande demais (máximo 2 MB). Exporte um período menor." };
  const ext = arquivo.name.toLowerCase().match(/\.(ofx|qfx|csv|txt)$/)?.[1];
  if (!ext) return { erro: "Formato não aceito. Use .ofx ou .csv exportado pelo banco." };

  const bytes = new Uint8Array(await arquivo.arrayBuffer());
  if (bytes.slice(0, 4).every((b, i) => b === [0x50, 0x4b, 0x03, 0x04][i]) || bytes.includes(0)) {
    return { erro: "Esse arquivo não é texto (parece uma planilha .xlsx). Exporte em CSV ou OFX." };
  }
  const conteudo = decodificar(bytes);
  const ehOfx = ext === "ofx" || ext === "qfx" || /<OFX>/i.test(conteudo.slice(0, 4000));

  let linhas: LinhaImportada[];
  if (ehOfx) {
    const r = lerOfx(conteudo);
    linhas = r.linhas;
  } else {
    const r = lerCsv(conteudo);
    if (r.erro) return { erro: r.erro };
    linhas = destTipo === "cartao" ? normalizarSinalCartao(r.linhas) : r.linhas;
  }
  if (linhas.length === 0) return { erro: "Não encontrei movimentações nesse arquivo." };

  // No cartão só entram compras (negativas). Créditos são pagamento de fatura ou estorno: ficam de fora.
  const creditosCartao = destTipo === "cartao" ? linhas.filter((l) => l.valorCentavos > 0).length : 0;
  if (destTipo === "cartao") linhas = linhas.filter((l) => l.valorCentavos < 0);

  const repeticoes = new Map<string, number>();
  const registros = linhas.map((l) => {
    const base = `${l.data}|${l.valorCentavos}|${l.descricao}`;
    const n = repeticoes.get(base) ?? 0;
    repeticoes.set(base, n + 1);
    return {
      origem: "arquivo" as const,
      conta_id: destTipo === "conta" ? destId : null,
      cartao_id: destTipo === "cartao" ? destId : null,
      pluggy_transaction_id: chaveDuplicado(destId, l, n),
      data: l.data,
      descricao: l.descricao || "Sem descrição",
      valor_centavos: l.valorCentavos,
    };
  });

  // Duplicados (mesmo arquivo importado de novo) são ignorados pela chave única.
  const { data: inseridas, error } = await supabase
    .from("transacoes_importadas")
    .upsert(registros, { onConflict: "user_id,pluggy_transaction_id", ignoreDuplicates: true })
    .select("id");
  if (error) return { erro: "Não foi possível ler esse extrato. Confira se é o arquivo exportado pelo banco." };

  const novas = inseridas?.length ?? 0;
  revalidatePath("/", "layout");
  redirect(`/revisar?ok=arquivo&n=${novas}&d=${registros.length - novas}${creditosCartao ? `&c=${creditosCartao}` : ""}`);
}
