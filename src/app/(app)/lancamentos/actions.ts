"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { dividirParcelas } from "@/lib/cartoes";
import { paraCentavos } from "@/lib/dinheiro";
import { dataIsoValida, ehUuid, idOpcional, texto } from "@/lib/seguranca";
import { requireUser } from "@/lib/supabase/server";
import { mensagemErro, type EstadoForm, type TipoLancamento } from "@/lib/tipos";

const TIPOS: TipoLancamento[] = ["receita", "despesa", "transferencia"];
const MAX_CENTAVOS = 100_000_000_000; // R$ 1 bilhão: acima disso é erro de digitação
const MAX_PARCELAS = 24;

export async function salvarLancamento(_: EstadoForm, fd: FormData): Promise<EstadoForm> {
  const { supabase } = await requireUser();

  const id = idOpcional(fd, "id");
  const tipo = texto(fd, "tipo", 20) as TipoLancamento;
  const descricaoBruta = texto(fd, "descricao", 120);
  const valor = paraCentavos(texto(fd, "valor", 24));
  const data = texto(fd, "data", 10);
  const conta_destino_id = idOpcional(fd, "conta_destino_id");
  const categoria_id = idOpcional(fd, "categoria_id");
  const observacao = texto(fd, "observacao", 500) || null;
  const continuar = fd.get("continuar") === "1";

  // Despesa escolhe "conta:<id>" ou "cartao:<id>"; receita e transferência usam conta_id.
  let conta_id: string | null | false = null;
  let cartao_id: string | null = null;
  if (tipo === "despesa") {
    const [origemTipo, origemId] = texto(fd, "origem", 80).split(":");
    if (!ehUuid(origemId) || (origemTipo !== "conta" && origemTipo !== "cartao")) return { erro: "Escolha de onde saiu o dinheiro." };
    if (origemTipo === "conta") conta_id = origemId;
    else cartao_id = origemId;
  } else {
    conta_id = idOpcional(fd, "conta_id");
  }
  const parcelas = cartao_id ? Math.trunc(Number(texto(fd, "parcelas", 3) || "1")) : 1;

  if (id === false || conta_id === false || conta_destino_id === false || categoria_id === false) {
    return { erro: "Dados inválidos. Recarregue a página e tente de novo." };
  }
  if (!TIPOS.includes(tipo)) return { erro: "Escolha o tipo do lançamento." };
  if (valor === null || valor <= 0) return { erro: "Informe um valor maior que zero, como 49,90." };
  if (valor > MAX_CENTAVOS) return { erro: "Valor alto demais. Confira se não sobrou um zero." };
  if (!Number.isInteger(parcelas) || parcelas < 1 || parcelas > MAX_PARCELAS) return { erro: `Parcelas entre 1 e ${MAX_PARCELAS}.` };
  if (parcelas > 1 && valor < parcelas) return { erro: "Valor pequeno demais para tantas parcelas." };
  if (!dataIsoValida(data)) {
    return { erro: "Data inválida." };
  }
  if (!conta_id && !cartao_id) return { erro: tipo === "transferencia" ? "Escolha a conta de origem." : "Escolha a conta." };

  const transf = tipo === "transferencia";
  if (transf && !conta_destino_id) return { erro: "Escolha a conta de destino." };
  if (transf && conta_destino_id === conta_id) return { erro: "Origem e destino precisam ser contas diferentes." };
  if (!transf && !categoria_id) return { erro: "Escolha uma categoria." };

  const descricao = descricaoBruta || (transf ? "Transferência" : "");
  if (!descricao) return { erro: "Escreva uma descrição." };

  // Lista explícita de campos (nada de repassar o form inteiro). user_id vem do banco (auth.uid()).
  const base = {
    tipo,
    descricao,
    data,
    conta_id,
    cartao_id,
    conta_destino_id: transf ? conta_destino_id : null,
    categoria_id: transf ? null : categoria_id,
    observacao,
  };

  // Compra parcelada (nova ou editada): recria o grupo inteiro; competência é calculada no banco.
  let anterior: { grupo_parcelas: string | null } | null = null;
  if (id) {
    const { data: atual } = await supabase.from("lancamentos").select("grupo_parcelas").eq("id", id).maybeSingle();
    if (!atual) return { erro: "Lançamento não encontrado." };
    anterior = atual;
  }

  if (parcelas > 1 || anterior?.grupo_parcelas) {
    const grupo = parcelas > 1 ? crypto.randomUUID() : null;
    const linhas = dividirParcelas(valor, parcelas).map((v, i) => ({
      ...base,
      valor_centavos: v,
      grupo_parcelas: grupo,
      parcela: grupo ? i + 1 : null,
      total_parcelas: grupo ? parcelas : null,
    }));
    const { error } = await supabase.from("lancamentos").insert(linhas);
    if (error) return { erro: mensagemErro(error) };
    if (id) {
      const apagar = anterior?.grupo_parcelas
        ? supabase.from("lancamentos").delete().eq("grupo_parcelas", anterior.grupo_parcelas)
        : supabase.from("lancamentos").delete().eq("id", id);
      await apagar;
    }
  } else {
    const dados = { ...base, valor_centavos: valor, grupo_parcelas: null, parcela: null, total_parcelas: null };
    const { error } = id
      ? await supabase.from("lancamentos").update(dados).eq("id", id)
      : await supabase.from("lancamentos").insert(dados);
    if (error) return { erro: mensagemErro(error) };
  }

  revalidatePath("/", "layout");
  if (continuar && !id) redirect(`/lancamentos/novo?tipo=${tipo}&ok=1`);
  if (cartao_id) redirect(`/cartoes/${cartao_id}`);
  redirect(`/lancamentos?mes=${data.slice(0, 7)}`);
}

export async function excluirLancamento(fd: FormData) {
  const { supabase } = await requireUser();
  const id = String(fd.get("id") ?? "");
  const mes = String(fd.get("mes") ?? "");
  if (ehUuid(id)) {
    // Parcela: apaga a compra inteira (todas as parcelas).
    const { data: l } = await supabase.from("lancamentos").select("grupo_parcelas").eq("id", id).maybeSingle();
    if (l?.grupo_parcelas) await supabase.from("lancamentos").delete().eq("grupo_parcelas", l.grupo_parcelas);
    else await supabase.from("lancamentos").delete().eq("id", id);
  }
  revalidatePath("/", "layout");
  redirect(/^\d{4}-\d{2}$/.test(mes) ? `/lancamentos?mes=${mes}` : "/lancamentos");
}
