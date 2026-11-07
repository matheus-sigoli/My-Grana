/**
 * Cálculos da carteira de investimentos (ADR-0007). Módulo puro: sem rede, sem banco.
 * Dinheiro em centavos (inteiros); taxas em %; datas ISO "YYYY-MM-DD".
 * Tudo aqui é ESTIMATIVA para acompanhamento pessoal — não substitui extrato nem contador.
 */

export type Classe = "acao" | "fii" | "etf" | "bdr" | "cripto" | "fundo" | "previdencia" | "renda_fixa";
export type TipoRF =
  | "cdb" | "lci" | "lca" | "lc" | "tesouro_selic" | "tesouro_prefixado" | "tesouro_ipca"
  | "debenture" | "cri" | "cra" | "poupanca" | "outro";
export type Indexador = "pos_cdi" | "selic" | "pre" | "ipca";
export type TipoOperacao = "compra" | "venda" | "aplicacao" | "resgate";
export type TipoProvento = "dividendo" | "jcp" | "rendimento" | "juros" | "amortizacao";
export type Grupo = "rf_pos" | "rf_pre" | "rf_ipca" | "acoes" | "fiis" | "etfs" | "bdrs" | "fundos" | "previdencia" | "cripto";

export const GRUPOS: Grupo[] = ["rf_pos", "rf_pre", "rf_ipca", "acoes", "fiis", "etfs", "bdrs", "fundos", "previdencia", "cripto"];

export type Ativo = {
  id: string;
  classe: Classe;
  nome: string;
  ticker: string | null;
  tipo_rf: TipoRF | null;
  indexador: Indexador | null;
  taxa: number | null;
  vencimento: string | null;
  isento_ir: boolean;
  arquivado: boolean;
};

export type Operacao = {
  id: string;
  ativo_id: string;
  conta_id: string;
  tipo: TipoOperacao;
  data: string;
  quantidade: number | null;
  valor_centavos: number;
  taxas_centavos: number;
  ir_centavos: number;
  afeta_caixa: boolean;
  created_at?: string;
};

export type Avaliacao = { id?: string; ativo_id: string; data: string; valor_centavos: number };
export type Provento = { id?: string; ativo_id: string; conta_id?: string; tipo: TipoProvento; data: string; valor_centavos: number };

/** Séries oficiais: CDI e Selic em % ao dia por dia útil (data ISO); IPCA em % ao mês ("YYYY-MM"). */
export type Indices = { cdi: Map<string, number>; selic: Map<string, number>; ipca: Map<string, number> };
/** Preço atual em reais por ticker (B3) ou símbolo (cripto). */
export type Cotacoes = Map<string, number>;

export const RENDA_VARIAVEL: Classe[] = ["acao", "fii", "etf", "bdr", "cripto"];
export const ehRendaVariavel = (c: Classe) => RENDA_VARIAVEL.includes(c);

/* ------------------------------------------------------------------ datas */

const DIA = 86_400_000;
const paraMs = (iso: string) => Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10));
const paraIso = (ms: number) => new Date(ms).toISOString().slice(0, 10);
const ehDiaUtil = (ms: number) => {
  const d = new Date(ms).getUTCDay();
  return d !== 0 && d !== 6;
};
export const diasEntre = (a: string, b: string) => Math.round((paraMs(b) - paraMs(a)) / DIA);
const diasNoMes = (anoMes: string) => new Date(Date.UTC(+anoMes.slice(0, 4), +anoMes.slice(5, 7), 0)).getUTCDate();

/** Dias úteis aproximados (seg–sex, sem feriados) em [a, b). */
export function diasUteis(a: string, b: string) {
  let n = 0;
  for (let t = paraMs(a), fim = paraMs(b); t < fim; t += DIA) if (ehDiaUtil(t)) n++;
  return n;
}

/* ---------------------------------------------------------------- fatores */

/** Produto diário de uma série (% a.d.), aplicando `mult` sobre a taxa; dias após o último dado usam a última taxa. */
function fatorSerieDiaria(serie: Map<string, number>, a: string, b: string, mult: number) {
  if (serie.size === 0) return 1;
  let ultimaData = "";
  let ultimaTaxa = 0;
  for (const [d, v] of serie) if (d > ultimaData) { ultimaData = d; ultimaTaxa = v; }
  let f = 1;
  for (let t = paraMs(a), fim = paraMs(b); t < fim; t += DIA) {
    const iso = paraIso(t);
    const taxa = serie.get(iso) ?? (iso > ultimaData && ehDiaUtil(t) ? ultimaTaxa : undefined);
    if (taxa !== undefined) f *= 1 + (taxa / 100) * mult;
  }
  return f;
}

