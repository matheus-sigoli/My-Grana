// Testes do módulo de cálculo de investimentos. Rode com: npm run test:calculo
const ts = require('typescript');
const fs = require('fs');
const src = fs.readFileSync(require('path').join(__dirname, '..', 'src', 'lib', 'investimentos', 'calculo.ts'), 'utf8');
const js = ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const m = { exports: {} };
new Function('module', 'exports', js)(m, m.exports);
const C = m.exports;

let ok = 0, falhas = 0;
function eq(nome, obtido, esperado, tol = 0) {
  const passou = typeof esperado === 'number' ? Math.abs(obtido - esperado) <= tol : JSON.stringify(obtido) === JSON.stringify(esperado);
  if (passou) ok++; else { falhas++; console.log('FALHOU', nome, '→ obtido', obtido, 'esperado', esperado); }
}

// séries sintéticas: CDI 0,05% a.d. em todo dia útil de 2025-2026; IPCA 0,4% a.m.
const cdi = new Map(), selic = new Map(), ipca = new Map();
for (let t = Date.UTC(2025, 0, 1); t < Date.UTC(2026, 10, 1); t += 864e5) {
  const d = new Date(t); if (d.getUTCDay() % 6 === 0) continue;
  const iso = d.toISOString().slice(0, 10); cdi.set(iso, 0.05); selic.set(iso, 0.05);
}
for (let y = 2025; y <= 2026; y++) for (let mm = 1; mm <= 12; mm++) { const k = `${y}-${String(mm).padStart(2, '0')}`; if (k <= '2026-09') ipca.set(k, 0.4); }
const ind = { cdi, selic, ipca };
const vazio = { cdi: new Map(), selic: new Map(), ipca: new Map() };

const rf = (o) => ({ id: 'rf', classe: 'renda_fixa', nome: 'RF', ticker: null, tipo_rf: 'cdb', indexador: 'pre', taxa: 10, vencimento: null, isento_ir: false, arquivado: false, ...o });
const op = (o) => ({ id: Math.random() + '', ativo_id: 'rf', conta_id: 'c', tipo: 'aplicacao', data: '2025-01-06', quantidade: null, valor_centavos: 100000, taxas_centavos: 0, ir_centavos: 0, afeta_caixa: true, ...o });

// 1. dias úteis
eq('dias úteis semana', C.diasUteis('2026-11-02', '2026-11-09'), 5);

// 2. pré 10% a.a. em exatamente 252 dias úteis = 1,10
let b = '2025-01-06', t = Date.UTC(2025, 0, 6);
while (C.diasUteis('2025-01-06', b) < 252) { t += 864e5; b = new Date(t).toISOString().slice(0, 10); }
eq('pré 252du', C.fatorAtivo(rf({}), '2025-01-06', b, ind), 1.10, 1e-9);

// 3. 110% do CDI por 10 dias úteis = (1+0,0005*1,1)^10
eq('110% CDI', C.fatorAtivo(rf({ indexador: 'pos_cdi', taxa: 110 }), '2025-03-03', '2025-03-17', ind), Math.pow(1.00055, 10), 1e-12);

// 4. dias após o fim da série usam a última taxa (série vai até 31/10/2026)
eq('CDI extrapola', C.fatorAtivo(rf({ indexador: 'pos_cdi', taxa: 100 }), '2026-11-02', '2026-11-09', ind), Math.pow(1.0005, 5), 1e-12);

// 5. vencimento congela o valor
eq('vencido não rende', C.fatorAtivo(rf({ vencimento: '2025-01-06' }), '2025-01-06', '2026-01-01', ind), 1);

// 6. IPCA+ 0% num mês cheio = 0,4%
eq('IPCA mês cheio', C.fatorAtivo(rf({ indexador: 'ipca', taxa: 0 }), '2025-03-01', '2025-04-01', ind), 1.004, 1e-9);

// 7. valor por fluxos: aplicação 1000 a 10% a.a. por 252du = 1100; resgate de 500 no meio
eq('valor RF', C.valorPorFluxos(rf({}), [op({})], [], b, ind).valorCentavos, 110000);
const meio = '2025-07-01';
const comResg = C.valorPorFluxos(rf({}), [op({}), op({ tipo: 'resgate', data: meio, valor_centavos: 50000 })], [], b, ind).valorCentavos;
eq('valor RF com resgate', comResg, Math.round(110000 - 50000 * C.fatorAtivo(rf({}), meio, b, ind)));

// 8. avaliação manual substitui o passado
const v8 = C.valorPorFluxos(rf({}), [op({})], [{ ativo_id: 'rf', data: meio, valor_centavos: 120000 }], b, ind);
eq('avaliação manual', v8.valorCentavos, Math.round(120000 * C.fatorAtivo(rf({}), meio, b, ind)));
eq('fonte avaliação', v8.fonte, 'avaliacao');

