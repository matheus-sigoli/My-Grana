/** Blocos do painel que o usuário pode mostrar, esconder e reordenar (o saldo fica sempre no topo). */
export const BLOCOS = {
  previstos: "A pagar e receber",
  cartoes: "Cartões",
  orcamento: "Orçamento do mês",
  metas: "Metas",
  categorias: "Para onde foi o dinheiro",
  contas: "Contas",
  grafico: "Últimos 6 meses",
  recentes: "Lançamentos recentes",
} as const;
export type Bloco = keyof typeof BLOCOS;
export const BLOCOS_PADRAO = Object.keys(BLOCOS) as Bloco[];
export const ehBloco = (v: unknown): v is Bloco => typeof v === "string" && v in BLOCOS;