/** Fator do IPCA entre a e b, pró-rata por dias corridos; meses sem dado usam o último IPCA conhecido. */
function fatorIpca(ipca: Map<string, number>, a: string, b: string) {
  if (ipca.size === 0) return 1;
  const meses = [...ipca.keys()].sort();
  const ultimo = ipca.get(meses[meses.length - 1])!;
  let f = 1;
  for (let t = paraMs(a), fim = paraMs(b); t < fim; t += DIA) {
    const m = paraIso(t).slice(0, 7);
    const taxa = ipca.get(m) ?? (m > meses[meses.length - 1] ? ultimo : 0);
    f *= Math.pow(1 + taxa / 100, 1 / diasNoMes(m));
  }
  return f;
}

const fatorPre = (taxaAA: number, a: string, b: string) => Math.pow(1 + taxaAA / 100, diasUteis(a, b) / 252);

/** Quanto R$ 1 aplicado em `a` vale em `b` neste ativo. Após o vencimento, o valor para de render. */
export function fatorAtivo(ativo: Ativo, a: string, b: string, ind: Indices) {
  if (ativo.vencimento && b > ativo.vencimento) b = ativo.vencimento;
  if (b <= a || ativo.classe !== "renda_fixa" || !ativo.indexador) return 1;
  const taxa = Number(ativo.taxa ?? 0);
  switch (ativo.indexador) {
    case "pos_cdi":
      return fatorSerieDiaria(ind.cdi, a, b, taxa / 100);
    case "selic":
      return fatorSerieDiaria(ind.selic, a, b, 1) * fatorPre(taxa, a, b);
    case "pre":
      return fatorPre(taxa, a, b);
    case "ipca":
      return fatorIpca(ind.ipca, a, b) * fatorPre(taxa, a, b);
  }
}

/** Fatores de referência para comparação: 100% do CDI e inflação (IPCA). */
export const fatorCdi100 = (ind: Indices, a: string, b: string) => (b <= a ? 1 : fatorSerieDiaria(ind.cdi, a, b, 1));
export const fatorInflacao = (ind: Indices, a: string, b: string) => (b <= a ? 1 : fatorIpca(ind.ipca, a, b));

/* ------------------------------------------------------------- impostos */

const TIPOS_ISENTOS: TipoRF[] = ["lci", "lca", "cri", "cra", "poupanca"];
export const rfIsenta = (a: Ativo) => a.isento_ir || (a.tipo_rf !== null && TIPOS_ISENTOS.includes(a.tipo_rf));

/** Tabela regressiva da renda fixa (% sobre o ganho) pelo prazo da aplicação. */
export function aliquotaRegressiva(dias: number) {
  if (dias <= 180) return 22.5;
  if (dias <= 360) return 20;
  if (dias <= 720) return 17.5;
  return 15;
}

/* --------------------------------------------------------------- posições */

export type Fonte = "cotacao" | "avaliacao" | "calculado" | "custo";

export type Posicao = {
  ativo: Ativo;
  grupo: Grupo;
  valorCentavos: number;
  /** Quanto ainda está "aplicado" (custo das cotas restantes na RV; aportes − resgates na RF/fundos). */
  investidoCentavos: number;
  ganhoCentavos: number;
  fonte: Fonte;
  quantidade: number | null;
  precoMedioCentavos: number | null;
  cotacao: number | null;
  irEstimadoCentavos: number | null;
  proventosCentavos: number;
  proventos12mCentavos: number;
  vencido: boolean;
  /** Fluxos do ativo: tudo que entrou, tudo que saiu (vendas/resgates líquidos + proventos), taxas pagas. */
  aportesCentavos: number;
  retiradasCentavos: number;
  taxasCentavos: number;
  /** Resultado total = valor atual + retiradas − aportes (inclui ganhos já realizados e proventos). */
  resultadoCentavos: number;
  /** O mesmo dinheiro, nas mesmas datas, a 100% do CDI / corrigido pela inflação. */
  equivalenteCdiCentavos: number;
  equivalenteInflacaoCentavos: number;
  primeiraData: string | null;
};

