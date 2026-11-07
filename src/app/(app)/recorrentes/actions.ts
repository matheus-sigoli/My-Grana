"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { paraCentavos, paraNumero } from "@/lib/dinheiro";
import { datasEntre, diaAnterior, type Frequencia, type Recorrencia, type TipoRecorrencia } from "@/lib/recorrencias";
import { dataIsoValida, ehUuid, idOpcional, texto } from "@/lib/seguranca";
import { hojeISO } from "@/lib/datas";
import { requireUser } from "@/lib/supabase/server";
import { mensagemErro, type EstadoForm } from "@/lib/tipos";

const TIPOS: TipoRecorrencia[] = ["despesa", "receita", "transferencia", "aporte"];
const FREQS: Frequencia[] = ["mensal", "semanal", "anual"];
const LIMITE = 100_000_000_000;
const dataValida = dataIsoValida;

function lerRegra(fd: FormData) {
  const tipo = texto(fd, "tipo", 20) as TipoRecorrencia;
  const descricao = texto(fd, "descricao", 120);
  const valor = paraCentavos(texto(fd, "valor", 24));
  const frequencia = (texto(fd, "frequencia", 10) || "mensal") as Frequencia;
  const data_inicio = texto(fd, "data_inicio", 10);
  const data_fim = texto(fd, "data_fim", 10) || null;
  let conta_id = idOpcional(fd, "conta_id");
  let cartao_id: string | null = null;
  if (tipo === "despesa") {
    const [o, oid] = texto(fd, "origem", 80).split(":");
    if (!ehUuid(oid) || (o !== "conta" && o !== "cartao")) return { erro: "Escolha de onde sai." };
    conta_id = o === "conta" ? oid : null;
    cartao_id = o === "cartao" ? oid : null;
  }
  const conta_destino_id = idOpcional(fd, "conta_destino_id");
  const categoria_id = idOpcional(fd, "categoria_id");
  const ativo_id = idOpcional(fd, "ativo_id");

  if (!TIPOS.includes(tipo)) return { erro: "Escolha o tipo." };
  if (!FREQS.includes(frequencia)) return { erro: "Frequência inválida." };
  if (conta_id === false || conta_destino_id === false || categoria_id === false || ativo_id === false) return { erro: "Dados inválidos. Recarregue a página." };
  if (!descricao) return { erro: "Dê um nome, como “Aluguel” ou “VGBL mensal”." };
  if (valor === null || valor <= 0 || valor > LIMITE) return { erro: "Informe o valor (ex.: 1.500,00)." };
  if (!dataValida(data_inicio)) return { erro: "Informe a data da primeira vez." };
  if (data_fim && (!dataValida(data_fim) || data_fim < data_inicio)) return { erro: "A data final precisa ser depois da primeira." };
  if (!conta_id && !cartao_id) return { erro: tipo === "receita" ? "Escolha a conta onde entra." : "Escolha a conta de onde sai." };
  if ((tipo === "despesa" || tipo === "receita") && !categoria_id) return { erro: "Escolha uma categoria." };
  if (tipo === "transferencia" && (!conta_destino_id || conta_destino_id === conta_id)) return { erro: "Escolha uma conta de destino diferente." };
  if (tipo === "aporte" && !ativo_id) return { erro: "Escolha o investimento." };

  return {
    dados: {
      tipo, descricao, valor_centavos: valor, frequencia, data_inicio, data_fim, conta_id, cartao_id,
      conta_destino_id: tipo === "transferencia" ? conta_destino_id : null,
      categoria_id: tipo === "despesa" || tipo === "receita" ? categoria_id : null,
      ativo_id: tipo === "aporte" ? ativo_id : null,
    },
  };
}

