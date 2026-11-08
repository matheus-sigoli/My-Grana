"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { hojeISO } from "@/lib/datas";
import { chaveDuplicado, decodificar, lerCsv, lerOfx, lerTabelaExtrato, lerTextoExtrato, MAX_BYTES, MAX_BYTES_PDF, normalizarSinalCartao, type LinhaImportada } from "@/lib/importacao";
import { linhasDoPdf, PdfComSenha, PdfSemTexto } from "@/lib/pdf";
import { ehUuid, texto } from "@/lib/seguranca";
import { requireUser } from "@/lib/supabase/server";
import type { EstadoForm } from "@/lib/tipos";

/**
 * Recebe um PDF, OFX ou CSV, valida tamanho e formato (assinatura do arquivo), e põe as linhas na caixa de entrada (revisão obrigatória).
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
  const ext = arquivo.name.toLowerCase().match(/\.(pdf|ofx|qfx|csv|txt)$/)?.[1];
  if (!ext) return { erro: "Formato não aceito. Use o extrato em PDF, OFX ou CSV baixado do banco." };
  if (arquivo.size > (ext === "pdf" ? MAX_BYTES_PDF : MAX_BYTES)) {
    return { erro: `Arquivo grande demais (máximo ${ext === "pdf" ? 5 : 2} MB). Exporte um período menor.` };
  }

  const bytes = new Uint8Array(await arquivo.arrayBuffer());
  const ehPdf = bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46; // "%PDF"
  if (ext === "pdf" && !ehPdf) return { erro: "Esse arquivo não é um PDF válido." };

  const lido = ehPdf ? await lerPdf(bytes, destTipo === "cartao") : lerTexto(bytes, ext, destTipo === "cartao");
  if ("erro" in lido) return { erro: lido.erro };
  let linhas = lido.linhas;
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
      recebedor: l.recebedor ?? null,
    };
  });

  // Linhas já importadas (mesma chave): não duplica; só completa o recebedor que faltava (ADR-0012).
  type Existente = { id: string; pluggy_transaction_id: string; recebedor: string | null; descricao: string; lancamento_id: string | null };
  const existentes = new Map<string, Existente>();
  for (let i = 0; i < registros.length; i += 150) {
    const chaves = registros.slice(i, i + 150).map((r) => r.pluggy_transaction_id);
    const { data } = await supabase.from("transacoes_importadas").select("id,pluggy_transaction_id,recebedor,descricao,lancamento_id").in("pluggy_transaction_id", chaves);
    for (const e of (data ?? []) as Existente[]) existentes.set(e.pluggy_transaction_id, e);
  }
  const novos = registros.filter((r) => !existentes.has(r.pluggy_transaction_id));
  for (let i = 0; i < novos.length; i += 500) {
    const { error } = await supabase.from("transacoes_importadas")
      .upsert(novos.slice(i, i + 500), { onConflict: "user_id,pluggy_transaction_id", ignoreDuplicates: true });
    if (error) return { erro: "Não foi possível ler esse extrato. Confira se é o arquivo exportado pelo banco." };
  }
  const completar = registros
    .map((r) => ({ r, e: existentes.get(r.pluggy_transaction_id) }))
    .filter((x): x is { r: (typeof registros)[number]; e: Existente } => !!x.e && !x.e.recebedor && !!x.r.recebedor);
  for (let i = 0; i < completar.length; i += 20) {
    await Promise.all(completar.slice(i, i + 20).map(async ({ r, e }) => {
      await supabase.from("transacoes_importadas").update({ recebedor: r.recebedor }).eq("id", e.id);
      // O lançamento que veio dessa linha ganha o nome, se a descrição dele ainda é a do banco.
      if (e.lancamento_id) {
        await supabase.from("lancamentos").update({ descricao: `${e.descricao} · ${r.recebedor}`.slice(0, 120) })
          .eq("id", e.lancamento_id).eq("descricao", e.descricao);
      }
    }));
  }
  const nomes = completar.length;

  const novas = novos.length;
  revalidatePath("/", "layout");
  redirect(`/revisar?ok=arquivo&n=${novas}&d=${registros.length - novas}${creditosCartao ? `&c=${creditosCartao}` : ""}${nomes ? `&r=${nomes}` : ""}`);
}

type Lido = { linhas: LinhaImportada[] } | { erro: string };

async function lerPdf(bytes: Uint8Array, cartao: boolean): Promise<Lido> {
  try {
    const { linhas, paginas } = await linhasDoPdf(bytes);
    // Extrato com colunas Crédito/Débito: a coluna decide entrada ou saída (e o saldo confere). Senão, leitura por texto.
    const tabela = cartao ? null : lerTabelaExtrato(paginas, { hoje: hojeISO() });
    return tabela ?? lerTextoExtrato(linhas, { hoje: hojeISO(), cartao });
  } catch (e) {
    if (e instanceof PdfComSenha) return { erro: "Esse PDF tem senha. Abra no celular ou computador, use Imprimir → Salvar como PDF para gerar uma cópia sem senha e envie de novo." };
    if (e instanceof PdfSemTexto) return { erro: "Esse PDF é uma imagem (foto ou escaneado) e não dá para ler o texto. Baixe o extrato digital no app do banco." };
    return { erro: "Não consegui ler esse PDF. Tente baixar o extrato de novo ou use OFX/CSV." };
  }
}

function lerTexto(bytes: Uint8Array, ext: string, cartao: boolean): Lido {
  if (bytes.slice(0, 4).every((b, i) => b === [0x50, 0x4b, 0x03, 0x04][i]) || bytes.includes(0)) {
    return { erro: "Esse arquivo não é texto (parece uma planilha .xlsx). Use o extrato em PDF, OFX ou CSV." };
  }
  const conteudo = decodificar(bytes);
  if (ext === "ofx" || ext === "qfx" || /<OFX>/i.test(conteudo.slice(0, 4000))) return { linhas: lerOfx(conteudo).linhas };
  const r = lerCsv(conteudo);
  if (r.erro) return { erro: r.erro };
  return { linhas: cartao ? normalizarSinalCartao(r.linhas) : r.linhas };
}