export function grupoDoAtivo(a: Ativo): Grupo {
  switch (a.classe) {
    case "acao": return "acoes";
    case "fii": return "fiis";
    case "etf": return "etfs";
    case "bdr": return "bdrs";
    case "cripto": return "cripto";
    case "fundo": return "fundos";
    case "previdencia": return "previdencia";
    case "renda_fixa":
      return a.indexador === "pre" ? "rf_pre" : a.indexador === "ipca" ? "rf_ipca" : "rf_pos";
  }
}

const porData = (x: { data: string; created_at?: string }, y: { data: string; created_at?: string }) =>
  x.data === y.data ? (x.created_at ?? "").localeCompare(y.created_at ?? "") : x.data.localeCompare(y.data);

export type VendaRV = { data: string; classe: Classe; valorBrutoCentavos: number; ganhoCentavos: number };

/** Preço médio (regra brasileira: venda não altera o PM) e ganhos realizados. */
export function posicaoRendaVariavel(ativo: Ativo, ops: Operacao[]) {
  let qtd = 0;
  let custo = 0; // centavos, inclui taxas de compra
  const vendas: VendaRV[] = [];
  for (const o of [...ops].sort(porData)) {
    const q = Number(o.quantidade ?? 0);
    if (o.tipo === "compra") {
      qtd += q;
      custo += o.valor_centavos + o.taxas_centavos;
    } else if (o.tipo === "venda" && qtd > 0) {
      const qVendida = Math.min(q, qtd);
      const custoVendido = (custo / qtd) * qVendida;
      const liquido = o.valor_centavos - o.taxas_centavos;
      vendas.push({ data: o.data, classe: ativo.classe, valorBrutoCentavos: o.valor_centavos, ganhoCentavos: Math.round(liquido - custoVendido) });
      qtd -= qVendida;
      custo -= custoVendido;
      if (qtd < 1e-9) { qtd = 0; custo = 0; }
    }
  }
  return { quantidade: qtd, custoCentavos: Math.round(custo), precoMedioCentavos: qtd > 0 ? Math.round(custo / qtd) : null, vendas };
}

/** Valor de renda fixa / fundo / previdência: última avaliação (se houver) + fluxos posteriores, cada um corrigido até hoje. */
export function valorPorFluxos(ativo: Ativo, ops: Operacao[], avals: Avaliacao[], hoje: string, ind: Indices) {
  const aval = avals.filter((v) => v.data <= hoje).sort((x, y) => y.data.localeCompare(x.data))[0];
  let valor = aval ? aval.valor_centavos * fatorAtivo(ativo, aval.data, hoje, ind) : 0;
  for (const o of ops) {
    if (o.data > hoje || (aval && o.data <= aval.data)) continue;
    const sinal = o.tipo === "aplicacao" ? 1 : o.tipo === "resgate" ? -1 : 0;
    valor += sinal * o.valor_centavos * fatorAtivo(ativo, o.data, hoje, ind);
  }
  return { valorCentavos: Math.max(0, Math.round(valor)), fonte: (aval ? "avaliacao" : ativo.classe === "renda_fixa" ? "calculado" : "custo") as Fonte };
}

/** IR estimado se resgatasse hoje (renda fixa: tabela regressiva por aplicação; fundos: 15% do ganho). */
export function irEstimadoPorFluxos(ativo: Ativo, ops: Operacao[], valorAtual: number, hoje: string, ind: Indices): number | null {
  if (ativo.classe === "previdencia") return null; // depende do regime (progressivo/regressivo)
  const aplic = ops.filter((o) => o.tipo === "aplicacao" && o.data <= hoje);
  const resg = ops.filter((o) => o.tipo === "resgate" && o.data <= hoje);
  if (ativo.classe === "fundo") {
    const liquidoAplicado = aplic.reduce((s, o) => s + o.valor_centavos, 0) - resg.reduce((s, o) => s + o.valor_centavos, 0);
    return Math.max(0, Math.round((valorAtual - liquidoAplicado) * 0.15));
  }
  if (rfIsenta(ativo)) return 0;
  let projetado = 0;
  let imposto = 0;
  for (const o of aplic) {
    const f = fatorAtivo(ativo, o.data, hoje, ind);
    projetado += o.valor_centavos * f;
    const ganho = o.valor_centavos * (f - 1);
    if (ganho > 0) imposto += ganho * (aliquotaRegressiva(diasEntre(o.data, hoje)) / 100);
  }
  if (projetado <= 0) return 0;
  // Resgates e ajustes manuais mudam o saldo: aplica o imposto na proporção do que sobrou.
  const k = Math.min(1.5, Math.max(0, valorAtual / projetado));
  return Math.round(imposto * k);
}