export async function salvarRecorrencia(_: EstadoForm, fd: FormData): Promise<EstadoForm> {
  const { supabase } = await requireUser();
  const r = lerRegra(fd);
  if ("erro" in r) return { erro: r.erro ?? "Confira os campos." };
  const id = idOpcional(fd, "id");
  if (id === false) return { erro: "Dados inválidos." };
  const aPartirDe = texto(fd, "a_partir_de", 10);

  if (id && dataValida(aPartirDe)) {
    // "Desta data em diante": encerra a regra antiga na véspera e cria uma nova.
    const { data: antiga } = await supabase.from("recorrencias").select("data_inicio").eq("id", id).maybeSingle();
    if (!antiga) return { erro: "Recorrência não encontrada." };
    if (aPartirDe <= antiga.data_inicio) {
      const { error } = await supabase.from("recorrencias").update(r.dados).eq("id", id);
      if (error) return { erro: mensagemErro(error) };
    } else {
      const { error: e1 } = await supabase.from("recorrencias").update({ data_fim: diaAnterior(aPartirDe) }).eq("id", id);
      if (e1) return { erro: mensagemErro(e1) };
      const { error: e2 } = await supabase.from("recorrencias").insert({ ...r.dados, data_inicio: aPartirDe });
      if (e2) return { erro: mensagemErro(e2) };
    }
  } else {
    const { error } = await supabase.from("recorrencias").insert(r.dados);
    if (error) return { erro: mensagemErro(error) };
  }
  revalidatePath("/", "layout");
  redirect("/recorrentes?ok=salva");
}

export async function encerrarRecorrencia(fd: FormData) {
  const { supabase } = await requireUser();
  const id = texto(fd, "id", 64);
  if (!ehUuid(id)) redirect("/recorrentes");
  await supabase.from("recorrencias").update({ ativa: false }).eq("id", id);
  revalidatePath("/", "layout");
  redirect("/recorrentes?ok=encerrada");
}

export async function excluirRecorrencia(fd: FormData) {
  const { supabase } = await requireUser();
  const id = texto(fd, "id", 64);
  if (!ehUuid(id)) redirect("/recorrentes");
  await supabase.from("recorrencias").delete().eq("id", id);
  revalidatePath("/", "layout");
  redirect("/recorrentes?ok=excluida");
}

/** Confere que a data é mesmo uma ocorrência da regra (evita confirmar datas inventadas). */
async function regraEOcorrencia(fd: FormData) {
  const { supabase } = await requireUser();
  const recId = texto(fd, "recorrencia_id", 64);
  const dataOc = texto(fd, "data_ocorrencia", 10);
  if (!ehUuid(recId) || !dataValida(dataOc)) return { supabase, erro: "Ocorrência inválida." } as const;
  const { data } = await supabase.from("recorrencias").select("*").eq("id", recId).maybeSingle();
  const r = data as Recorrencia | null;
  if (!r || datasEntre({ ...r, valor_centavos: Number(r.valor_centavos) }, dataOc, dataOc).length !== 1) return { supabase, erro: "Ocorrência não encontrada." } as const;
  return { supabase, r, dataOc } as const;
}

export async function confirmarOcorrencia(_: EstadoForm, fd: FormData): Promise<EstadoForm> {
  const ctx = await regraEOcorrencia(fd);
  if ("erro" in ctx) return { erro: ctx.erro ?? "Ocorrência inválida." };
  const { supabase, r, dataOc } = ctx;
  const valor = paraCentavos(texto(fd, "valor", 24));
  const data = texto(fd, "data", 10);
  if (valor === null || valor <= 0 || valor > LIMITE) return { erro: "Informe o valor pago/recebido." };
  if (!dataValida(data)) return { erro: "Data inválida." };

  let lancamento_id: string | null = null;
  let operacao_id: string | null = null;

  if (r.tipo === "aporte") {
    const { data: ativo } = await supabase.from("ativos").select("classe").eq("id", r.ativo_id!).maybeSingle();
    if (!ativo) return { erro: "O investimento desta recorrência não existe mais." };
    const rv = ["acao", "fii", "etf", "bdr", "cripto"].includes(ativo.classe);
    let quantidade: number | null = null;
    let total = valor;
    if (rv) {
      quantidade = paraNumero(texto(fd, "quantidade", 30), 8);
      const preco = paraNumero(texto(fd, "preco", 30), 8);
      if (!quantidade || quantidade <= 0 || !preco || preco <= 0) return { erro: "Informe quantidade e preço da compra." };
      total = Math.round(quantidade * preco * 100);
    }
    const { data: op, error } = await supabase.from("operacoes_investimento").insert({
      ativo_id: r.ativo_id, conta_id: r.conta_id, tipo: rv ? "compra" : "aplicacao", data, quantidade, valor_centavos: total,
    }).select("id").single();
    if (error || !op) return { erro: mensagemErro(error) };
    operacao_id = op.id;
  } else {
    const { data: l, error } = await supabase.from("lancamentos").insert({
      tipo: r.tipo, descricao: r.descricao, valor_centavos: valor, data, conta_id: r.conta_id, cartao_id: r.cartao_id ?? null,
      conta_destino_id: r.conta_destino_id, categoria_id: r.categoria_id,
    }).select("id").single();
    if (error || !l) return { erro: mensagemErro(error) };
    lancamento_id = l.id;
  }

  const { error: e2 } = await supabase.from("ocorrencias_tratadas").insert({
    recorrencia_id: r.id, data_ocorrencia: dataOc, situacao: "confirmada", lancamento_id, operacao_id,
  });
  if (e2) {
    // Já confirmada em outra aba: desfaz o que acabou de criar.
    if (lancamento_id) await supabase.from("lancamentos").delete().eq("id", lancamento_id);
    if (operacao_id) await supabase.from("operacoes_investimento").delete().eq("id", operacao_id);
    return { erro: "Essa ocorrência já foi tratada." };
  }
  revalidatePath("/", "layout");
  redirect(String(fd.get("voltar") ?? "") === "painel" ? "/?ok=confirmada" : "/recorrentes?ok=confirmada");
}

