// Testes de planejamento, simuladores, importação OFX/CSV, detecção de recorrentes e avisos.
// Rode com: npm run test:planejamento
const ts = require('typescript');
const fs = require('fs');
const path = require('path');

const cache = {};
function carregar(nome) {
  if (cache[nome]) return cache[nome];
  const src = fs.readFileSync(path.join(__dirname, '..', 'src', 'lib', `${nome}.ts`), 'utf8');
  const js = ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const m = { exports: {} };
  const req = (p) => (p.startsWith('./') ? carregar(p.slice(2)) : require(p));
  new Function('module', 'exports', 'require', js)(m, m.exports, req);
  return (cache[nome] = m.exports);
}
const P = carregar('planejamento');
const S = carregar('simuladores');
const I = carregar('importacao');
const D = carregar('deteccao');
const A = carregar('avisos');
const R = carregar('relatorio');
const F = carregar('fatura-importada');

let ok = 0, falhas = 0;
const eq = (n, a, b) => { if (JSON.stringify(a) === JSON.stringify(b)) ok++; else { falhas++; console.log('FALHOU', n, JSON.stringify(a), '≠', JSON.stringify(b)); } };
const perto = (n, a, b, tol = 0.01) => { if (Math.abs(a - b) <= tol) ok++; else { falhas++; console.log('FALHOU', n, a, '≈', b); } };

// ORÇAMENTO
eq('orc ok', P.progressoOrcamento(5000, 10000).estado, 'ok');
eq('orc 80%', P.progressoOrcamento(8000, 10000).estado, 'atencao');
eq('orc 100%', P.progressoOrcamento(10000, 10000).estado, 'estourado');
eq('orc restante', P.progressoOrcamento(12000, 10000).restanteCentavos, -2000);

// METAS
eq('meses mesmo mês', P.mesesAte('2026-11-06', '2026-11-30'), 1);
eq('meses até dezembro', P.mesesAte('2026-11-06', '2026-12-31'), 2);
eq('meses ano seguinte', P.mesesAte('2026-11-06', '2027-07-01'), 9);
const meta = P.progressoMeta({ alvoCentavos: 500000, atualCentavos: 100000, prazo: '2027-07-31' }, '2026-11-06');
eq('meta pct', meta.pct, 20);
eq('meta por mês', meta.porMesCentavos, Math.ceil(400000 / 9));
eq('meta concluída', P.progressoMeta({ alvoCentavos: 100, atualCentavos: 150, prazo: null }, '2026-11-06').concluida, true);
eq('meta vencida', P.progressoMeta({ alvoCentavos: 100, atualCentavos: 50, prazo: '2026-10-01' }, '2026-11-06').vencida, true);
eq('meta saldo negativo conta zero', P.progressoMeta({ alvoCentavos: 100, atualCentavos: -50, prazo: null }, '2026-11-06').pct, 0);

// RENDA PASSIVA: nov/2025..out/2026 contam; nov/2026 (corrente) e out/2025 não
const prov = [{ mes: '2025-10', valorCentavos: 99999 }, { mes: '2025-11', valorCentavos: 1200 }, { mes: '2026-10', valorCentavos: 1200 }, { mes: '2026-11', valorCentavos: 99999 }];
eq('renda passiva 12m', P.rendaPassivaMensal(prov, '2026-11-06'), 200);

