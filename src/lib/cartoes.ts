/**
 * Cartões de crédito (ADR-0001 + ADR-0010). Módulo puro.
 * "Fatura" = 1º dia do mês de vencimento (YYYY-MM-01), igual à coluna `competencia` das compras no banco.
 */

export type Cartao = {
  id: string;
  nome: string;
  limite_centavos: number;
  dia_fechamento: number;
  dia_vencimento: number;
  conta_pagamento_id: string | null;
  cor: string;
  arquivado: boolean;
};

export type CompraCartao = { id: string; cartao_id: string; competencia: string; valor_centavos: number };
export type PagamentoFatura = { id: string; cartao_id: string; fatura: string; valor_centavos: number; data: string; conta_id: string };

const ultimoDia = (ano: number, mes0: number) => new Date(Date.UTC(ano, mes0 + 1, 0)).getUTCDate();
const iso = (ano: number, mes0: number, dia: number) =>
  new Date(Date.UTC(ano, mes0, Math.min(dia, ultimoDia(ano, mes0)))).toISOString().slice(0, 10);

/** Mesma regra do banco (public.mes_da_fatura): compra no dia do fechamento ou depois vai para a fatura seguinte. */
export function mesDaFatura(data: string, fechamento: number, vencimento: number) {
  const ano = +data.slice(0, 4);
  const mes0 = +data.slice(5, 7) - 1;
  const dia = +data.slice(8, 10);
  const salto = (dia >= fechamento ? 1 : 0) + (vencimento <= fechamento ? 1 : 0);
  return iso(ano, mes0 + salto, 1);
}

/** Datas de fechamento e vencimento de uma fatura (meses curtos usam o último dia). */
export function datasDaFatura(c: Pick<Cartao, "dia_fechamento" | "dia_vencimento">, fatura: string) {
  const ano = +fatura.slice(0, 4);
  const mes0 = +fatura.slice(5, 7) - 1;
  const mesFech = c.dia_vencimento <= c.dia_fechamento ? mes0 - 1 : mes0;
  return { fechamento: iso(ano, mesFech, c.dia_fechamento), vencimento: iso(ano, mes0, c.dia_vencimento) };
}

export type StatusFatura = "futura" | "aberta" | "fechada" | "paga" | "vencida" | "vazia";

export type Fatura = {
  fatura: string;
  fechamento: string;
  vencimento: string;
  totalCentavos: number;
  pagoCentavos: number;
  restanteCentavos: number;
  status: StatusFatura;
};

export function statusFatura(total: number, pago: number, fechamento: string, vencimento: string, hoje: string, abertaAtual: boolean): StatusFatura {
  if (total <= 0) return "vazia";
  if (pago >= total) return "paga";
  if (hoje > vencimento) return "vencida";
  if (hoje >= fechamento) return "fechada";
  return abertaAtual ? "aberta" : "futura";
}

/** Faturas de um cartão (com compras ou pagamentos), da mais antiga para a mais nova. */
export function faturasDoCartao(c: Cartao, compras: CompraCartao[], pagamentos: PagamentoFatura[], hoje: string): Fatura[] {
  const total = new Map<string, number>();
  const pago = new Map<string, number>();
  for (const x of compras) if (x.cartao_id === c.id) total.set(x.competencia, (total.get(x.competencia) ?? 0) + x.valor_centavos);
  for (const p of pagamentos) if (p.cartao_id === c.id) pago.set(p.fatura, (pago.get(p.fatura) ?? 0) + p.valor_centavos);
  const atual = mesDaFatura(hoje, c.dia_fechamento, c.dia_vencimento);
  return [...new Set([...total.keys(), ...pago.keys()])].sort().map((f) => {
    const { fechamento, vencimento } = datasDaFatura(c, f);
    const t = total.get(f) ?? 0;
    const pg = pago.get(f) ?? 0;
    return {
      fatura: f, fechamento, vencimento, totalCentavos: t, pagoCentavos: pg,
      restanteCentavos: Math.max(0, t - pg),
      status: statusFatura(t, pg, fechamento, vencimento, hoje, f === atual),
    };
  });
}

/** Limite: tudo comprado (inclusive parcelas futuras) menos o que já foi pago. */
export function resumoDoCartao(c: Cartao, compras: CompraCartao[], pagamentos: PagamentoFatura[], hoje: string) {
  const faturas = faturasDoCartao(c, compras, pagamentos, hoje);
  const comprometido = faturas.reduce((s, f) => s + f.totalCentavos, 0) - faturas.reduce((s, f) => s + f.pagoCentavos, 0);
  const usado = Math.max(0, comprometido);
  const atual = mesDaFatura(hoje, c.dia_fechamento, c.dia_vencimento);
  // Fatura a pagar agora: a mais antiga com saldo em aberto já fechada; senão a aberta do mês.
  const aPagar = faturas.find((f) => f.restanteCentavos > 0 && (f.status === "vencida" || f.status === "fechada"));
  const aberta = faturas.find((f) => f.fatura === atual) ?? { fatura: atual, ...datasDaFatura(c, atual), totalCentavos: 0, pagoCentavos: 0, restanteCentavos: 0, status: "vazia" as StatusFatura };
  return {
    faturas,
    usadoCentavos: usado,
    disponivelCentavos: c.limite_centavos - usado,
    aPagar: aPagar ?? null,
    aberta,
  };
}

/** Divide o total em N parcelas inteiras; os centavos que sobram vão na primeira. */
export function dividirParcelas(totalCentavos: number, n: number) {
  const base = Math.floor(totalCentavos / n);
  return Array.from({ length: n }, (_, i) => (i === 0 ? totalCentavos - base * (n - 1) : base));
}
