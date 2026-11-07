/**
 * Simuladores (M7). Puros, em reais (números de ponto flutuante); a tela arredonda para centavos.
 * Taxas entram em % ao ano e viram taxa mensal equivalente: (1 + a)^(1/12) − 1.
 */

export const taxaMensal = (pctAno: number) => Math.pow(1 + pctAno / 100, 1 / 12) - 1;

/** Juros compostos com aporte no fim de cada mês. */
export function jurosCompostos(e: { inicial: number; mensal: number; taxaAnual: number; anos: number }) {
  const i = taxaMensal(e.taxaAnual);
  const meses = Math.round(e.anos * 12);
  let saldo = e.inicial;
  let investido = e.inicial;
  const serie = [{ ano: 0, saldo, investido }];
  for (let m = 1; m <= meses; m++) {
    saldo = saldo * (1 + i) + e.mensal;
    investido += e.mensal;
    if (m % 12 === 0 || m === meses) serie.push({ ano: m / 12, saldo, investido });
  }
  return { final: saldo, investido, juros: saldo - investido, serie };
}

/**
 * Independência financeira: patrimônio que paga o gasto mensal pela taxa de retirada (regra dos 4% ao ano),
 * e quantos meses faltam com o aporte e a rentabilidade real informados. null se nunca chega (em 100 anos).
 */
export function independencia(e: { gastoMensal: number; taxaRetirada: number; patrimonio: number; aporteMensal: number; rentabilidadeReal: number }) {
  const alvo = e.taxaRetirada > 0 ? (e.gastoMensal * 12) / (e.taxaRetirada / 100) : Infinity;
  if (e.patrimonio >= alvo) return { alvo, meses: 0 };
  const i = taxaMensal(e.rentabilidadeReal);
  let saldo = e.patrimonio;
  for (let m = 1; m <= 1200; m++) {
    saldo = saldo * (1 + i) + e.aporteMensal;
    if (saldo >= alvo) return { alvo, meses: m };
  }
  return { alvo, meses: null };
}

export type Parcela = { n: number; parcela: number; juros: number; amortizacao: number; saldo: number };

/** Financiamento pela tabela Price (parcelas iguais) ou SAC (amortização constante). */
export function financiamento(e: { valor: number; taxaAnual: number; meses: number; sistema: "price" | "sac" }) {
  const i = taxaMensal(e.taxaAnual);
  const n = Math.max(1, Math.round(e.meses));
  const parcelas: Parcela[] = [];
  let saldo = e.valor;
  const pmt = i === 0 ? e.valor / n : (e.valor * i) / (1 - Math.pow(1 + i, -n));
  const amortSac = e.valor / n;
  for (let k = 1; k <= n; k++) {
    const juros = saldo * i;
    const amortizacao = e.sistema === "price" ? pmt - juros : amortSac;
    const parcela = e.sistema === "price" ? pmt : amortSac + juros;
    saldo = Math.max(0, saldo - amortizacao);
    parcelas.push({ n: k, parcela, juros, amortizacao, saldo });
  }
  const totalPago = parcelas.reduce((s, p) => s + p.parcela, 0);
  return { parcelas, totalPago, totalJuros: totalPago - e.valor };
}

/** Quanto guardar por mês para chegar ao alvo em `meses`, rendendo `taxaAnual` (aporte no fim do mês). */
export function quantoGuardar(e: { alvo: number; atual: number; meses: number; taxaAnual: number }) {
  const n = Math.max(1, Math.round(e.meses));
  const i = taxaMensal(e.taxaAnual);
  const futuroDoAtual = e.atual * Math.pow(1 + i, n);
  const falta = e.alvo - futuroDoAtual;
  if (falta <= 0) return 0;
  return i === 0 ? falta / n : (falta * i) / (Math.pow(1 + i, n) - 1);
}