// FLUXO DE CAIXA
const regras = [
  { id: 's', tipo: 'receita', descricao: 'Salário', valor_centavos: 500000, frequencia: 'mensal', data_inicio: '2026-01-05', data_fim: null, conta_id: 'k', conta_destino_id: null, categoria_id: 'x', ativo_id: null, ativa: true },
  { id: 'a', tipo: 'despesa', descricao: 'Aluguel', valor_centavos: 200000, frequencia: 'mensal', data_inicio: '2026-01-10', data_fim: null, conta_id: 'k', conta_destino_id: null, categoria_id: 'y', ativo_id: null, ativa: true },
  { id: 't', tipo: 'transferencia', descricao: 'Caixinha', valor_centavos: 50000, frequencia: 'mensal', data_inicio: '2026-01-10', data_fim: null, conta_id: 'k', conta_destino_id: 'p', categoria_id: null, ativo_id: null, ativa: true },
  { id: 'v', tipo: 'aporte', descricao: 'VGBL', valor_centavos: 30000, frequencia: 'mensal', data_inicio: '2026-01-15', data_fim: null, conta_id: 'k', conta_destino_id: null, categoria_id: null, ativo_id: 'z', ativa: true },
];
const fluxo = P.fluxoDeCaixa({
  saldoAtualCentavos: 100000, hoje: '2026-11-06', meses: ['2026-11', '2026-12'], regras,
  tratadas: [{ recorrencia_id: 's', data_ocorrencia: '2026-11-05', situacao: 'confirmada' }],
  faturasPorMes: new Map([['2026-12', 80000]]),
});
eq('fluxo nov: salário já confirmado não conta de novo', fluxo[0].entradasCentavos, 0);
eq('fluxo nov saldo', fluxo[0].saldoFinalCentavos, 100000 - 200000 - 30000);
eq('fluxo dez saldo', fluxo[1].saldoFinalCentavos, -130000 + 500000 - 200000 - 80000 - 30000);
eq('transferência não muda o total', fluxo[1].saidasCentavos, 200000);

// SIMULADORES
perto('taxa mensal de 12,68% a.a. ≈ 1% a.m.', S.taxaMensal(12.682503), 0.01, 1e-6);
const jc = S.jurosCompostos({ inicial: 1000, mensal: 100, taxaAnual: 0, anos: 1 });
perto('juros 0%: só soma', jc.final, 2200);
const jc2 = S.jurosCompostos({ inicial: 1000, mensal: 0, taxaAnual: 10, anos: 2 });
perto('juros compostos 10% 2 anos', jc2.final, 1210, 0.01);
eq('série anual', jc2.serie.length, 3);
eq('independência alvo 4%', S.independencia({ gastoMensal: 5000, taxaRetirada: 4, patrimonio: 0, aporteMensal: 0, rentabilidadeReal: 0 }).meses, null);
perto('independência alvo valor', S.independencia({ gastoMensal: 5000, taxaRetirada: 4, patrimonio: 0, aporteMensal: 0, rentabilidadeReal: 0 }).alvo, 1500000);
eq('independência sem juros', S.independencia({ gastoMensal: 1000, taxaRetirada: 4, patrimonio: 0, aporteMensal: 10000, rentabilidadeReal: 0 }).meses, 30);
eq('independência já atingida', S.independencia({ gastoMensal: 1000, taxaRetirada: 4, patrimonio: 400000, aporteMensal: 0, rentabilidadeReal: 0 }).meses, 0);
const price = S.financiamento({ valor: 10000, taxaAnual: 12.682503, meses: 12, sistema: 'price' });
perto('price parcela (1% a.m.)', price.parcelas[0].parcela, 888.49, 0.01);
perto('price quita', price.parcelas[11].saldo, 0, 0.01);
const sac = S.financiamento({ valor: 12000, taxaAnual: 12.682503, meses: 12, sistema: 'sac' });
perto('sac 1ª parcela', sac.parcelas[0].parcela, 1120, 0.01);
perto('sac última parcela', sac.parcelas[11].parcela, 1010, 0.01);
eq('sac paga menos juros que price', sac.totalJuros < S.financiamento({ valor: 12000, taxaAnual: 12.682503, meses: 12, sistema: 'price' }).totalJuros, true);
perto('quanto guardar sem juros', S.quantoGuardar({ alvo: 1200, atual: 0, meses: 12, taxaAnual: 0 }), 100);
eq('quanto guardar já tem', S.quantoGuardar({ alvo: 100, atual: 200, meses: 12, taxaAnual: 0 }), 0);

