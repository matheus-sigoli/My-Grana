"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { paraCentavos, paraNumero } from "@/lib/dinheiro";
import { GRUPOS, type Classe, type Indexador, type TipoOperacao, type TipoProvento, type TipoRF } from "@/lib/investimentos/calculo";
import { INDEXADOR_PADRAO } from "@/lib/investimentos/rotulos";
import { dataIsoValida, ehUuid, idOpcional, texto } from "@/lib/seguranca";
import { requireUser } from "@/lib/supabase/server";
import { mensagemErro, type EstadoForm } from "@/lib/tipos";

const CLASSES: Classe[] = ["renda_fixa", "acao", "fii", "etf", "bdr", "cripto", "fundo", "previdencia"];
const TIPOS_RF: TipoRF[] = ["cdb", "lci", "lca", "lc", "tesouro_selic", "tesouro_prefixado", "tesouro_ipca", "debenture", "cri", "cra", "poupanca", "outro"];
const INDEXADORES: Indexador[] = ["pos_cdi", "selic", "pre", "ipca"];
const PROVENTOS: TipoProvento[] = ["dividendo", "jcp", "rendimento", "juros", "amortizacao"];
const RV: Classe[] = ["acao", "fii", "etf", "bdr", "cripto"];
const LIMITE = 100_000_000_000;
const dataValida = dataIsoValida;

/** Lê e valida os campos de uma operação. Para renda variável: quantidade × preço; demais: valor. */
function lerOperacao(fd: FormData, classe: Classe) {
  const rv = RV.includes(classe);
  const tipoTexto = texto(fd, "tipo_op", 12) as TipoOperacao;
  const permitidos: TipoOperacao[] = rv ? ["compra", "venda"] : ["aplicacao", "resgate"];
  const tipo = permitidos.includes(tipoTexto) ? tipoTexto : null;
  const conta_id = idOpcional(fd, "conta_id");
  const data = texto(fd, "data", 10);
  const quantidade = rv ? paraNumero(texto(fd, "quantidade", 30), 8) : null;
  const preco = rv ? paraNumero(texto(fd, "preco", 30), 8) : null;
  const valor = rv ? (quantidade !== null && preco !== null ? Math.round(quantidade * preco * 100) : null) : paraCentavos(texto(fd, "valor", 24));
  const taxas = paraCentavos(texto(fd, "taxas", 24) || "0");
  const ir = paraCentavos(texto(fd, "ir", 24) || "0");
  const afeta_caixa = fd.get("ja_tinha") !== "1";

  if (!tipo) return { erro: "Escolha o tipo da operação." } as const;
  if (!conta_id) return { erro: "Escolha a conta ou corretora." } as const;
  if (!dataValida(data)) return { erro: "Data inválida." } as const;
  if (rv && (quantidade === null || quantidade <= 0)) return { erro: "Informe a quantidade (ex.: 100 ou 0,0025)." } as const;
  if (rv && (preco === null || preco <= 0)) return { erro: "Informe o preço por unidade (ex.: 38,45)." } as const;
  if (valor === null || valor <= 0) return { erro: "Informe o valor (ex.: 1.000,00)." } as const;
  if (valor > LIMITE) return { erro: "Valor alto demais. Confira os números." } as const;
  if (taxas === null || taxas < 0 || taxas > LIMITE) return { erro: "Taxas inválidas." } as const;
  if (ir === null || ir < 0 || ir > LIMITE) return { erro: "IR retido inválido." } as const;
  return {
    dados: {
      tipo, conta_id, data, quantidade, valor_centavos: valor, taxas_centavos: taxas,
      ir_centavos: tipo === "venda" || tipo === "resgate" ? ir : 0, afeta_caixa,
      observacao: texto(fd, "observacao", 300) || null,
    },
  } as const;
}