/* ---------------------------------------------------------------- carteira */

export type Entrada = {
  ativos: Ativo[];
  operacoes: Operacao[];
  avaliacoes: Avaliacao[];
  proventos: Provento[];
  cotacoes: Cotacoes;
  indices: Indices;
  hoje: string;
};

export type ApuracaoMes = {
  mes: string;
  linhas: { grupo: "acoes" | "fii" | "etf_bdr" | "cripto"; vendasCentavos: number; ganhoCentavos: number; isento: boolean; aliquota: number; impostoCentavos: number }[];
  darfCentavos: number;
};

export type Carteira = {
  posicoes: Posicao[];
  totalCentavos: number;
  porGrupo: Record<Grupo, number>;
  aportesCentavos: number;
  retiradasCentavos: number;
  proventosCentavos: number;
  ganhoCentavos: number;
  equivalenteCdiCentavos: number;
  equivalenteInflacaoCentavos: number;
  irRendaFixaCentavos: number;
  apuracaoRV: ApuracaoMes[];
  proventosPorMes: { mes: string; valorCentavos: number }[];
  vencimentos: { ativo: Ativo; vencimento: string; dias: number; valorCentavos: number }[];
};

const somaAte = (dataLimite: string) => (o: { data: string }) => o.data <= dataLimite;