// IMPORTAÇÃO
eq('valor BR', I.valorParaCentavos('1.234,56'), 123456);
eq('valor US negativo', I.valorParaCentavos('-1234.56'), -123456);
eq('valor R$', I.valorParaCentavos('R$ 50,00'), 5000);
eq('valor parênteses', I.valorParaCentavos('(12,00)'), -1200);
eq('valor sinal no fim', I.valorParaCentavos('12,00-'), -1200);
eq('valor inválido', I.valorParaCentavos('abc'), null);
eq('data br', I.dataParaIso('05/11/2026'), '2026-11-05');
eq('data br curta', I.dataParaIso('5/1/26'), '2026-01-05');
eq('data iso', I.dataParaIso('2026-11-05'), '2026-11-05');
eq('data ofx', I.dataParaIso('20261105120000[-3:BRT]'), '2026-11-05');
eq('data inválida', I.dataParaIso('31/02/2026'), null);

const ofx = `OFXHEADER:100
<OFX><BANKMSGSRSV1><STMTTRNRS><STMTRS><BANKTRANLIST>
<STMTTRN><TRNTYPE>DEBIT<DTPOSTED>20261103<TRNAMT>-45.90<FITID>abc1<MEMO>PADARIA DO ZE
<STMTTRN><TRNTYPE>CREDIT<DTPOSTED>20261105000000[-3:BRT]<TRNAMT>5000.00<FITID>abc2<NAME>SALARIO</NAME>
<STMTTRN><TRNTYPE>DEBIT<DTPOSTED>20261105<TRNAMT>0.00<FITID>zero<MEMO>ZERADA
</BANKTRANLIST></STMTRS></STMTTRNRS></BANKMSGSRSV1></OFX>`;
const o = I.lerOfx(ofx);
eq('ofx linhas (ignora zero)', o.linhas.length, 2);
eq('ofx 1', o.linhas[0], { data: '2026-11-03', descricao: 'PADARIA DO ZE', valorCentavos: -4590, idExterno: 'abc1', recebedor: null });
eq('ofx 2 (fechamento xml)', o.linhas[1].descricao, 'SALARIO');
eq('ofx conta, não cartão', o.cartao, false);
eq('ofx cartão', I.lerOfx('<OFX><CREDITCARDMSGSRSV1><STMTTRN><DTPOSTED>20261101<TRNAMT>-10<FITID>1<MEMO>X').cartao, true);

const nubankConta = `Data,Valor,Identificador,Descrição
05/11/2026,-45.90,id-1,"Compra no débito - Padaria, do Zé"
06/11/2026,1500.00,id-2,Transferência recebida`;
const c1 = I.lerCsv(nubankConta);
eq('csv nubank conta', c1.linhas.length, 2);
eq('csv aspas com vírgula', c1.linhas[0].descricao, 'Compra no débito - Padaria, do Zé');
eq('csv id', c1.linhas[0].idExterno, 'id-1');
const itau = `data;lançamento;valor (R$)
05/11/2026;SUPERMERCADO;-1.234,56
06/11/2026;PIX RECEBIDO;200,00`;
eq('csv ponto e vírgula BR', I.lerCsv(itau).linhas.map((l) => l.valorCentavos), [-123456, 20000]);
const debCred = `Data;Histórico;Débito;Crédito
05/11/2026;Conta de luz;150,00;
06/11/2026;Salário;;3000,00`;
eq('csv débito/crédito', I.lerCsv(debCred).linhas.map((l) => l.valorCentavos), [-15000, 300000]);
eq('csv sem colunas', !!I.lerCsv('a;b\n1;2').erro, true);
const cartaoCsv = I.lerCsv('date,title,amount\n2026-11-01,Netflix,55.90\n2026-11-02,Uber,20\n2026-11-05,Pagamento recebido,-500');
eq('csv cartão inverte sinal', I.normalizarSinalCartao(cartaoCsv.linhas).map((l) => l.valorCentavos), [-5590, -2000, 50000]);
const l1 = { data: '2026-11-05', descricao: 'Padaria', valorCentavos: -100, idExterno: null };
eq('chave estável', I.chaveDuplicado('k', l1), I.chaveDuplicado('k', { ...l1, descricao: 'PADARIA ' }));
eq('chave por conta', I.chaveDuplicado('k', l1) === I.chaveDuplicado('j', l1), false);
eq('chave repetição', I.chaveDuplicado('k', l1, 0) === I.chaveDuplicado('k', l1, 1), false);
eq('chave cabe em 64', I.chaveDuplicado('k', l1).length <= 64, true);
eq('decodifica latin1', I.decodificar(new Uint8Array([0x53, 0xe3, 0x6f])), 'São');