// 9. alíquotas
eq('IR 180d', C.aliquotaRegressiva(180), 22.5); eq('IR 181d', C.aliquotaRegressiva(181), 20);
eq('IR 721d', C.aliquotaRegressiva(721), 15);

// 10. IR estimado RF: ganho 100 com mais de 252du (≈ 1 ano e pouco → 20% se ≤360 dias corridos)
const dias = C.diasEntre('2025-01-06', b);
const aliq = C.aliquotaRegressiva(dias) / 100;
eq('IR RF', C.irEstimadoPorFluxos(rf({}), [op({})], 110000, b, ind), Math.round(10000 * aliq));
eq('LCI isenta', C.irEstimadoPorFluxos(rf({ tipo_rf: 'lci' }), [op({})], 110000, b, ind), 0);

// 11. preço médio e ganho na venda
const acao = { id: 'a', classe: 'acao', nome: 'X', ticker: 'XXXX3', tipo_rf: null, indexador: null, taxa: null, vencimento: null, isento_ir: false, arquivado: false };
const opsA = [
  op({ ativo_id: 'a', tipo: 'compra', data: '2026-01-10', quantidade: 100, valor_centavos: 100000, taxas_centavos: 1000 }),
  op({ ativo_id: 'a', tipo: 'compra', data: '2026-02-10', quantidade: 100, valor_centavos: 200000 }),
  op({ ativo_id: 'a', tipo: 'venda', data: '2026-03-10', quantidade: 50, valor_centavos: 150000, taxas_centavos: 500 }),
];
const pA = C.posicaoRendaVariavel(acao, opsA);
eq('qtd', pA.quantidade, 150); eq('PM', pA.precoMedioCentavos, 1505); eq('custo restante', pA.custoCentavos, 225750);
eq('ganho venda', pA.vendas[0].ganhoCentavos, 74250);

// 12. apuração: ações isentas abaixo de 20 mil; FII 20%
const ap = C.apurarRendaVariavel([
  { data: '2026-03-10', classe: 'acao', valorBrutoCentavos: 150000, ganhoCentavos: 74250 },
  { data: '2026-04-10', classe: 'acao', valorBrutoCentavos: 3000000, ganhoCentavos: 100000 },
  { data: '2026-04-15', classe: 'fii', valorBrutoCentavos: 50000, ganhoCentavos: 10000 },
]);
eq('março isento', ap[0].darfCentavos, 0);
eq('abril DARF', ap[1].darfCentavos, 15000 + 2000);

// 13. rebalanceamento
const zero = Object.fromEntries(C.GRUPOS.map((g) => [g, 0]));
const r1 = C.rebalancear({ ...zero, acoes: 7000, rf_pos: 3000 }, { acoes: 50, rf_pos: 50 }, 2000);
eq('rebal só déficit', [r1.acoes, r1.rf_pos], [0, 2000]);
const r2 = C.rebalancear({ ...zero, acoes: 7000, rf_pos: 3000 }, { acoes: 50, rf_pos: 50 }, 20000);
eq('rebal cobre e divide', [r2.acoes, r2.rf_pos], [8000, 12000]);
const r3 = C.rebalancear(zero, { acoes: 33.33, fiis: 33.33, rf_pos: 33.34 }, 10001);
eq('rebal soma exata', C.GRUPOS.reduce((s, g) => s + r3[g], 0), 10001);

// 14. carteira inteira com índices zerados: equivalente CDI = fluxo líquido
const cart = C.montarCarteira({ ativos: [acao], operacoes: opsA, avaliacoes: [], proventos: [{ ativo_id: 'a', tipo: 'dividendo', data: '2026-04-01', valor_centavos: 3000 }], cotacoes: new Map([['XXXX3', 25]]), indices: vazio, hoje: '2026-11-05' });
eq('valor a mercado', cart.totalCentavos, 150 * 2500);
eq('aportes', cart.aportesCentavos, 301000);
eq('retiradas', cart.retiradasCentavos, 149500);
eq('ganho total', cart.ganhoCentavos, 375000 + 149500 + 3000 - 301000);
eq('equivalente CDI sem juros', cart.equivalenteCdiCentavos, 301000 - 149500 - 3000);
eq('grupo', cart.porGrupo.acoes, 375000);

// 15. sem cotação: usa custo e sinaliza
const semCot = C.montarCarteira({ ativos: [acao], operacoes: opsA, avaliacoes: [], proventos: [], cotacoes: new Map(), indices: vazio, hoje: '2026-11-05' });
eq('fonte custo', semCot.posicoes[0].fonte, 'custo');

console.log(`${ok} ok, ${falhas} falha(s)`);
process.exit(falhas ? 1 : 0);