export function montarCarteira(e: Entrada): Carteira {
  const { ativos, operacoes, avaliacoes, proventos, cotacoes, indices: ind, hoje } = e;
  const opsPorAtivo = agruparPor(operacoes.filter(somaAte(hoje)), (o) => o.ativo_id);
  const avalsPorAtivo = agruparPor(avaliacoes, (a) => a.ativo_id);
  const provPorAtivo = agruparPor(proventos.filter(somaAte(hoje)), (p) => p.ativo_id);
  const umAnoAtras = paraIso(paraMs(hoje) - 365 * DIA);

  const posicoes: Posicao[] = [];
  const vendasRV: VendaRV[] = [];

  for (const ativo of ativos) {
    const ops = opsPorAtivo.get(ativo.id) ?? [];
    const avals = avalsPorAtivo.get(ativo.id) ?? [];
    const provs = provPorAtivo.get(ativo.id) ?? [];
    const proventosCentavos = provs.reduce((s, p) => s + p.valor_centavos, 0);
    const proventos12mCentavos = provs.filter((p) => p.data > umAnoAtras).reduce((s, p) => s + p.valor_centavos, 0);
    const vencido = !!ativo.vencimento && ativo.vencimento < hoje;
    const fl = fluxosDoAtivo(ops, provs, ind, hoje);

    if (ehRendaVariavel(ativo.classe)) {
      const p = posicaoRendaVariavel(ativo, ops);
      vendasRV.push(...p.vendas);
      const cot = ativo.ticker ? cotacoes.get(ativo.ticker) ?? null : null;
      const ultimaAval = [...avals].sort((x, y) => y.data.localeCompare(x.data))[0];
      let valor = p.custoCentavos;
      let fonte: Fonte = "custo";
      if (p.quantidade === 0) valor = 0;
      else if (cot !== null) { valor = Math.round(p.quantidade * cot * 100); fonte = "cotacao"; }
      else if (ultimaAval) { valor = ultimaAval.valor_centavos; fonte = "avaliacao"; }
      posicoes.push({
        ativo, grupo: grupoDoAtivo(ativo), valorCentavos: valor, investidoCentavos: p.custoCentavos,
        ganhoCentavos: valor - p.custoCentavos, fonte, quantidade: p.quantidade, precoMedioCentavos: p.precoMedioCentavos,
        cotacao: cot, irEstimadoCentavos: null, proventosCentavos, proventos12mCentavos, vencido,
        ...fl, resultadoCentavos: valor + fl.retiradasCentavos - fl.aportesCentavos,
      });
    } else {
      const { valorCentavos, fonte } = valorPorFluxos(ativo, ops, avals, hoje, ind);
      const aplicado = ops.filter((o) => o.tipo === "aplicacao").reduce((s, o) => s + o.valor_centavos + o.taxas_centavos, 0);
      const resgatado = ops.filter((o) => o.tipo === "resgate").reduce((s, o) => s + o.valor_centavos, 0);
      const investido = Math.max(0, aplicado - resgatado);
      posicoes.push({
        ativo, grupo: grupoDoAtivo(ativo), valorCentavos, investidoCentavos: investido,
        ganhoCentavos: valorCentavos - investido, fonte, quantidade: null, precoMedioCentavos: null, cotacao: null,
        irEstimadoCentavos: irEstimadoPorFluxos(ativo, ops, valorCentavos, hoje, ind), proventosCentavos, proventos12mCentavos, vencido,
        ...fl, resultadoCentavos: valorCentavos + fl.retiradasCentavos - fl.aportesCentavos,
      });
    }
  }

  const porGrupo = Object.fromEntries(GRUPOS.map((g) => [g, 0])) as Record<Grupo, number>;
  for (const p of posicoes) porGrupo[p.grupo] += p.valorCentavos;
  const totalCentavos = posicoes.reduce((s, p) => s + p.valorCentavos, 0);

  // Fluxos da carteira inteira (para rentabilidade e comparação com CDI/inflação).
  let aportes = 0, retiradas = 0, eqCdi = 0, eqInfl = 0;
  for (const o of operacoes.filter(somaAte(hoje))) {
    const entra = o.tipo === "compra" || o.tipo === "aplicacao";
    const v = entra ? o.valor_centavos + o.taxas_centavos : o.valor_centavos - o.taxas_centavos - o.ir_centavos;
    if (entra) aportes += v; else retiradas += v;
    const s = entra ? 1 : -1;
    eqCdi += s * v * fatorCdi100(ind, o.data, hoje);
    eqInfl += s * v * fatorInflacao(ind, o.data, hoje);
  }
  const proventosTotal = proventos.filter(somaAte(hoje)).reduce((s, p) => s + p.valor_centavos, 0);
  for (const p of proventos.filter(somaAte(hoje))) {
    eqCdi -= p.valor_centavos * fatorCdi100(ind, p.data, hoje);
    eqInfl -= p.valor_centavos * fatorInflacao(ind, p.data, hoje);
  }

  const proventosPorMesMap = new Map<string, number>();
  for (const p of proventos.filter(somaAte(hoje))) proventosPorMesMap.set(p.data.slice(0, 7), (proventosPorMesMap.get(p.data.slice(0, 7)) ?? 0) + p.valor_centavos);

  const vencimentos = posicoes
    .filter((p) => p.ativo.vencimento && p.valorCentavos > 0)
    .map((p) => ({ ativo: p.ativo, vencimento: p.ativo.vencimento!, dias: diasEntre(hoje, p.ativo.vencimento!), valorCentavos: p.valorCentavos }))
    .sort((x, y) => x.vencimento.localeCompare(y.vencimento));

  return {
    posicoes,
    totalCentavos,
    porGrupo,
    aportesCentavos: aportes,
    retiradasCentavos: retiradas,
    proventosCentavos: proventosTotal,
    ganhoCentavos: totalCentavos + retiradas + proventosTotal - aportes,
    equivalenteCdiCentavos: Math.round(eqCdi),
    equivalenteInflacaoCentavos: Math.round(eqInfl),
    irRendaFixaCentavos: posicoes.reduce((s, p) => s + (p.irEstimadoCentavos ?? 0), 0),
    apuracaoRV: apurarRendaVariavel(vendasRV),
    proventosPorMes: [...proventosPorMesMap.entries()].sort().map(([mes, valorCentavos]) => ({ mes, valorCentavos })),
    vencimentos,
  };
}

/** Apuração mensal da renda variável (regras gerais; sem day trade e sem compensar prejuízo entre meses). */
export function apurarRendaVariavel(vendas: VendaRV[]): ApuracaoMes[] {
  const porMes = agruparPor(vendas, (v) => v.data.slice(0, 7));
  const meses: ApuracaoMes[] = [];
  for (const [mes, vs] of [...porMes.entries()].sort()) {
    const soma = (f: (v: VendaRV) => boolean) => ({
      vendas: vs.filter(f).reduce((s, v) => s + v.valorBrutoCentavos, 0),
      ganho: vs.filter(f).reduce((s, v) => s + v.ganhoCentavos, 0),
    });
    const acoes = soma((v) => v.classe === "acao");
    const fii = soma((v) => v.classe === "fii");
    const etfBdr = soma((v) => v.classe === "etf" || v.classe === "bdr");
    const cripto = soma((v) => v.classe === "cripto");
    const linha = (grupo: ApuracaoMes["linhas"][number]["grupo"], x: { vendas: number; ganho: number }, aliquota: number, limiteIsencao: number | null) => {
      const isento = limiteIsencao !== null && x.vendas <= limiteIsencao;
      return { grupo, vendasCentavos: x.vendas, ganhoCentavos: x.ganho, isento, aliquota, impostoCentavos: isento ? 0 : Math.round(Math.max(0, x.ganho) * (aliquota / 100)) };
    };
    const linhas = [
      linha("acoes", acoes, 15, 2_000_000),
      linha("fii", fii, 20, null),
      linha("etf_bdr", etfBdr, 15, null),
      linha("cripto", cripto, 15, 3_500_000),
    ].filter((l) => l.vendasCentavos > 0);
    meses.push({ mes, linhas, darfCentavos: linhas.reduce((s, l) => s + l.impostoCentavos, 0) });
  }
  return meses;
}