// DETECÇÃO
const h = (desc, valor, data, extra = {}) => ({ tipo: 'despesa', descricao: desc, valor_centavos: valor, data, conta_id: 'k', cartao_id: null, categoria_id: 'c', grupo_parcelas: null, ...extra });
const hist = [
  h('NETFLIX.COM 08/2026', 5590, '2026-08-12'), h('NETFLIX.COM 09/2026', 5590, '2026-09-12'), h('Netflix.com 10/2026', 5590, '2026-10-13'),
  h('Mercado', 30000, '2026-08-02'), h('Mercado', 9000, '2026-09-02'), h('Mercado', 45000, '2026-10-02'),
  h('Academia', 9900, '2026-05-05'), h('Academia', 9900, '2026-06-05'), h('Academia', 9900, '2026-07-05'),
  h('Celular 1/10', 30000, '2026-08-01', { grupo_parcelas: 'g' }), h('Celular 2/10', 30000, '2026-09-01', { grupo_parcelas: 'g' }), h('Celular 3/10', 30000, '2026-10-01', { grupo_parcelas: 'g' }),
  h('Spotify', 2190, '2026-08-20'), h('Spotify', 2190, '2026-09-20'), h('Spotify', 2190, '2026-10-20'),
];
const sug = D.detectarRecorrentes(hist, ['Spotify'], '2026-11-06');
eq('detecta só netflix', sug.map((s) => s.descricao), ['Netflix.com 10/2026']);
eq('dia mediano', sug[0].dia, 12);
eq('chave descrição', D.chaveDescricao('NETFLIX.COM 12/10'), 'netflix com');

// AVISOS
const av = A.montarAvisos({
  hoje: '2026-11-06',
  faturas: [
    { cartaoId: 'n', cartao: 'Nubank', vencimento: '2026-11-07', restanteCentavos: 10000, status: 'fechada' },
    { cartaoId: 'i', cartao: 'Inter', vencimento: '2026-11-01', restanteCentavos: 5000, status: 'vencida' },
    { cartaoId: 'x', cartao: 'XP', vencimento: '2026-11-30', restanteCentavos: 5000, status: 'aberta' },
  ],
  previstas: [
    { recorrenciaId: 'a', descricao: 'Aluguel', data: '2026-11-05', valorCentavos: 200000, tipo: 'despesa' },
    { recorrenciaId: 'l', descricao: 'Luz', data: '2026-11-08', valorCentavos: 15000, tipo: 'despesa' },
  ],
  orcamentos: [{ categoria: 'Alimentação', gastoCentavos: 85000, limiteCentavos: 100000 }, { categoria: 'Lazer', gastoCentavos: 30000, limiteCentavos: 20000 }],
  contasNegativas: [],
  metas: [{ id: 'm', nome: 'Viagem', prazo: '2026-11-30', pct: 40 }],
});
eq('avisos: alertas primeiro', av[0].nivel, 'alerta');
eq('avisos: fatura amanhã é alerta', av.find((a) => a.id.startsWith('fatura-n')).nivel, 'alerta');
eq('avisos: fatura em 24 dias não avisa', av.some((a) => a.id.startsWith('fatura-x')), false);
eq('avisos: atrasada', av.some((a) => a.titulo === 'Aluguel está atrasado'), true);
eq('avisos: luz em 2 dias', av.some((a) => a.titulo === 'Luz vence em 2 dias'), true);
eq('avisos: orçamento 80 e 100', av.filter((a) => a.id.startsWith('orc-')).map((a) => a.nivel).sort(), ['alerta', 'info']);
eq('avisos: meta', av.some((a) => a.id === 'meta-m'), true);


