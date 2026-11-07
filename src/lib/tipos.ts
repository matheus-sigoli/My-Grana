export type TipoConta = "corrente" | "poupanca" | "carteira" | "corretora";
export type TipoCategoria = "receita" | "despesa";
export type TipoLancamento = "receita" | "despesa" | "transferencia";

export const NOME_TIPO_CONTA: Record<TipoConta, string> = {
  corrente: "Conta corrente",
  poupanca: "Poupança / Caixinha",
  carteira: "Carteira (dinheiro)",
  corretora: "Corretora",
};

export type Conta = {
  id: string;
  nome: string;
  tipo: TipoConta;
  cor: string;
  arquivada: boolean;
  saldo_inicial_centavos: number;
};

export type SaldoConta = {
  conta_id: string;
  nome: string;
  tipo: TipoConta;
  cor: string;
  arquivada: boolean;
  saldo_inicial_centavos: number;
  saldo_centavos: number;
};

export type Categoria = {
  id: string;
  nome: string;
  tipo: TipoCategoria;
  parent_id: string | null;
  cor: string;
  arquivada: boolean;
};

export type Lancamento = {
  id: string;
  tipo: TipoLancamento;
  status: "previsto" | "efetivado";
  descricao: string;
  valor_centavos: number;
  data: string;
  conta_id: string | null;
  conta_destino_id: string | null;
  categoria_id: string | null;
  observacao: string | null;
  cartao_id: string | null;
  grupo_parcelas: string | null;
  parcela: number | null;
  total_parcelas: number | null;
  /** 1º dia do mês em que o lançamento conta (mês da fatura para compras no cartão). */
  competencia: string;
};

export type EstadoForm = { erro: string | null };
export const ESTADO_INICIAL: EstadoForm = { erro: null };

export const MSG_EM_USO =
  "Não dá para excluir: existem lançamentos (ou subcategorias) usando este item. Arquive em vez de excluir.";

/** Mensagens das nossas próprias regras no banco (triggers) — as únicas repassadas ao usuário. */
const MENSAGENS_DO_BANCO = [
  "Subcategoria só pode ter 1 nível",
  "Subcategoria deve ter o mesmo tipo da categoria-mãe",
  "Categoria com subcategorias não pode virar subcategoria",
  "Renda variável e cripto usam compra e venda",
  "Renda fixa, fundos e previdência usam aplicação e resgate",
  "Ativo não encontrado",
  "Orçamento só em categoria-mãe de despesa",
  "Confirme o código do autenticador",
];

/** Traduz erros do Postgres/Supabase para mensagens em português, sem vazar detalhes internos. */
export function mensagemErro(e: { code?: string; message?: string } | null): string {
  if (!e) return "Não foi possível salvar. Tente de novo.";
  if (e.code === "23503") return MSG_EM_USO;
  if (e.code === "23514" || e.code === "22P02") return "Algum campo está fora do formato esperado. Confira e tente de novo.";
  if (e.code === "P0001" && e.message) {
    if (MENSAGENS_DO_BANCO.includes(e.message)) return e.message + ".";
    if (e.message.startsWith("Categoria de ")) return "Essa categoria não serve para este tipo de lançamento.";
  }
  console.error("[mygrana] erro do banco:", e.code, e.message);
  return "Não foi possível salvar. Tente de novo em instantes.";
}