export async function pularOcorrencia(fd: FormData) {
  const ctx = await regraEOcorrencia(fd);
  if ("erro" in ctx) redirect("/recorrentes");
  await ctx.supabase.from("ocorrencias_tratadas").insert({ recorrencia_id: ctx.r.id, data_ocorrencia: ctx.dataOc, situacao: "pulada" });
  revalidatePath("/", "layout");
  redirect(String(fd.get("voltar") ?? "") === "painel" ? "/" : "/recorrentes?ok=pulada");
}

/**
 * Cria a recorrência mensal a partir de uma sugestão detectada no histórico.
 * Os ids vêm do formulário, mas as FKs compostas (user_id, id) do banco garantem que conta/cartão/categoria são do usuário.
 */
export async function criarDaSugestao(fd: FormData) {
  const { supabase } = await requireUser();
  const tipo = texto(fd, "tipo", 10);
  const descricao = texto(fd, "descricao", 120);
  const valor = Math.trunc(Number(texto(fd, "valor", 16)));
  const dia = Math.trunc(Number(texto(fd, "dia", 2)));
  const conta = idOpcional(fd, "conta_id");
  const cartao = idOpcional(fd, "cartao_id");
  const categoria = idOpcional(fd, "categoria_id");
  if ((tipo !== "despesa" && tipo !== "receita") || !descricao || !Number.isInteger(valor) || valor <= 0 || valor > LIMITE
    || !Number.isInteger(dia) || dia < 1 || dia > 31 || conta === false || cartao === false || !categoria || (!conta && !cartao)
    || (tipo === "receita" && !conta)) {
    redirect("/recorrentes?ok=erro-sugestao");
  }
  // Próxima data com esse dia (hoje ou adiante); meses curtos usam o último dia.
  const hoje = hojeISO();
  const [a, m] = hoje.split("-").map(Number);
  const noMes = (ano: number, mes0: number) => {
    const ult = new Date(Date.UTC(ano, mes0 + 1, 0)).getUTCDate();
    return new Date(Date.UTC(ano, mes0, Math.min(dia, ult))).toISOString().slice(0, 10);
  };
  const inicio = noMes(a, m - 1) >= hoje ? noMes(a, m - 1) : noMes(a, m);
  const { error } = await supabase.from("recorrencias").insert({
    tipo, descricao, valor_centavos: valor, frequencia: "mensal", data_inicio: inicio,
    conta_id: cartao ? null : conta, cartao_id: tipo === "despesa" ? cartao : null, categoria_id: categoria,
  });
  revalidatePath("/", "layout");
  redirect(error ? "/recorrentes?ok=erro-sugestao" : "/recorrentes?ok=salva");
}