// RELATÓRIOS
const cats = [{ id: 'ali', nome: 'Alimentação', tipo: 'despesa', parent_id: null, cor: '#111111', arquivada: false }, { id: 'mer', nome: 'Mercado', tipo: 'despesa', parent_id: 'ali', cor: '#222222', arquivada: false }];
const bal = R.balancoAnual([
  { tipo: 'receita', valor_centavos: 100000, competencia: '2026-01-01', categoria_id: null },
  { tipo: 'despesa', valor_centavos: 30000, competencia: '2026-01-01', categoria_id: 'mer' },
  { tipo: 'despesa', valor_centavos: 10000, competencia: '2026-02-01', categoria_id: 'ali' },
  { tipo: 'despesa', valor_centavos: 99999, competencia: '2025-12-01', categoria_id: 'ali' },
  { tipo: 'transferencia', valor_centavos: 5000, competencia: '2026-01-01', categoria_id: null },
], 2026, cats);
eq('balanço receitas', bal.receitas, 100000);
eq('balanço despesas (ignora outro ano e transferência)', bal.despesas, 40000);
eq('balanço subcategoria soma na mãe', bal.categorias.find((c) => c.id === 'ali').total, 40000);
eq('balanço taxa de poupança', bal.taxaPoupanca, 60);
eq('balanço resultado jan', bal.meses[0].resultado, 70000);
const sf = R.saldosFimDoMes(1000, [{ data: '2026-03-10', valor: 300 }, { data: '2026-01-20', valor: 500 }, { data: '2026-02-28', valor: -100 }], 2026, '2026-03-15');
eq('saldo fim de jan', sf[0], 1000 - 300 + 100);
eq('saldo fim de fev (inclui o dia 28)', sf[1], 700);
eq('saldo mar = atual', sf[2], 1000);
eq('meses futuros null', sf[3], null);
eq('csv fórmula escapada', R.celulaCsv('=HYPERLINK("x")'), `"'=HYPERLINK(""x"")"`);
eq('csv número BR', R.celulaCsv(-123456), '-1234,56');
eq('csv ponto e vírgula', R.celulaCsv('a;b'), '"a;b"');

// IMPORTAÇÃO DE PDF (texto extraído)
const nubank = [
  'Extrato de 01 OUT 2026 a 31 OUT 2026',
  '05 OUT 2026 Total de entradas + 1.500,00',
  'Transferência recebida pelo Pix  FULANO DE TAL  1.500,00',
  '06 OUT 2026 Total de saídas - 245,90',
  'Compra no débito  PADARIA DO ZE  45,90',
  'Transferência enviada pelo Pix  ALUGUEL  200,00',
  'Saldo do dia 1.254,10',
];
const rn = I.lerTextoExtrato(nubank, { hoje: '2026-11-07', cartao: false }).linhas;
eq('pdf nubank linhas', rn.length, 3);
eq('pdf nubank entrada', [rn[0].data, rn[0].valorCentavos], ['2026-10-05', 150000]);
eq('pdf nubank saída', [rn[1].data, rn[1].descricao, rn[1].valorCentavos], ['2026-10-06', 'Compra no débito PADARIA DO ZE', -4590]);
eq('pdf nubank pix enviado', rn[2].valorCentavos, -20000);

