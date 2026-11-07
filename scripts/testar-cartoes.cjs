// Testes de cartões e faturas. Rode com: npm run test:cartoes
const ts = require('typescript');
const fs = require('fs');
const path = require('path');
const js = ts.transpileModule(fs.readFileSync(path.join(__dirname, '..', 'src', 'lib', 'cartoes.ts'), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const m = { exports: {} }; new Function('module', 'exports', js)(m, m.exports); const K = m.exports;
let ok = 0, falhas = 0;
const eq = (n, a, b) => { if (JSON.stringify(a) === JSON.stringify(b)) ok++; else { falhas++; console.log('FALHOU', n, JSON.stringify(a), '≠', JSON.stringify(b)); } };

// mesmos casos testados no banco
eq('antes do fechamento, venc ≤ fech', K.mesDaFatura('2026-11-10', 25, 5), '2026-12-01');
eq('depois do fechamento', K.mesDaFatura('2026-11-26', 25, 5), '2027-01-01');
eq('venc > fech mesmo mês', K.mesDaFatura('2026-11-02', 3, 10), '2026-11-01');
eq('no dia do fechamento', K.mesDaFatura('2026-11-03', 3, 10), '2026-12-01');
eq('virada de ano', K.mesDaFatura('2026-12-28', 25, 5), '2027-02-01');
eq('datas fatura venc ≤ fech', K.datasDaFatura({ dia_fechamento: 25, dia_vencimento: 5 }, '2026-12-01'), { fechamento: '2026-11-25', vencimento: '2026-12-05' });
eq('datas fev curto', K.datasDaFatura({ dia_fechamento: 30, dia_vencimento: 31 }, '2027-02-01'), { fechamento: '2027-02-28', vencimento: '2027-02-28' });

const c = { id: 'c', nome: 'Nu', limite_centavos: 500000, dia_fechamento: 25, dia_vencimento: 5, conta_pagamento_id: 'k', cor: '#000000', arquivado: false };
const compras = [
  { id: '1', cartao_id: 'c', competencia: '2026-11-01', valor_centavos: 20000 },
  { id: '2', cartao_id: 'c', competencia: '2026-12-01', valor_centavos: 10000 },
  { id: '3', cartao_id: 'c', competencia: '2026-12-01', valor_centavos: 10000 },
  { id: '4', cartao_id: 'c', competencia: '2027-01-01', valor_centavos: 10000 },
];
const pagos = [{ id: 'p', cartao_id: 'c', fatura: '2026-11-01', valor_centavos: 20000, data: '2026-11-05', conta_id: 'k' }];
// hoje 06/11: fatura de nov paga; dez aberta (fecha 25/11); jan futura
const r = K.resumoDoCartao(c, compras, pagos, '2026-11-06');
eq('status', r.faturas.map((f) => f.status), ['paga', 'aberta', 'futura']);
eq('limite usado inclui parcelas futuras', r.usadoCentavos, 30000);
eq('disponível', r.disponivelCentavos, 470000);
eq('aberta é dezembro', r.aberta.fatura, '2026-12-01');
eq('nada a pagar agora', r.aPagar, null);
// 28/11: dezembro fechou
const r2 = K.resumoDoCartao(c, compras, pagos, '2026-11-28');
eq('dezembro fechada', r2.faturas[1].status, 'fechada');
eq('a pagar = dezembro', r2.aPagar.fatura, '2026-12-01');
eq('aberta agora é janeiro', r2.aberta.fatura, '2027-01-01');
// 10/12 sem pagar: vencida
eq('vencida', K.resumoDoCartao(c, compras, pagos, '2026-12-10').faturas[1].status, 'vencida');
// pagamento parcial
const r3 = K.resumoDoCartao(c, compras, [...pagos, { id: 'q', cartao_id: 'c', fatura: '2026-12-01', valor_centavos: 5000, data: '2026-12-04', conta_id: 'k' }], '2026-12-04');
eq('parcial restante', r3.faturas[1].restanteCentavos, 15000);
eq('parcelas somam o total', K.dividirParcelas(10000, 3).reduce((s, x) => s + x, 0), 10000);
eq('centavos na primeira', K.dividirParcelas(10000, 3), [3334, 3333, 3333]);
console.log(`${ok} ok, ${falhas} falha(s)`);
process.exit(falhas ? 1 : 0);