/** Divide um aporte entre os grupos para aproximar a carteira do alvo (só compra, nunca vende). */
export function rebalancear(atual: Record<Grupo, number>, alvoPct: Partial<Record<Grupo, number>>, aporteCentavos: number) {
  const total = GRUPOS.reduce((s, g) => s + atual[g], 0) + aporteCentavos;
  const deficit = Object.fromEntries(
    GRUPOS.map((g) => [g, Math.max(0, ((alvoPct[g] ?? 0) / 100) * total - atual[g])]),
  ) as Record<Grupo, number>;
  const somaDef = GRUPOS.reduce((s, g) => s + deficit[g], 0);
  const somaAlvo = GRUPOS.reduce((s, g) => s + (alvoPct[g] ?? 0), 0);
  const bruto = Object.fromEntries(
    GRUPOS.map((g) => {
      if (aporteCentavos <= 0) return [g, 0];
      if (somaDef >= aporteCentavos) return [g, (aporteCentavos * deficit[g]) / somaDef];
      // Cobre todos os déficits; o que sobra segue a proporção do alvo.
      const sobra = aporteCentavos - somaDef;
      return [g, deficit[g] + (somaAlvo > 0 ? (sobra * (alvoPct[g] ?? 0)) / somaAlvo : 0)];
    }),
  ) as Record<Grupo, number>;
  // Arredonda para centavos sem perder nem criar dinheiro.
  const res = Object.fromEntries(GRUPOS.map((g) => [g, Math.floor(bruto[g])])) as Record<Grupo, number>;
  let resto = aporteCentavos - GRUPOS.reduce((s, g) => s + res[g], 0);
  for (const g of [...GRUPOS].sort((x, y) => (bruto[y] - Math.floor(bruto[y])) - (bruto[x] - Math.floor(bruto[x])))) {
    if (resto <= 0) break;
    if (bruto[g] > 0) { res[g] += 1; resto -= 1; }
  }
  return res;
}

/** Fluxos de um ativo e seus equivalentes no CDI e na inflação. */
function fluxosDoAtivo(ops: Operacao[], provs: Provento[], ind: Indices, hoje: string) {
  let aportes = 0, retiradas = 0, taxas = 0, eqCdi = 0, eqInfl = 0;
  let primeira: string | null = null;
  for (const o of ops) {
    if (!primeira || o.data < primeira) primeira = o.data;
    const entra = o.tipo === "compra" || o.tipo === "aplicacao";
    const v = entra ? o.valor_centavos + o.taxas_centavos : o.valor_centavos - o.taxas_centavos - o.ir_centavos;
    taxas += o.taxas_centavos;
    if (entra) aportes += v; else retiradas += v;
    eqCdi += (entra ? 1 : -1) * v * fatorCdi100(ind, o.data, hoje);
    eqInfl += (entra ? 1 : -1) * v * fatorInflacao(ind, o.data, hoje);
  }
  for (const p of provs) {
    retiradas += p.valor_centavos;
    eqCdi -= p.valor_centavos * fatorCdi100(ind, p.data, hoje);
    eqInfl -= p.valor_centavos * fatorInflacao(ind, p.data, hoje);
  }
  return {
    aportesCentavos: aportes,
    retiradasCentavos: retiradas,
    taxasCentavos: taxas,
    equivalenteCdiCentavos: Math.round(eqCdi),
    equivalenteInflacaoCentavos: Math.round(eqInfl),
    primeiraData: primeira,
  };
}

function agruparPor<T>(lista: T[], chave: (x: T) => string) {
  const m = new Map<string, T[]>();
  for (const x of lista) {
    const k = chave(x);
    const arr = m.get(k);
    if (arr) arr.push(x); else m.set(k, [x]);
  }
  return m;
}