const itauPdf = [
  'Período: 01/10/2026 a 31/10/2026',
  'data lançamento valor (R$) saldo (R$)',
  '01/10 SALDO ANTERIOR 1.000,00',
  '03/10 PIX TRANSF JOAO 03/10 -150,00 850,00',
  '05/10 REND PAGO APLIC AUT 2,35 852,35',
  '10/10 SISPAG SALARIO EMPRESA 5.000,00 5.852,35',
];
const ri = I.lerTextoExtrato(itauPdf, { hoje: '2026-11-07', cartao: false }).linhas;
eq('pdf itaú ignora saldo anterior', ri.length, 3);
eq('pdf itaú negativo e ignora coluna saldo', [ri[0].data, ri[0].valorCentavos], ['2026-10-03', -15000]);
eq('pdf itaú rendimento positivo', ri[1].valorCentavos, 235);
eq('pdf itaú salário', ri[2].valorCentavos, 500000);

const inter = [
  '5 de outubro de 2026 Saldo do dia: R$ 300,00',
  'Pix enviado: "Mercado Bom" -R$ 89,90',
  'Pix recebido: "Maria" R$ 50,00',
];
const rt = I.lerTextoExtrato(inter, { hoje: '2026-11-07', cartao: false }).linhas;
eq('pdf inter data por extenso', rt.map((l) => l.data), ['2026-10-05', '2026-10-05']);
eq('pdf inter sinais', rt.map((l) => l.valorCentavos), [-8990, 5000]);

const dcPdf = ['15/10/2026 TARIFA PACOTE 39,90 D', '16/10/2026 TED RECEBIDA 1.000,00 C'];
eq('pdf D/C', I.lerTextoExtrato(dcPdf, { hoje: '2026-11-07', cartao: false }).linhas.map((l) => l.valorCentavos), [-3990, 100000]);

const fatura = ['12 OUT NETFLIX.COM 55,90', '13 OUT UBER *TRIP 23,40', '15 OUT PAGAMENTO RECEBIDO -1.200,00', '20 OUT LOJA X PARCELA 2/10 150,00'];
eq('pdf fatura', I.lerTextoExtrato(fatura, { hoje: '2026-11-07', cartao: true }).linhas.map((l) => l.valorCentavos), [-5590, -2340, 120000, -15000]);

eq('pdf ano anterior quando data ficaria no futuro', I.lerTextoExtrato(['20 DEZ COMPRA X 10,00'], { hoje: '2026-01-10', cartao: true }).linhas[0].data, '2025-12-20');
eq('pdf sem data não vira linha', I.lerTextoExtrato(['COMPRA SEM DATA 10,00'], { hoje: '2026-11-07', cartao: false }).linhas.length, 0);

// RECEBEDOR E PAGAMENTO DE FATURA (ADR-0012)
const brad = [
  '03/11/2026 PIX ENVIADO -50,00 1.234,56',
  'DES: FULANO DE TAL 03/11',
  'PIX RECEBIDO 40,00 1.274,56',
  'REM: EMPRESA XYZ LTDA 03/11',
  'GASTOS CARTAO DE CREDITO -394,03 880,53',
  '29/10/2026 VENCIMENTO FUNCIONARIO 5.180,56 6.061,09',
];
const rb = I.lerTextoExtrato(brad, { hoje: '2026-11-07', cartao: false }).linhas;
eq('bradesco: 4 linhas (salário "VENCIMENTO" não é mais ignorado)', rb.length, 4);
eq('bradesco: recebedor DES', [rb[0].descricao, rb[0].recebedor], ['PIX ENVIADO', 'FULANO DE TAL']);
eq('bradesco: recebedor REM', [rb[1].valorCentavos, rb[1].recebedor], [4000, 'EMPRESA XYZ LTDA']);
eq('bradesco: cartão sem recebedor', rb[2].recebedor, null);
eq('bradesco: salário', [rb[3].data, rb[3].valorCentavos], ['2026-10-29', 518056]);
eq('ofx NAME vira recebedor', I.lerOfx('<STMTTRN><DTPOSTED>20261103<TRNAMT>-50.00<FITID>x<NAME>FULANO DE TAL<MEMO>PIX ENVIADO').linhas[0].recebedor, 'FULANO DE TAL');
eq('chave estável com recebedor', I.chaveDuplicado('k', { data: '2026-11-03', descricao: 'PIX ENVIADO', valorCentavos: -5000, idExterno: null, recebedor: 'FULANO' }), I.chaveDuplicado('k', { data: '2026-11-03', descricao: 'PIX ENVIADO', valorCentavos: -5000, idExterno: null }));