export async function criarAtivo(_: EstadoForm, fd: FormData): Promise<EstadoForm> {
  const { supabase } = await requireUser();
  const classe = texto(fd, "classe", 20) as Classe;
  if (!CLASSES.includes(classe)) return { erro: "Escolha o tipo de investimento." };

  let ativo: Record<string, unknown>;
  if (RV.includes(classe)) {
    const ticker = texto(fd, "ticker", 12).toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (!/^[A-Z0-9]{2,12}$/.test(ticker)) return { erro: classe === "cripto" ? "Informe o símbolo, como BTC ou ETH." : "Informe o código, como PETR4 ou HGLG11." };
    ativo = { classe, ticker, nome: texto(fd, "nome", 80) || ticker };
  } else if (classe === "renda_fixa") {
    const tipo_rf = texto(fd, "tipo_rf", 20) as TipoRF;
    if (!TIPOS_RF.includes(tipo_rf)) return { erro: "Escolha o tipo do título." };
    const indexador = (texto(fd, "indexador", 10) || INDEXADOR_PADRAO[tipo_rf] || "") as Indexador;
    if (!INDEXADORES.includes(indexador)) return { erro: "Escolha como o título rende." };
    const taxa = paraNumero(texto(fd, "taxa", 12), 4) ?? (indexador === "selic" ? 0 : null);
    if (taxa === null || taxa < -100 || taxa > 1000) return { erro: indexador === "pos_cdi" ? "Informe o % do CDI (ex.: 110)." : "Informe a taxa (ex.: 12,5)." };
    const vencimento = texto(fd, "vencimento", 10) || null;
    if (vencimento && !dataValida(vencimento)) return { erro: "Data de vencimento inválida." };
    const nome = texto(fd, "nome", 80);
    if (!nome) return { erro: "Dê um nome, como “CDB Banco Inter” ou “Tesouro IPCA+ 2035”." };
    ativo = { classe, nome, tipo_rf, indexador, taxa, vencimento, isento_ir: fd.get("isento_ir") === "1" };
  } else {
    const nome = texto(fd, "nome", 80);
    if (!nome) return { erro: "Dê um nome ao fundo ou plano." };
    ativo = { classe, nome };
  }

  const op = lerOperacao(fd, classe);
  if ("erro" in op) return { erro: op.erro ?? "Confira a operação." };
  if (op.dados.tipo === "venda" || op.dados.tipo === "resgate") return { erro: "A primeira operação precisa ser uma compra ou aplicação." };

  const { data: criado, error } = await supabase.from("ativos").insert(ativo).select("id").single();
  if (error) {
    if (error.code === "23505") return { erro: "Você já cadastrou esse código. Abra o ativo na carteira e registre uma nova compra." };
    return { erro: mensagemErro(error) };
  }
  const { error: e2 } = await supabase.from("operacoes_investimento").insert({ ...op.dados, ativo_id: criado.id });
  if (e2) {
    await supabase.from("ativos").delete().eq("id", criado.id);
    return { erro: mensagemErro(e2) };
  }
  revalidatePath("/", "layout");
  redirect(`/investimentos/${criado.id}`);
}

export async function salvarOperacao(_: EstadoForm, fd: FormData): Promise<EstadoForm> {
  const { supabase } = await requireUser();
  const ativo_id = texto(fd, "ativo_id", 64);
  if (!ehUuid(ativo_id)) return { erro: "Ativo inválido." };
  const { data: ativo } = await supabase.from("ativos").select("classe").eq("id", ativo_id).maybeSingle();
  if (!ativo) return { erro: "Ativo não encontrado." };
  const op = lerOperacao(fd, ativo.classe as Classe);
  if ("erro" in op) return { erro: op.erro ?? "Confira a operação." };
  if (op.dados.tipo === "venda") {
    // Não deixa vender mais do que tem (até a data da venda).
    const { data: ops } = await supabase.from("operacoes_investimento").select("tipo,quantidade,data").eq("ativo_id", ativo_id).lte("data", op.dados.data);
    const saldo = (ops ?? []).reduce((s, o) => s + (o.tipo === "compra" ? 1 : -1) * Number(o.quantidade ?? 0), 0);
    if (op.dados.quantidade! > saldo + 1e-9) return { erro: `Você tinha ${saldo.toLocaleString("pt-BR", { maximumFractionDigits: 8 })} nessa data. Confira a quantidade ou a data.` };
  }
  const { error } = await supabase.from("operacoes_investimento").insert({ ...op.dados, ativo_id });
  if (error) return { erro: mensagemErro(error) };
  revalidatePath("/", "layout");
  redirect(`/investimentos/${ativo_id}?ok=operacao`);
}

export async function salvarAvaliacao(_: EstadoForm, fd: FormData): Promise<EstadoForm> {
  const { supabase } = await requireUser();
  const ativo_id = texto(fd, "ativo_id", 64);
  const data = texto(fd, "data", 10);
  const valor = paraCentavos(texto(fd, "valor", 24));
  if (!ehUuid(ativo_id)) return { erro: "Ativo inválido." };
  if (!dataValida(data)) return { erro: "Data inválida." };
  if (valor === null || valor < 0 || valor > LIMITE) return { erro: "Informe o valor do extrato (ex.: 10.532,18)." };
  const { error } = await supabase.from("avaliacoes").upsert({ ativo_id, data, valor_centavos: valor }, { onConflict: "ativo_id,data" });
  if (error) return { erro: mensagemErro(error) };
  revalidatePath("/", "layout");
  redirect(`/investimentos/${ativo_id}?ok=avaliacao`);
}

