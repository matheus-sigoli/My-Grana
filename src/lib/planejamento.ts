/**
 * Planejamento (M3): orçamento por categoria, metas e fluxo de caixa dos próximos meses.
 * Módulo puro, sem banco — testado em scripts/testar-planejamento.cjs.
 */
import { datasEntre, type Recorrencia, type Tratada } from "./recorrencias";

export type EstadoOrcamento = "ok" | "atencao" | "estourado";

/** Avisos em 80% e 100% (CONTEXT.md › Orçamento). */
export function progressoOrcamento(gastoCentavos: number, limiteCentavos: number) {
  const pct = limiteCentavos > 0 ? Math.round((gastoCentavos / limiteCentavos) * 100) : 0;
  const estado: EstadoOrcamento = pct >= 100 ? "estourado" : pct >= 80 ? "atencao" : "ok";
  return { pct, estado, restanteCentavos: limiteCentavos - gastoCentavos };
}

/** Meses inteiros entre hoje e o prazo, contando o mês do prazo (mínimo 1). null sem prazo. */
export function mesesAte(hoje: string, prazo: string | null) {
  if (!prazo) return null;
  const [a1, m1] = hoje.split("-").map(Number);
  const [a2, m2] = prazo.split("-").map(Number);
  return Math.max(1, (a2 - a1) * 12 + (m2 - m1) + 1);
}

/** Progresso de uma meta; com prazo, sugere quanto guardar por mês (ADR-0004). */
export function progressoMeta(m: { alvoCentavos: number; atualCentavos: number; prazo: string | null }, hoje: string) {
  const atual = Math.max(0, m.atualCentavos);
  const pct = m.alvoCentavos > 0 ? Math.min(100, Math.round((atual / m.alvoCentavos) * 100)) : 0;
  const falta = Math.max(0, m.alvoCentavos - atual);
  const meses = mesesAte(hoje, m.prazo);
  const vencida = !!m.prazo && m.prazo < hoje && falta > 0;
  return {
    pct,
    faltaCentavos: falta,
    concluida: falta === 0,
    vencida,
    meses,
    porMesCentavos: falta > 0 && meses && !vencida ? Math.ceil(falta / meses) : null,
  };
}

export type TipoMeta = "economia" | "patrimonio" | "renda_passiva";
export type Meta = { id: string; nome: string; tipo: TipoMeta; valor_alvo_centavos: number; prazo: string | null; conta_id: string | null };
export const NOME_TIPO_META: Record<TipoMeta, string> = {
  economia: "Guardar dinheiro",
  patrimonio: "Patrimônio líquido",
  renda_passiva: "Renda passiva mensal",
};

/** Valor atual de cada tipo de meta: economia = saldo da conta; patrimônio = líquido; renda passiva = média de proventos. */
export function atualDaMeta(m: Pick<Meta, "tipo" | "conta_id">, ctx: { saldoConta: Map<string, number>; patrimonioCentavos: number; rendaPassivaCentavos: number }) {
  if (m.tipo === "economia") return ctx.saldoConta.get(m.conta_id ?? "") ?? 0;
  if (m.tipo === "patrimonio") return ctx.patrimonioCentavos;
  return ctx.rendaPassivaCentavos;
}

/** Média mensal dos proventos dos últimos 12 meses completos (renda passiva). */
export function rendaPassivaMensal(proventosPorMes: { mes: string; valorCentavos: number }[], hoje: string) {
  const [a, m] = hoje.split("-").map(Number);
  const mm = String(m).padStart(2, "0");
  const de = `${a - 1}-${mm}`; // mesmo mês do ano passado (inclusive)
  const ate = `${a}-${mm}`; // mês corrente (exclusive: ainda incompleto)
  const soma = proventosPorMes.filter((p) => p.mes >= de && p.mes < ate).reduce((s, p) => s + p.valorCentavos, 0);
  return Math.round(soma / 12);
}

export type MesFluxo = {
  mes: string;
  entradasCentavos: number;
  saidasCentavos: number;
  faturasCentavos: number;
  investidoCentavos: number;
  saldoFinalCentavos: number;
};

/**
 * Fluxo de caixa projetado mês a mês a partir do saldo atual das contas:
 * + recorrências de receita; − despesas recorrentes (na conta ou no cartão, aproximando a fatura pelo mês da compra);
 * − faturas de cartão a vencer; − aportes. Transferências entre contas próprias não mudam o total.
 * O mês corrente só considera o que ainda não aconteceu (de `hoje` em diante, mais atrasados).
 */
export function fluxoDeCaixa(e: {
  saldoAtualCentavos: number;
  hoje: string;
  meses: string[];
  regras: Recorrencia[];
  tratadas: Tratada[];
  faturasPorMes: Map<string, number>;
}): MesFluxo[] {
  const feitas = new Set(e.tratadas.map((t) => `${t.recorrencia_id}|${t.data_ocorrencia}`));
  let saldo = e.saldoAtualCentavos;
  return e.meses.map((mes) => {
    const inicio = `${mes}-01`;
    const fim = `${mes}-31`; // comparação de texto: cobre meses de 28 a 31 dias
    let entradas = 0, saidas = 0, investido = 0;
    for (const r of e.regras) {
      if (!r.ativa) continue;
      for (const d of datasEntre(r, inicio, fim)) {
        if (feitas.has(`${r.id}|${d}`)) continue;
        if (r.tipo === "receita") entradas += r.valor_centavos;
        else if (r.tipo === "despesa") saidas += r.valor_centavos;
        else if (r.tipo === "aporte") investido += r.valor_centavos;
      }
    }
    const faturas = e.faturasPorMes.get(mes) ?? 0;
    saldo += entradas - saidas - faturas - investido;
    return { mes, entradasCentavos: entradas, saidasCentavos: saidas, faturasCentavos: faturas, investidoCentavos: investido, saldoFinalCentavos: saldo };
  });
}