eq('pagamento de fatura: bradesco', F.ehPagamentoFatura('GASTOS CARTAO DE CREDITO', -39403), true);
eq('pagamento de fatura: pagto fatura', F.ehPagamentoFatura('PAGTO FATURA NUBANK', -1000), true);
eq('pagamento de fatura: pagamento cartão', F.ehPagamentoFatura('Pagamento cartão de crédito', -1000), true);
eq('não é fatura: boleto', F.ehPagamentoFatura('PAGTO ELETRON COBRANCA', -1000), false);
eq('não é fatura: entrada', F.ehPagamentoFatura('GASTOS CARTAO DE CREDITO', 1000), false);
const visa = { id: 'v', nome: 'VISA', dia_fechamento: 17, dia_vencimento: 3, conta_pagamento_id: 'brad', arquivado: false };
const outro = { id: 'o', nome: 'Outro', dia_fechamento: 1, dia_vencimento: 10, conta_pagamento_id: 'nu', arquivado: false };
const cf = F.faturasCandidatas({ contaId: 'brad', data: '2026-11-03', valorCentavos: -39403 }, [visa, outro]);
eq('fatura: só cartões pagos pela conta', cf.map((c) => c.cartaoId), ['v']);
eq('fatura: novembro (vence 03/11)', [cf[0].fatura, cf[0].dias], ['2026-11-01', 0]);
eq('fatura: pagamento atrasado em 05/10 → outubro', F.faturasCandidatas({ contaId: 'brad', data: '2026-10-05', valorCentavos: -1 }, [visa])[0].fatura, '2026-10-01');
eq('fatura: sem cartão da conta usa todos', F.faturasCandidatas({ contaId: 'x', data: '2026-11-09', valorCentavos: -1 }, [visa, outro])[0].cartaoId, 'o');
eq('fatura: fora da janela', F.faturasCandidatas({ contaId: 'brad', data: '2026-11-20', valorCentavos: -1 }, [visa]).length, 0);
eq('fatura sem sinal continua saída', I.lerTextoExtrato(['03/11/2026 GASTOS CARTAO DE CREDITO 394,03'], { hoje: '2026-11-07', cartao: false }).linhas[0].valorCentavos, -39403);
eq('TED crédito sem sinal é entrada', I.lerTextoExtrato(['03/11/2026 TED CREDITO EMPRESA 100,00'], { hoje: '2026-11-07', cartao: false }).linhas[0].valorCentavos, 10000);
eq('chave recebedor', F.chaveRecebedor('Fulano  de Tal *** 123.456.789-00'), 'fulano de tal');

// --- Extrato em colunas Crédito/Débito/Saldo (layout do Bradesco: histórico em cima, complemento embaixo) ---
const it = (x, y, s) => ({ x, fim: x + s.length * 4.6, y, s });
const valor = (fim, y, s) => ({ x: fim - s.length * 4, fim, y, s }); // valores alinhados à direita
const cab = [it(46, 680, 'Data'), it(110, 680, 'Histórico'), it(305, 680, 'Docto.'), { x: 385, fim: 425.6, y: 680.7, s: 'Crédito (R$)' }, { x: 451.7, fim: 490.1, y: 680.7, s: 'Débito (R$)' }, { x: 519.8, fim: 554.6, y: 680.7, s: 'Saldo (R$)' }];
const pag1 = [it(200, 777, 'Banco Exemplo'), it(200, 755, 'Data: 08/11/2026 - 16h49'), ...cab,
  it(46, 644.7, '28/08/2023'), it(110, 649.2, 'TRANSF.AUTORIZ.ENTRE C/C'), it(110, 640.2, 'FULANO DE TAL'), it(303, 644.7, '2856678'), valor(426.8, 644.7, '1.000,00'), valor(550.5, 644.7, '1.000,00'),
  it(110, 618.8, 'PIX ENVIADO'), it(110, 609.8, 'DES: LOJA EXEMPLO LTDA 02/10'), it(303, 614.3, '2034591'), valor(490.5, 614.3, '134,00'), valor(550.5, 614.3, '866,00'),
  it(46, 584, '30/10/2023'), it(110, 584, 'VENCIMENTO FUNCIONARIO'), it(303, 584, '9437863'), valor(426.8, 584, '824,20'), valor(550.5, 584, '1.690,20'),
  it(110, 558.1, 'SAQUE DINHEIRO ATM'), it(110, 549.1, 'Ag02856maq008006seq0740827101354'), it(303, 553.6, '8006408'), valor(490.5, 553.6, '20,00'), valor(550.5, 553.6, '1.670,20')];
