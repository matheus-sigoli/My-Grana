/**
 * Nota da carteira e diagnóstico por ativo (ADR-0009).
 * Só fatos e regras visíveis: o MyGrana não diz comprar, manter ou vender.
 */
import { GRUPOS, diasEntre, type Carteira, type Grupo, type Posicao } from "./calculo";

/* --------------------------------------------------------------- utilidades */

const limitar = (x: number, min = 0, max = 1) => Math.min(max, Math.max(min, x));
/** 1 em `bom`, 0 em `ruim`, linear entre os dois (funciona nos dois sentidos). */
const escala = (x: number, bom: number, ruim: number) => limitar((x - ruim) / (bom - ruim));
const pct = (f: number) => `${(f * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;
const reais = (c: number) => (c / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const meses = (dias: number) => Math.floor(dias / 30.44);

/** Títulos públicos e poupança não contam como "concentração" de risco de um emissor. */
const baixoRiscoEmissor = (p: Posicao) =>
  p.ativo.tipo_rf?.startsWith("tesouro") || p.ativo.tipo_rf === "poupanca" || (p.ativo.classe === "renda_fixa" && (p.ativo.indexador === "selic" || p.ativo.indexador === "pos_cdi"));

/* ------------------------------------------------------------------- nota */

export type Criterio = {
  id: "diversificacao" | "rendimento" | "reserva" | "custos" | "meta";
  nome: string;
  peso: number;
  pontos: number;
  resumo: string;
  dica: string | null;
};

export type Nota = { nota: number; faixa: "Frágil" | "Em construção" | "Boa" | "Muito boa"; criterios: Criterio[] };

export const PESOS = { diversificacao: 3, rendimento: 3, reserva: 2, custos: 1, meta: 1 } as const;
export const MESES_DE_RESERVA = 6;

export function notaCarteira(c: Carteira, alvo: Partial<Record<Grupo, number>>, gastoMensalCentavos: number | null, hoje: string): Nota {
  const vivos = c.posicoes.filter((p) => p.valorCentavos > 0);
  const total = c.totalCentavos;
  const criterios: Criterio[] = [];

  // 1. Diversificação
  {
    const relevantes = GRUPOS.filter((g) => total > 0 && c.porGrupo[g] / total >= 0.05).length;
    const comRisco = vivos.filter((p) => !baixoRiscoEmissor(p));
    const maior = comRisco.reduce((m, p) => Math.max(m, total ? p.valorCentavos / total : 0), 0);
    const hhi = comRisco.reduce((s, p) => s + (total ? (p.valorCentavos / total) ** 2 : 0), 0);
    const nEfetivo = hhi > 0 ? 1 / hhi : vivos.length > 0 ? 8 : 0;
    const f = 0.4 * Math.min(relevantes, 4) / 4 + 0.3 * escala(maior, 0.2, 0.6) + 0.3 * Math.min(nEfetivo, 8) / 8;
    const maiorP = comRisco.sort((a, b) => b.valorCentavos - a.valorCentavos)[0];
    criterios.push({
      id: "diversificacao", nome: "Diversificação", peso: PESOS.diversificacao, pontos: PESOS.diversificacao * f,
      resumo: `${relevantes} ${relevantes === 1 ? "grupo" : "grupos"} com 5% ou mais da carteira${maiorP ? `; o maior ativo (${maiorP.ativo.ticker ?? maiorP.ativo.nome}) é ${pct(maior)} do total` : ""}.`,
      dica: f >= 0.85 ? null : relevantes < 3 ? "Ter dinheiro em mais grupos (renda fixa, ações, FIIs…) reduz o impacto de um só mercado ir mal." : "Um único ativo concentra boa parte da carteira.",
    });
  }

  // 2. Rendimento vs CDI e inflação (mesmos fluxos, mesmas datas)
  {
    const primeira = c.posicoes.map((p) => p.primeiraData).filter(Boolean).sort()[0] as string | undefined;
    const dias = primeira ? diasEntre(primeira, hoje) : 0;
    const atual = total;
    const cdi = c.equivalenteCdiCentavos;
    const infl = c.equivalenteInflacaoCentavos;
    let f: number;
    let resumo: string;
    const poucoHistorico = dias < 90 || cdi - infl <= Math.abs(cdi) * 0.002;
    if (poucoHistorico) {
      f = 2 / 3;
      resumo = "Pouco histórico para comparar com o CDI (menos de 3 meses). Este item conta como neutro por enquanto.";
    } else {
      f = escala(atual, cdi, infl);
      resumo = `Hoje vale ${reais(atual)}; o mesmo dinheiro a 100% do CDI valeria ${reais(cdi)} e, só corrigido pela inflação, ${reais(infl)}.`;
    }
    criterios.push({
      id: "rendimento", nome: "Rendimento", peso: PESOS.rendimento, pontos: PESOS.rendimento * f, resumo,
      dica: poucoHistorico || f >= 0.95 ? null : atual < infl ? "A carteira está rendendo menos que a inflação no período." : "A carteira está rendendo menos que o CDI no período. Veja no diagnóstico quais ativos puxam para baixo.",
    });
  }

  // 3. Reserva de emergência (renda fixa pós/Selic vs gasto mensal real)
  {
    const reserva = c.porGrupo.rf_pos;
    const meta = gastoMensalCentavos && gastoMensalCentavos > 0 ? gastoMensalCentavos * MESES_DE_RESERVA : null;
    const f = meta ? limitar(reserva / meta) : 0.5;
    criterios.push({
      id: "reserva", nome: "Reserva de emergência", peso: PESOS.reserva, pontos: PESOS.reserva * f,
      resumo: meta
        ? `${reais(reserva)} em renda fixa pós/Selic, ${pct(reserva / meta)} de ${MESES_DE_RESERVA} meses do seu gasto médio (${reais(gastoMensalCentavos!)} por mês).`
        : "Sem gastos lançados suficientes para medir a reserva.",
      dica: !meta ? "Lance seus gastos por alguns meses para o MyGrana calcular a reserva ideal." : f >= 1 ? null : `Faltam ${reais(meta - reserva)} para ${MESES_DE_RESERVA} meses de gastos em aplicações de resgate rápido.`,
    });
  }

  // 4. Custos
  {
    const taxas = c.posicoes.reduce((s, p) => s + p.taxasCentavos, 0);
    const proporcao = c.aportesCentavos > 0 ? taxas / c.aportesCentavos : 0;
    const f = escala(proporcao, 0.002, 0.02);
    criterios.push({
      id: "custos", nome: "Custos", peso: PESOS.custos, pontos: PESOS.custos * f,
      resumo: `${reais(taxas)} em taxas e corretagem, ${pct(proporcao)} do que você aportou.`,
      dica: f >= 0.9 ? null : "Taxas acima de 0,2% dos aportes corroem o rendimento com o tempo.",
    });
  }

  // 5. Aderência à meta
  {
    const temAlvo = Object.values(alvo).some((v) => (v ?? 0) > 0);
    let f = 0.5;
    let resumo = "Sem meta de alocação definida.";
    if (temAlvo && total > 0) {
      const distancia = GRUPOS.reduce((s, g) => s + Math.abs(c.porGrupo[g] / total - (alvo[g] ?? 0) / 100), 0) / 2;
      f = escala(distancia, 0.05, 0.4);
      resumo = `A carteira está ${pct(distancia)} distante da sua meta.`;
    }
    criterios.push({
      id: "meta", nome: "Aderência à meta", peso: PESOS.meta, pontos: PESOS.meta * f, resumo,
      dica: !temAlvo ? "Defina uma meta em Alocação para medir este item." : f >= 0.9 ? null : "Use a calculadora de aporte em Alocação para se aproximar da meta.",
    });
  }

  const nota = Math.round(criterios.reduce((s, k) => s + k.pontos, 0) * 10) / 10;
  const faixa = nota < 4 ? "Frágil" : nota < 6 ? "Em construção" : nota < 8 ? "Boa" : "Muito boa";
  return { nota, faixa, criterios: criterios.map((k) => ({ ...k, pontos: Math.round(k.pontos * 10) / 10 })) };
}

/* ------------------------------------------------------------- diagnóstico */

export type Nivel = "info" | "atencao" | "revisar";
export type Diagnostico = {
  posicao: Posicao;
  status: "em_dia" | "atencao" | "revisar";
  meses: number;
  pesoNaCarteira: number;
  /** Quanto do ganho que o CDI teria dado este ativo entregou (1 = igual ao CDI). null se não der para comparar. */
  fracaoDoCdi: number | null;
  sinais: { nivel: Nivel; texto: string }[];
};

export function diagnosticar(p: Posicao, totalCarteira: number, hoje: string): Diagnostico {
  const dias = p.primeiraData ? diasEntre(p.primeiraData, hoje) : 0;
  const m = meses(dias);
  const peso = totalCarteira > 0 ? p.valorCentavos / totalCarteira : 0;
  const atualMaisRetirado = p.valorCentavos; // equivalentes já descontam o que saiu
  const ganhoCdi = p.equivalenteCdiCentavos - (p.aportesCentavos - p.retiradasCentavos);
  const ganho = p.resultadoCentavos;
  const fracaoDoCdi = dias >= 90 && ganhoCdi > p.aportesCentavos * 0.005 ? ganho / ganhoCdi : null;
  const sinais: Diagnostico["sinais"] = [];
  const rf = p.ativo.classe === "renda_fixa";

  if (p.vencido && p.valorCentavos > 0) {
    sinais.push({ nivel: "revisar", texto: `Venceu em ${p.ativo.vencimento!.split("-").reverse().join("/")}. O dinheiro pode estar parado na conta: registre o resgate.` });
  }
  if (m >= 12 && atualMaisRetirado < p.equivalenteInflacaoCentavos) {
    sinais.push({ nivel: "revisar", texto: `Em ${m} meses rendeu menos que a inflação: perdeu poder de compra (${reais(p.equivalenteInflacaoCentavos - atualMaisRetirado)} abaixo).` });
  } else if (m >= 12 && fracaoDoCdi !== null && fracaoDoCdi < (rf ? 0.95 : 0.9)) {
    sinais.push({ nivel: "atencao", texto: `Em ${m} meses entregou ${pct(Math.max(0, fracaoDoCdi))} do que o CDI teria rendido com o mesmo dinheiro.` });
  }
  if (rf && p.ativo.indexador === "pos_cdi" && Number(p.ativo.taxa) < 90) {
    sinais.push({ nivel: "atencao", texto: `Rende ${Number(p.ativo.taxa).toLocaleString("pt-BR")}% do CDI, abaixo de 90%. Vale comparar com outras opções de mesma liquidez e garantia.` });
  }
  if (!baixoRiscoEmissor(p) && peso > 0.25) {
    sinais.push({ nivel: "atencao", texto: `Representa ${pct(peso)} da carteira: o resultado total depende bastante dele.` });
  }
  if (p.aportesCentavos > 0 && p.taxasCentavos / p.aportesCentavos > 0.01) {
    sinais.push({ nivel: "atencao", texto: `Taxas somam ${pct(p.taxasCentavos / p.aportesCentavos)} do que foi aportado.` });
  }
  if (rf && p.irEstimadoCentavos && dias < 180) {
    sinais.push({ nivel: "info", texto: "Resgatar antes de 180 dias paga 22,5% de IR sobre o ganho; a alíquota cai com o tempo." });
  }
  if (p.fonte === "custo" && p.valorCentavos > 0) {
    sinais.push({
      nivel: "info",
      texto: p.ativo.classe === "fundo" || p.ativo.classe === "previdencia"
        ? "Mostrando o valor aplicado. Informe o saldo do extrato na página do ativo para ver o rendimento."
        : "Sem cotação agora: o valor mostrado é o custo.",
    });
  }
  if (m < 6) sinais.push({ nivel: "info", texto: "Menos de 6 meses de histórico: comparações ainda dizem pouco." });

  const status = sinais.some((s) => s.nivel === "revisar") ? "revisar" : sinais.some((s) => s.nivel === "atencao") ? "atencao" : "em_dia";
  return { posicao: p, status, meses: m, pesoNaCarteira: peso, fracaoDoCdi, sinais };
}

/** Gasto mensal médio a partir das despesas dos últimos meses completos (ignora o mês atual). */
export function gastoMensalMedio(despesas: { data: string; valor_centavos: number }[], hoje: string, mesesJanela = 6) {
  const mesAtual = hoje.slice(0, 7);
  const porMes = new Map<string, number>();
  for (const d of despesas) {
    const m = d.data.slice(0, 7);
    if (m >= mesAtual) continue;
    porMes.set(m, (porMes.get(m) ?? 0) + d.valor_centavos);
  }
  const ultimos = [...porMes.entries()].sort().slice(-mesesJanela);
  if (ultimos.length < 2) return null; // pouco dado para uma média honesta
  return Math.round(ultimos.reduce((s, [, v]) => s + v, 0) / ultimos.length);
}
