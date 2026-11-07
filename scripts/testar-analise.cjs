// Testes de recorrências, nota da carteira e diagnóstico. Rode com: npm run test:analise
const ts = require('typescript');
const fs = require('fs');
const path = require('path');
const raiz = path.join(__dirname, '..', 'src', 'lib');
const cache = {};
function carregar(arquivo) {
  if (cache[arquivo]) return cache[arquivo];
  const js = ts.transpileModule(fs.readFileSync(arquivo, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const m = { exports: {} };
  cache[arquivo] = m.exports;
  const req = (nome) => carregar(path.join(path.dirname(arquivo), nome.replace(/^\.\//, '') + '.ts'));
  new Function('module', 'exports', 'require', js)(m, m.exports, req);
  return (cache[arquivo] = m.exports);
}
const R = carregar(path.join(raiz, 'recorrencias.ts'));
const C = carregar(path.join(raiz, 'investimentos', 'calculo.ts'));
const A = carregar(path.join(raiz, 'investimentos', 'analise.ts'));

let ok = 0, falhas = 0;
function eq(nome, obtido, esperado, tol = 0) {
  const passou = typeof esperado === 'number' ? Math.abs(obtido - esperado) <= tol : JSON.stringify(obtido) === JSON.stringify(esperado);
  if (passou) ok++; else { falhas++; console.log('FALHOU', nome, '→ obtido', JSON.stringify(obtido), 'esperado', JSON.stringify(esperado)); }
}

// ---------------- recorrências
const reg = (o) => ({ id: 'r1', tipo: 'despesa', descricao: 'Aluguel', valor_centavos: 150000, frequencia: 'mensal', data_inicio: '2026-01-31', data_fim: null, conta_id: 'c1', conta_destino_id: null, categoria_id: 'k', ativo_id: null, ativa: true, ...o });
eq('mensal dia 31 em fevereiro', R.enesima(reg({}), 1), '2026-02-28');
eq('mensal volta ao 31', R.enesima(reg({}), 2), '2026-03-31');
eq('anual 29/02', R.enesima(reg({ frequencia: 'anual', data_inicio: '2024-02-29' }), 1), '2025-02-28');
eq('semanal', R.enesima(reg({ frequencia: 'semanal', data_inicio: '2026-11-02' }), 2), '2026-11-16');
eq('datas no intervalo', R.datasEntre(reg({ data_inicio: '2026-01-10' }), '2026-03-01', '2026-05-31'), ['2026-03-10', '2026-04-10', '2026-05-10']);
eq('respeita data_fim', R.datasEntre(reg({ data_inicio: '2026-01-10', data_fim: '2026-04-01' }), '2026-01-01', '2026-12-31').length, 3);
const prev = R.ocorrenciasPrevistas([reg({ data_inicio: '2026-10-10' })], [{ recorrencia_id: 'r1', data_ocorrencia: '2026-10-10', situacao: 'confirmada' }], '2026-10-01', '2026-12-31', '2026-11-15');
eq('tira as tratadas', prev.map((o) => o.data), ['2026-11-10', '2026-12-10']);
eq('marca atrasada', prev[0].atrasada, true);
eq('inativa não gera', R.ocorrenciasPrevistas([reg({ ativa: false })], [], '2026-01-01', '2026-12-31', '2026-06-01').length, 0);
const efeito = R.efeitoNoSaldo([
  { recorrencia: reg({}), data: 'x', atrasada: false },
  { recorrencia: reg({ tipo: 'receita', valor_centavos: 500000 }), data: 'x', atrasada: false },
  { recorrencia: reg({ tipo: 'transferencia', conta_destino_id: 'c2', valor_centavos: 10000, categoria_id: null }), data: 'x', atrasada: false },
]);
eq('efeito conta 1', efeito.get('c1'), -150000 + 500000 - 10000);
eq('efeito conta 2', efeito.get('c2'), 10000);
const ocs = R.ocorrenciasPrevistas([reg({ data_inicio: '2026-11-10' })], [], '2026-11-01', '2026-11-30', '2026-11-01');
eq('casa transação parecida', R.casarComPrevista({ conta_id: 'c1', data: '2026-11-12', valor_centavos: -152000 }, ocs)?.data, '2026-11-10');
eq('não casa sentido oposto', R.casarComPrevista({ conta_id: 'c1', data: '2026-11-12', valor_centavos: 150000 }, ocs), null);
eq('não casa valor distante', R.casarComPrevista({ conta_id: 'c1', data: '2026-11-12', valor_centavos: -200000 }, ocs), null);
eq('dia anterior', R.diaAnterior('2026-03-01'), '2026-02-28');

// ---------------- nota e diagnóstico
const cdi = new Map(), selic = new Map(), ipca = new Map();
for (let t = Date.UTC(2024, 0, 1); t < Date.UTC(2026, 10, 6); t += 864e5) {
  const d = new Date(t); if (d.getUTCDay() % 6 === 0) continue;
  const iso = d.toISOString().slice(0, 10); cdi.set(iso, 0.045); selic.set(iso, 0.045);
}
for (let y = 2024; y <= 2026; y++) for (let mm = 1; mm <= 12; mm++) ipca.set(`${y}-${String(mm).padStart(2, '0')}`, 0.35);
const ind = { cdi, selic, ipca };
const ativo = (o) => ({ id: o.id, classe: 'acao', nome: o.id, ticker: o.id.toUpperCase(), tipo_rf: null, indexador: null, taxa: null, vencimento: null, isento_ir: false, arquivado: false, ...o });
const compra = (id, valor, data = '2024-11-05') => ({ id: id + data, ativo_id: id, conta_id: 'c', tipo: 'compra', data, quantidade: 100, valor_centavos: valor, taxas_centavos: 0, ir_centavos: 0, afeta_caixa: true });
const aplic = (id, valor, data = '2024-11-05') => ({ ...compra(id, valor, data), tipo: 'aplicacao', quantidade: null });

// Carteira concentrada e ruim: uma ação que caiu 30% em 2 anos
const ruim = C.montarCarteira({ ativos: [ativo({ id: 'xpto3' })], operacoes: [compra('xpto3', 1000000)], avaliacoes: [], proventos: [], cotacoes: new Map([['XPTO3', 70]]), indices: ind, hoje: '2026-11-05' });
const notaRuim = A.notaCarteira(ruim, {}, 300000, '2026-11-05');
// Carteira diversificada e boa
const ativosBons = [
  ativo({ id: 'sel', classe: 'renda_fixa', ticker: null, tipo_rf: 'tesouro_selic', indexador: 'selic', taxa: 0 }),
  ativo({ id: 'ipc', classe: 'renda_fixa', ticker: null, tipo_rf: 'tesouro_ipca', indexador: 'ipca', taxa: 7 }),
  ativo({ id: 'aaa3' }), ativo({ id: 'bbb3' }), ativo({ id: 'ccc11', classe: 'fii' }), ativo({ id: 'ddd11', classe: 'etf' }),
];
const opsBons = [aplic('sel', 2000000), aplic('ipc', 1000000), compra('aaa3', 500000), compra('bbb3', 500000), compra('ccc11', 500000), compra('ddd11', 500000)];
const boa = C.montarCarteira({ ativos: ativosBons, operacoes: opsBons, avaliacoes: [], proventos: [], cotacoes: new Map([['AAA3', 75], ['BBB3', 70], ['CCC11', 68], ['DDD11', 72]]), indices: ind, hoje: '2026-11-05' });
const notaBoa = A.notaCarteira(boa, { rf_pos: 40, rf_ipca: 20, acoes: 20, fiis: 10, etfs: 10 }, 300000, '2026-11-05');
eq('nota ruim baixa', notaRuim.nota < 4, true);
eq('nota boa alta', notaBoa.nota >= 7, true);
eq('nota 0–10', notaBoa.nota <= 10 && notaRuim.nota >= 0, true);
eq('5 critérios', notaBoa.criterios.length, 5);
eq('soma dos pesos 10', notaBoa.criterios.reduce((s, k) => s + k.peso, 0), 10);
eq('reserva cheia na boa (20k ≥ 6×3k)', notaBoa.criterios.find((k) => k.id === 'reserva').pontos, 2);
eq('sem gasto: reserva neutra', A.notaCarteira(boa, {}, null, '2026-11-05').criterios.find((k) => k.id === 'reserva').pontos, 1);

const dRuim = A.diagnosticar(ruim.posicoes[0], ruim.totalCentavos, '2026-11-05');
eq('ação que caiu: revisar', dRuim.status, 'revisar');
eq('aponta concentração', dRuim.sinais.some((s) => s.texto.includes('Representa')), true);
const dSel = A.diagnosticar(boa.posicoes.find((p) => p.ativo.id === 'sel'), boa.totalCentavos, '2026-11-05');
eq('tesouro selic em dia', dSel.status, 'em_dia');
eq('selic ~ 100% do CDI', dSel.fracaoDoCdi, 1, 0.02);
const cdbFraco = C.montarCarteira({ ativos: [ativo({ id: 'cdb', classe: 'renda_fixa', ticker: null, tipo_rf: 'cdb', indexador: 'pos_cdi', taxa: 80 })], operacoes: [aplic('cdb', 1000000)], avaliacoes: [], proventos: [], cotacoes: new Map(), indices: ind, hoje: '2026-11-05' });
const dCdb = A.diagnosticar(cdbFraco.posicoes[0], cdbFraco.totalCentavos, '2026-11-05');
eq('CDB 80% CDI: atenção', dCdb.status, 'atencao');
eq('CDB 80% entrega ~80% do CDI', dCdb.fracaoDoCdi, 0.8, 0.02);

eq('gasto médio ignora mês atual', A.gastoMensalMedio([
  { data: '2026-09-10', valor_centavos: 300000 }, { data: '2026-10-10', valor_centavos: 500000 }, { data: '2026-11-02', valor_centavos: 999999 },
], '2026-11-05'), 400000);
eq('gasto médio com 1 mês = null', A.gastoMensalMedio([{ data: '2026-10-10', valor_centavos: 1 }], '2026-11-05'), null);

console.log(`${ok} ok, ${falhas} falha(s)`);
process.exit(falhas ? 1 : 0);
