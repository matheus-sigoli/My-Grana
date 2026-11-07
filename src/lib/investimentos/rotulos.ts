import type { Ativo, Classe, Grupo, Indexador, TipoOperacao, TipoProvento, TipoRF } from "./calculo";

export const NOME_CLASSE: Record<Classe, string> = {
  renda_fixa: "Renda fixa", acao: "Ação", fii: "FII", etf: "ETF", bdr: "BDR", cripto: "Cripto", fundo: "Fundo", previdencia: "Previdência",
};

export const NOME_GRUPO: Record<Grupo, string> = {
  rf_pos: "Renda fixa pós (CDI/Selic)", rf_pre: "Renda fixa prefixada", rf_ipca: "Renda fixa IPCA+",
  acoes: "Ações", fiis: "Fundos imobiliários", etfs: "ETFs", bdrs: "BDRs", fundos: "Fundos", previdencia: "Previdência", cripto: "Cripto",
};

export const NOME_TIPO_RF: Record<TipoRF, string> = {
  cdb: "CDB", lci: "LCI", lca: "LCA", lc: "LC", tesouro_selic: "Tesouro Selic", tesouro_prefixado: "Tesouro Prefixado",
  tesouro_ipca: "Tesouro IPCA+", debenture: "Debênture", cri: "CRI", cra: "CRA", poupanca: "Poupança", outro: "Outro",
};

/** Indexador padrão sugerido por tipo de título. */
export const INDEXADOR_PADRAO: Partial<Record<TipoRF, Indexador>> = {
  tesouro_selic: "selic", tesouro_prefixado: "pre", tesouro_ipca: "ipca", poupanca: "selic",
};

export const NOME_INDEXADOR: Record<Indexador, string> = {
  pos_cdi: "Pós-fixado (% do CDI)", selic: "Selic + taxa", pre: "Prefixado (% ao ano)", ipca: "IPCA + taxa",
};

export const NOME_OPERACAO: Record<TipoOperacao, string> = { compra: "Compra", venda: "Venda", aplicacao: "Aplicação", resgate: "Resgate" };

export const NOME_PROVENTO: Record<TipoProvento, string> = {
  dividendo: "Dividendo", jcp: "JCP", rendimento: "Rendimento", juros: "Juros", amortizacao: "Amortização",
};

const pct = (n: number) => n.toLocaleString("pt-BR", { maximumFractionDigits: 4 });

/** "110% do CDI", "IPCA + 6,2%", "12,5% a.a.", "Selic + 0,1%" */
export function descreverTaxa(a: Pick<Ativo, "indexador" | "taxa">) {
  const t = Number(a.taxa ?? 0);
  switch (a.indexador) {
    case "pos_cdi": return `${pct(t)}% do CDI`;
    case "selic": return t ? `Selic + ${pct(t)}%` : "Selic";
    case "pre": return `${pct(t)}% a.a.`;
    case "ipca": return `IPCA + ${pct(t)}%`;
    default: return "";
  }
}

export const ehCotadoB3 = (c: Classe) => c === "acao" || c === "fii" || c === "etf" || c === "bdr";