export async function salvarProvento(_: EstadoForm, fd: FormData): Promise<EstadoForm> {
  const { supabase } = await requireUser();
  const ativo_id = texto(fd, "ativo_id", 64);
  const conta_id = texto(fd, "conta_id", 64);
  const tipo = texto(fd, "tipo_provento", 20) as TipoProvento;
  const data = texto(fd, "data", 10);
  const valor = paraCentavos(texto(fd, "valor", 24));
  if (!ehUuid(ativo_id) || !ehUuid(conta_id)) return { erro: "Escolha a conta onde o provento caiu." };
  if (!PROVENTOS.includes(tipo)) return { erro: "Escolha o tipo do provento." };
  if (!dataValida(data)) return { erro: "Data inválida." };
  if (valor === null || valor <= 0 || valor > LIMITE) return { erro: "Informe o valor líquido recebido." };
  const { error } = await supabase.rpc("registrar_provento", {
    p_ativo_id: ativo_id, p_conta_id: conta_id, p_tipo: tipo, p_data: data, p_valor_centavos: valor,
  });
  if (error) return { erro: mensagemErro(error) };
  revalidatePath("/", "layout");
  redirect(`/investimentos/${ativo_id}?ok=provento`);
}

export async function editarAtivo(_: EstadoForm, fd: FormData): Promise<EstadoForm> {
  const { supabase } = await requireUser();
  const id = texto(fd, "id", 64);
  if (!ehUuid(id)) return { erro: "Ativo inválido." };
  const { data: atual } = await supabase.from("ativos").select("classe").eq("id", id).maybeSingle();
  if (!atual) return { erro: "Ativo não encontrado." };
  const nome = texto(fd, "nome", 80);
  if (!nome) return { erro: "Dê um nome ao ativo." };
  const dados: Record<string, unknown> = { nome };
  if (atual.classe === "renda_fixa") {
    const taxa = paraNumero(texto(fd, "taxa", 12), 4);
    if (taxa === null || taxa < -100 || taxa > 1000) return { erro: "Taxa inválida." };
    const vencimento = texto(fd, "vencimento", 10) || null;
    if (vencimento && !dataValida(vencimento)) return { erro: "Vencimento inválido." };
    Object.assign(dados, { taxa, vencimento, isento_ir: fd.get("isento_ir") === "1" });
  }
  const { error } = await supabase.from("ativos").update(dados).eq("id", id);
  if (error) return { erro: mensagemErro(error) };
  revalidatePath("/", "layout");
  redirect(`/investimentos/${id}?ok=ativo`);
}

/** Exclusões: operação, avaliação, provento (apaga a receita junto) ou o ativo inteiro. */
export async function excluirItem(fd: FormData) {
  const { supabase } = await requireUser();
  const tabela = texto(fd, "tabela", 30);
  const id = texto(fd, "id", 64);
  const ativo_id = texto(fd, "ativo_id", 64);
  const permitidas = ["operacoes_investimento", "avaliacoes", "proventos", "ativos"] as const;
  if (!permitidas.includes(tabela as (typeof permitidas)[number]) || !ehUuid(id)) redirect("/investimentos");
  await supabase.from(tabela as (typeof permitidas)[number]).delete().eq("id", id);
  revalidatePath("/", "layout");
  redirect(tabela === "ativos" || !ehUuid(ativo_id) ? "/investimentos" : `/investimentos/${ativo_id}`);
}

export async function alternarAtivoArquivado(fd: FormData) {
  const { supabase } = await requireUser();
  const id = texto(fd, "id", 64);
  if (!ehUuid(id)) return;
  await supabase.from("ativos").update({ arquivado: fd.get("arquivado") !== "true" }).eq("id", id);
  revalidatePath("/", "layout");
}

export async function salvarAlocacao(_: EstadoForm, fd: FormData): Promise<EstadoForm> {
  const { supabase, user } = await requireUser();
  const linhas = [];
  let soma = 0;
  for (const g of GRUPOS) {
    const v = paraNumero(texto(fd, `alvo_${g}`, 8) || "0", 2);
    if (v === null || v < 0 || v > 100) return { erro: "Use percentuais entre 0 e 100." };
    soma += v;
    linhas.push({ user_id: user.id, grupo: g, percentual: v });
  }
  if (Math.abs(soma - 100) > 0.01) return { erro: `Os percentuais somam ${soma.toLocaleString("pt-BR")}%. Ajuste para fechar 100%.` };
  const { error } = await supabase.from("alocacao_alvo").upsert(linhas, { onConflict: "user_id,grupo" });
  if (error) return { erro: mensagemErro(error) };
  revalidatePath("/investimentos", "layout");
  redirect("/investimentos/alocacao?ok=1");
}