const pag2 = [...cab,
  it(110, 649.2, 'COMPRA ELO DEBITO VISTA'), it(46, 644.7, '03/11/2023'), it(110, 640.2, 'MERCADO DO BAIRRO'), it(303, 644.7, '0000518'), valor(490.5, 644.7, '70,20'), valor(550.5, 644.7, '1.600,00'),
  it(46, 600, 'Total'), valor(426.8, 600, '1.824,20'), valor(490.5, 600, '224,20'), valor(550.5, 600, '1.600,00')];
const tb = I.lerTabelaExtrato([pag1, pag2], { hoje: '2026-11-08' });
eq('colunas: valores pelo lado (crédito +, débito −)', tb.linhas.map((l) => l.valorCentavos), [100000, -13400, 82420, -2000, -7020]);
eq('colunas: linha "Total" ignorada e saldo confere', [tb.linhas.length, tb.conferidas, tb.divergentes], [5, 4, 0]);
eq('colunas: histórico de cima vira descrição (não o nº do documento)', tb.linhas.map((l) => l.descricao), ['TRANSF.AUTORIZ.ENTRE C/C', 'PIX ENVIADO', 'VENCIMENTO FUNCIONARIO', 'SAQUE DINHEIRO ATM', 'COMPRA ELO DEBITO VISTA']);
eq('colunas: data repete quando a linha não tem', tb.linhas.map((l) => l.data), ['2023-08-28', '2023-08-28', '2023-10-30', '2023-10-30', '2023-11-03']);
eq('colunas: recebedor (DES:, nome sem prefixo; código do caixa não)', tb.linhas.map((l) => l.recebedor), ['FULANO DE TAL', 'LOJA EXEMPLO LTDA', null, null, 'MERCADO DO BAIRRO']);
const trocado = [...cab, it(46, 644.7, '01/11/2023'), it(110, 644.7, 'SALDO ANTERIOR'), valor(550.5, 644.7, '500,00'),
  it(110, 614.3, 'TARIFA'), valor(426.8, 614.3, '10,00'), valor(550.5, 614.3, '490,00')]; // valor na coluna errada: o saldo corrige
eq('colunas: saldo anterior + saldo corrige coluna trocada', I.lerTabelaExtrato([trocado], { hoje: '2026-11-08' }).linhas.map((l) => l.valorCentavos), [-1000]);
eq('colunas: sem cabeçalho Crédito/Débito → null (usa texto)', I.lerTabelaExtrato([[it(46, 600, '03/11/2026'), it(110, 600, 'PIX'), valor(500, 600, '10,00')]], { hoje: '2026-11-08' }), null);
eq('texto: saldo ao lado decide entrada/saída', I.lerTextoExtrato(['01/11/2026 SALDO ANTERIOR 100,00', '02/11/2026 PIX ENVIADO JOAO 50,00 150,00', '03/11/2026 DEPOSITO 20,00 130,00'], { hoje: '2026-11-08', cartao: false }).linhas.map((l) => l.valorCentavos), [5000, -2000]);

console.log(`${ok} ok, ${falhas} falha(s)`);
process.exit(falhas ? 1 : 0);
