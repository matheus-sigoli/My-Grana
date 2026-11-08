/**
 * Importação de extratos OFX e CSV (ADR-0006). Puro: recebe texto, devolve linhas normalizadas.
 * Nada vira lançamento aqui — as linhas vão para a caixa de entrada (revisão obrigatória).
 */
import { createHash } from "node:crypto";

export type LinhaImportada = {
  data: string; // AAAA-MM-DD
  descricao: string;
  valorCentavos: number; // negativo = saída
  idExterno: string | null; // FITID do OFX ou "Identificador" do CSV
  recebedor?: string | null; // quem recebeu/mandou (ADR-0012): "DES:"/"REM:" no PDF, NAME no OFX
};

export const MAX_BYTES = 2 * 1024 * 1024;
export const MAX_BYTES_PDF = 5 * 1024 * 1024;
export const MAX_LINHAS = 3000;

/** Data real (31/02 não passa: o JS aceitaria e viraria 03/03). */
const dataValida = (iso: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso) || iso < "2000-01-01" || iso > "2100-12-31") return false;
  const t = Date.parse(`${iso}T00:00:00Z`);
  return !Number.isNaN(t) && new Date(t).toISOString().slice(0, 10) === iso;
};

const limparTexto = (s: string) => s.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, 200);

/** "1.234,56" | "-1234.56" | "R$ 50,00" | "(12,00)" → centavos. */
export function valorParaCentavos(bruto: string): number | null {
  let s = bruto.replace(/R\$|\s| /g, "");
  let neg = false;
  if (/^\(.*\)$/.test(s)) { neg = true; s = s.slice(1, -1); }
  if (s.startsWith("-")) { neg = !neg; s = s.slice(1); } else if (s.startsWith("+")) s = s.slice(1);
  if (s.endsWith("-")) { neg = !neg; s = s.slice(0, -1); }
  if (!s) return null;
  const ultVirg = s.lastIndexOf(","), ultPonto = s.lastIndexOf(".");
  if (ultVirg > ultPonto) s = s.replace(/\./g, "").replace(",", ".");
  else s = s.replace(/,/g, "");
  if (!/^\d+(\.\d+)?$/.test(s)) return null;
  const v = Math.round(parseFloat(s) * 100);
  return neg ? -v : v;
}

/** "31/12/2026" | "31/12/26" | "2026-12-31" | "20261231..." → ISO, ou null. */
export function dataParaIso(bruto: string): string | null {
  const s = bruto.trim();
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return dataValida(`${m[1]}-${m[2]}-${m[3]}`) ? `${m[1]}-${m[2]}-${m[3]}` : null;
  m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$/);
  if (m) {
    const ano = m[3].length === 2 ? `20${m[3]}` : m[3];
    const iso = `${ano}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
    return dataValida(iso) ? iso : null;
  }
  m = s.match(/^(\d{4})(\d{2})(\d{2})/);
  if (m) return dataValida(`${m[1]}-${m[2]}-${m[3]}`) ? `${m[1]}-${m[2]}-${m[3]}` : null;
  return null;
}

/** OFX 1.x (SGML) e 2.x (XML). Lê só os campos das transações, sem parser XML (sem risco de XXE). */
export function lerOfx(texto: string): { linhas: LinhaImportada[]; cartao: boolean } {
  const cartao = /<CREDITCARDMSGSRSV1>|<CCSTMTRS>/i.test(texto);
  const blocos = texto.split(/<STMTTRN>/i).slice(1, MAX_LINHAS + 1);
  const campo = (b: string, tag: string) => b.match(new RegExp(`<${tag}>([^<\\r\\n]*)`, "i"))?.[1]?.trim() ?? "";
  const linhas: LinhaImportada[] = [];
  for (const b of blocos) {
    const data = dataParaIso(campo(b, "DTPOSTED"));
    const valor = valorParaCentavos(campo(b, "TRNAMT"));
    const memo = campo(b, "MEMO"), nome = campo(b, "NAME");
    const descricao = limparTexto(memo || nome || "Sem descrição");
    if (!data || valor === null || valor === 0) continue;
    // Descrição continua igual (chave de duplicado estável); NAME vira o recebedor quando difere do MEMO.
    const recebedor = memo && nome && limparTexto(nome) !== descricao ? limparTexto(nome).slice(0, 120) : null;
    linhas.push({ data, descricao, valorCentavos: valor, idExterno: campo(b, "FITID").slice(0, 120) || null, recebedor });
  }
  return { linhas, cartao };
}

/** Divide uma linha de CSV respeitando aspas. */
function dividir(linha: string, sep: string) {
  const out: string[] = [];
  let atual = "", aspas = false;
  for (let i = 0; i < linha.length; i++) {
    const ch = linha[i];
    if (ch === '"') {
      if (aspas && linha[i + 1] === '"') { atual += '"'; i++; } else aspas = !aspas;
    } else if (ch === sep && !aspas) { out.push(atual); atual = ""; }
    else atual += ch;
  }
  out.push(atual);
  return out.map((c) => c.trim());
}

const semAcento = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

/**
 * CSV de bancos brasileiros (Nubank, Inter, Itaú, C6…): detecta separador e colunas pelo cabeçalho.
 * Aceita coluna única de valor ou par débito/crédito.
 */
export function lerCsv(texto: string): { linhas: LinhaImportada[]; erro?: string } {
  const todas = texto.replace(/^﻿/, "").split(/\r?\n/).filter((l) => l.trim());
  if (todas.length < 2) return { linhas: [], erro: "O arquivo está vazio." };
  const cab = todas[0];
  const sep = [";", ",", "\t"].map((s) => [s, dividir(cab, s).length] as const).sort((a, b) => b[1] - a[1])[0][0];
  const cols = dividir(cab, sep).map(semAcento);
  const achar = (re: RegExp) => cols.findIndex((c) => re.test(c));
  const iData = achar(/^data|^date|^dt/);
  const iDesc = achar(/descri|historico|lancamento|title|estabelecimento|memo|detalhe/);
  const iValor = achar(/^valor|^amount|^value|quantia/);
  const iDeb = achar(/debito|saida/);
  const iCred = achar(/credito|entrada/);
  const iId = achar(/identificador|^id$|fitid|documento/);
  if (iData < 0 || (iValor < 0 && iDeb < 0 && iCred < 0)) {
    return { linhas: [], erro: "Não encontrei as colunas de data e valor no cabeçalho do CSV." };
  }

  const linhas: LinhaImportada[] = [];
  for (const l of todas.slice(1, MAX_LINHAS + 1)) {
    const c = dividir(l, sep);
    const data = dataParaIso(c[iData] ?? "");
    let valor: number | null;
    if (iValor >= 0) valor = valorParaCentavos(c[iValor] ?? "");
    else {
      const deb = valorParaCentavos(c[iDeb] ?? "") ?? 0;
      const cred = valorParaCentavos(c[iCred] ?? "") ?? 0;
      valor = cred - Math.abs(deb);
    }
    if (!data || valor === null || valor === 0) continue;
    const descricao = limparTexto((iDesc >= 0 ? c[iDesc] : "") || "Sem descrição");
    linhas.push({ data, descricao, valorCentavos: valor, idExterno: iId >= 0 ? (c[iId] ?? "").slice(0, 120) || null : null });
  }
  return { linhas };
}

// ------------------------------------------------------------------ PDF (texto já extraído)

const MESES: Record<string, number> = { jan: 1, fev: 2, mar: 3, abr: 4, mai: 5, jun: 6, jul: 7, ago: 8, set: 9, out: 10, nov: 11, dez: 12 };
const RE_DATA_NUM = /^(\d{1,2})[/.-](\d{1,2})(?:[/.-](\d{2,4}))?(?![\d,])/;
const RE_DATA_MES = /^(\d{1,2})\s*(?:de\s+)?(jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez)[a-zç]*\.?(?:\s*(?:de\s+)?(\d{4}))?(?![a-z])/;
// valor brasileiro: "-1.234,56", "R$ 50,00", "- R$ 12,90", "45,00 D", "(12,00)"
const RE_VALOR = /(\()?(?:([-−])\s*)?(?:R\$\s*)?(?:([-−])\s*)?(\d{1,3}(?:\.\d{3})+,\d{2}|\d+,\d{2})(\))?(?:\s*([DC])(?![a-zA-Z]))?/g;
const RE_IGNORAR = /\b(saldo|total|limite|resumo|p[aá]gina|per[ií]odo|ag[eê]ncia|cpf|cnpj)\b/i;
// Linha de complemento com o nome: "DES: FULANO DE TAL 03/11" (Bradesco), "REM: …", "FAVORECIDO: …"
const RE_RECEBEDOR = /^(?:des|rem|dest|fav|favorecido|pagador|remetente|destinat[aá]rio|origem|destino)\s*[:.]\s*(.+?)(?:\s+\d{2}\/\d{2}(?:\/\d{2,4})?)?$/i;
const RE_NEG = /(compra|pagamento|pagto|pix enviado|enviad[oa]|d[eé]bito|saque|tarifa|boleto|iof|juros|anuidade|aplica[cç][aã]o|parcela)/i;
// Saída mesmo com "crédito" no texto: pagamento/gasto de cartão de crédito, compra no crédito.
const RE_NEG_FORTE = /(gastos? (com )?cart[aã]o|pag(to|amento)?\.? (de |da )?fatura|fatura (do |de )?cart[aã]o|compra)/i;
const RE_POS = /(recebid|dep[oó]sito|cr[eé]dito|estorno|rendimento|\brend\b|resgate|sal[aá]rio|vencimento funcionario|\bfolha\b|reembolso|devolu[cç][aã]o)/i;
const RE_CREDITO_CARTAO = /(pagamento|estorno|cr[eé]dito|desconto|devolu[cç][aã]o)/i;

/**
 * Extrato em PDF (texto linha a linha, como aparece na página). Heurística feita para os layouts comuns
 * (Nubank, Itaú, Inter, Bradesco, C6…): data no começo da linha ou como título do dia, descrição e valor;
 * o último valor da linha costuma ser o saldo e é ignorado. Tudo vai para a revisão antes de virar lançamento.
 */
/** Monta datas "dd/mm" sem ano usando o ano mais recente que aparece no extrato (nunca no futuro). */
function montadorDeData(texto: string, hoje: string) {
  const anos = [...texto.matchAll(/\b\d{1,2}[/.-]\d{1,2}[/.-](20\d{2})\b|\b(20\d{2})\b/g)].map((m) => Number(m[1] ?? m[2])).filter((a) => a <= Number(hoje.slice(0, 4)) + 1);
  const anoBase = anos.length ? Math.max(...anos) : Number(hoje.slice(0, 4));
  return (dia: number, mes: number, ano?: number) => {
    const comAno = (a: number) => `${a}-${String(mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
    if (ano) return dataParaIso(comAno(ano < 100 ? 2000 + ano : ano));
    const iso = dataParaIso(comAno(anoBase));
    return iso && iso > hoje ? dataParaIso(comAno(anoBase - 1)) : iso;
  };
}

export function lerTextoExtrato(linhasTexto: string[], e: { hoje: string; cartao: boolean }): { linhas: LinhaImportada[] } {
  const montarData = montadorDeData(linhasTexto.join("\n"), e.hoje);
  let saldoAnterior: number | null = null; // quando a linha traz o saldo, ele decide o sinal (entrou ou saiu)

  let dataAtual: string | null = null;
  let contexto = 0; // +1 entradas, -1 saídas (títulos de seção)
  const out: LinhaImportada[] = [];
  for (const bruta of linhasTexto.slice(0, MAX_LINHAS * 2)) {
    const linha = bruta.replace(/\s+/g, " ").trim();
    if (!linha) continue;
    const baixa = semAcento(linha);
    if (/^(total de )?(entradas|creditos|receitas|dinheiro recebido)\b/.test(baixa)) contexto = 1;
    else if (/^(total de )?(saidas|debitos|despesas|gastos|dinheiro enviado)\b/.test(baixa)) contexto = -1;

    // data no começo da linha (numérica ou "05 NOV 2026" / "5 de novembro de 2026")
    let resto = linha;
    const mNum = linha.match(RE_DATA_NUM);
    const mMes = mNum ? null : baixa.match(RE_DATA_MES);
    if (mNum) {
      const d = montarData(Number(mNum[1]), Number(mNum[2]), mNum[3] ? Number(mNum[3]) : undefined);
      if (d) { dataAtual = d; resto = linha.slice(mNum[0].length); }
    } else if (mMes) {
      const d = montarData(Number(mMes[1]), MESES[mMes[2]], mMes[3] ? Number(mMes[3]) : undefined);
      if (d) { dataAtual = d; resto = linha.slice(mMes[0].length); }
    }

    const mRec = linha.match(RE_RECEBEDOR);
    if (mRec && out.length && ![...linha.matchAll(RE_VALOR)].length) {
      const ultima = out[out.length - 1];
      if (!ultima.recebedor) ultima.recebedor = limparTexto(mRec[1]).slice(0, 120) || null;
      continue;
    }
    if (RE_IGNORAR.test(baixa)) {
      // "Saldo anterior 1.234,56": vira a referência para conferir as próximas linhas.
      const vs = /\bsaldo\b/.test(baixa) && !e.cartao ? [...resto.matchAll(RE_VALOR)] : [];
      if (vs.length) {
        const u = vs[vs.length - 1], c = valorParaCentavos(u[4]);
        if (c !== null) saldoAnterior = u[2] || u[3] || u[6] === "D" ? -Math.abs(c) : Math.abs(c);
      }
      continue;
    }
    const valores = [...resto.matchAll(RE_VALOR)];
    if (!valores.length || !dataAtual) continue;

    const v = valores[0];
    const negativo = !!(v[2] || v[3] || (v[1] && v[5]) || v[6] === "D");
    const positivoExplicito = v[6] === "C";
    const centavos = valorParaCentavos(v[4]);
    if (!centavos) continue;

    let descricao = resto.slice(0, v.index).trim() || resto.slice((v.index ?? 0) + v[0].length).trim();
    descricao = limparTexto(descricao.replace(/R\$/g, "").replace(/^[-–·|•\s]+|[-–·|•\s]+$/g, "")) || "Sem descrição";

    let sinal: number;
    // Na fatura, compras vêm positivas; créditos (pagamento, estorno) vêm com "-" ou com essas palavras.
    if (e.cartao) sinal = negativo || RE_CREDITO_CARTAO.test(descricao) ? 1 : -1;
    else if (negativo) sinal = -1;
    else if (positivoExplicito) sinal = 1;
    else if (RE_NEG_FORTE.test(descricao)) sinal = -1;
    else if (RE_POS.test(descricao)) sinal = 1;
    else if (RE_NEG.test(descricao)) sinal = -1;
    else sinal = contexto || -1;

    // Saldo ao lado: se a diferença para o saldo anterior é exatamente o valor, ela diz se entrou ou saiu.
    if (valores.length >= 2 && !e.cartao) {
      const ultimo = valores[valores.length - 1];
      const saldo = valorParaCentavos(ultimo[4]);
      if (saldo !== null) {
        const saldoComSinal = ultimo[2] || ultimo[3] || ultimo[6] === "D" ? -Math.abs(saldo) : Math.abs(saldo);
        if (saldoAnterior !== null && Math.abs(saldoComSinal - saldoAnterior) === Math.abs(centavos)) sinal = Math.sign(saldoComSinal - saldoAnterior);
        saldoAnterior = saldoComSinal;
      }
    }

    out.push({ data: dataAtual, descricao, valorCentavos: sinal * Math.abs(centavos), idExterno: null, recebedor: null });
    if (out.length >= MAX_LINHAS) break;
  }
  return { linhas: out };
}

/** Pedaço de texto do PDF com posição (pontos; y cresce para cima). */
export type ItemPdf = { x: number; fim: number; y: number; s: string };

const RE_SO_VALOR = /^(\()?([-−])?\s*(?:R\$\s*)?(\d{1,3}(?:\.\d{3})+,\d{2}|\d+,\d{2})(\))?\s*([-−]|[DC])?$/;
const RE_SO_DATA = /^(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?$/;
const RE_LINHA_DE_SALDO = /^(total|saldo|s\s*a\s*l\s*d\s*o)\b/i;
type Coluna = "credito" | "debito" | "saldo";

function valorDoItem(s: string): number | null {
  const m = s.trim().match(RE_SO_VALOR);
  if (!m) return null;
  const c = valorParaCentavos(m[3]);
  if (c === null) return null;
  return m[2] || (m[1] && m[4]) || m[5] === "-" || m[5] === "−" || m[5] === "D" ? -Math.abs(c) : Math.abs(c);
}

/**
 * Extrato em PDF com colunas "Crédito" e "Débito" (Bradesco, Itaú, Santander, Caixa…). A coluna onde o valor está
 * define se entrou (+) ou saiu (−), sem adivinhar pela descrição; o saldo ao lado confere cada linha.
 * Histórico em cima e complemento ("DES: …", nome) embaixo da linha do valor são juntados a ela.
 * Devolve null se o PDF não tiver esse cabeçalho (aí vale a leitura por texto).
 */
export function lerTabelaExtrato(paginas: ItemPdf[][], e: { hoje: string }): { linhas: LinhaImportada[]; conferidas: number; divergentes: number } | null {
  const montarData = montadorDeData(paginas.flat().map((i) => i.s).join("\n"), e.hoje);
  let colunas: { nome: Coluna; x: number; fim: number }[] | null = null;
  let achouCabecalho = false;
  let dataAtual: string | null = null;
  let saldoAnterior: number | null = null;
  let conferidas = 0, divergentes = 0;
  const out: LinhaImportada[] = [];

  for (const itens of paginas) {
    // Cabeçalho: "Crédito" e "Débito" na mesma altura (o "Saldo", se houver, também).
    let topo = Infinity;
    const cred = itens.find((i) => /^cr[eé]dito/i.test(i.s.trim()));
    const deb = cred && itens.find((i) => /^d[eé]bito/i.test(i.s.trim()) && Math.abs(i.y - cred.y) <= 3);
    if (cred && deb) {
      const sal = itens.find((i) => /^saldo/i.test(i.s.trim()) && Math.abs(i.y - cred.y) <= 3);
      colunas = [{ nome: "credito", x: cred.x, fim: cred.fim }, { nome: "debito", x: deb.x, fim: deb.fim }];
      if (sal) colunas.push({ nome: "saldo", x: sal.x, fim: sal.fim });
      topo = cred.y - 2;
      achouCabecalho = true;
    }
    if (!colunas) continue;
    const cols = colunas;
    const inicioValores = Math.min(...cols.map((c) => c.x)) - 25;
    const colunaDe = (i: ItemPdf) => {
      const meio = (i.x + i.fim) / 2;
      let melhor = cols[0], dist = Infinity;
      for (const c of cols) {
        const d = Math.min(Math.abs(i.fim - c.fim), Math.abs(i.x - c.x), Math.abs(meio - (c.x + c.fim) / 2));
        if (d < dist) { dist = d; melhor = c; }
      }
      return melhor.nome;
    };

    // Linhas = alturas onde há valores nas colunas de dinheiro.
    const abaixo = itens.filter((i) => i.y < topo && i.s.trim());
    type Linha = { y: number; credito: number | null; debito: number | null; saldo: number | null; textos: ItemPdf[] };
    const linhas: Linha[] = [];
    const resto: ItemPdf[] = [];
    for (const i of abaixo) {
      const v = i.x >= inicioValores ? valorDoItem(i.s) : null;
      if (v === null) { resto.push(i); continue; }
      let l = linhas.find((x) => Math.abs(x.y - i.y) <= 2.5);
      if (!l) { l = { y: i.y, credito: null, debito: null, saldo: null, textos: [] }; linhas.push(l); }
      l[colunaDe(i)] = v;
    }
    if (!linhas.length) continue;
    // Cada texto vai para a linha de valor mais próxima na vertical (histórico em cima, complemento embaixo).
    for (const t of resto) {
      let melhor: Linha | null = null, dist = 13;
      for (const l of linhas) { const d = Math.abs(l.y - t.y); if (d < dist) { dist = d; melhor = l; } }
      melhor?.textos.push(t);
    }

    for (const l of linhas.sort((a, b) => b.y - a.y)) {
      const textos = l.textos.sort((a, b) => b.y - a.y || a.x - b.x);
      let data: string | null = null;
      const acima: string[] = [], mesma: string[] = [], embaixo: string[] = [];
      for (const t of textos) {
        const s = t.s.replace(/\s+/g, " ").trim();
        const md = s.match(RE_SO_DATA);
        if (md) { data = montarData(Number(md[1]), Number(md[2]), md[3] ? Number(md[3]) : undefined) ?? data; continue; }
        if (/^\d{3,}$/.test(s)) continue; // nº do documento
        (t.y > l.y + 1.5 ? acima : t.y < l.y - 1.5 ? embaixo : mesma).push(s);
      }
      if (data) dataAtual = data;
      const descricaoBruta = [...acima, ...mesma].join(" ");

      const movimento = (l.credito !== null ? 1 : 0) + (l.debito !== null ? 1 : 0);
      if (RE_LINHA_DE_SALDO.test(semAcento(descricaoBruta)) || movimento !== 1) {
        // "Saldo anterior" / "Total": só atualiza o saldo de referência.
        if (movimento === 0 && l.saldo !== null) saldoAnterior = l.saldo;
        continue;
      }
      if (!dataAtual) continue;
      let valor = l.credito !== null ? Math.abs(l.credito) : -Math.abs(l.debito!);
      if (l.saldo !== null) {
        if (saldoAnterior !== null) {
          const diferenca = l.saldo - saldoAnterior;
          if (diferenca === valor) conferidas++;
          else if (diferenca === -valor) { valor = -valor; conferidas++; } // coluna trocada: o saldo manda
          else divergentes++;
        }
        saldoAnterior = l.saldo;
      }

      let recebedor: string | null = null;
      for (const s of embaixo) {
        const mRec = s.match(RE_RECEBEDOR);
        if (mRec) { recebedor = limparTexto(mRec[1]).slice(0, 120) || null; break; }
        // Nome sem prefixo (quem mandou a transferência, a loja da compra): só letras.
        if (!recebedor && /^[\p{L}][\p{L} .&'-]{2,}$/u.test(s)) recebedor = limparTexto(s).slice(0, 120);
      }
      const descricao = limparTexto(descricaoBruta) || (embaixo[0] ? limparTexto(embaixo[0]) : "") || "Sem descrição";
      out.push({ data: dataAtual, descricao, valorCentavos: valor, idExterno: null, recebedor });
      if (out.length >= MAX_LINHAS) return { linhas: out, conferidas, divergentes };
    }
  }
  return achouCabecalho && out.length ? { linhas: out, conferidas, divergentes } : null;
}

/**
 * Fatura de cartão em CSV costuma trazer compras positivas: se a maioria for positiva, inverte os sinais
 * (no MyGrana, saída é negativa). Créditos (pagamento da fatura, estornos) ficam positivos.
 */
export function normalizarSinalCartao(linhas: LinhaImportada[]) {
  const positivas = linhas.filter((l) => l.valorCentavos > 0).length;
  return positivas > linhas.length / 2 ? linhas.map((l) => ({ ...l, valorCentavos: -l.valorCentavos })) : linhas;
}

const normalizar = (s: string) => semAcento(s).replace(/\s+/g, " ").trim();

/**
 * Chave de duplicado (cabe na coluna de 64): OFX/CSV com id → id na mesma conta;
 * sem id → data + valor + descrição normalizada + ordem entre linhas idênticas.
 */
export function chaveDuplicado(destinoId: string, l: LinhaImportada, repeticao = 0) {
  const base = l.idExterno
    ? `id|${destinoId}|${l.idExterno}`
    : `csv|${destinoId}|${l.data}|${l.valorCentavos}|${normalizar(l.descricao)}|${repeticao}`;
  return `arq:${createHash("sha256").update(base).digest("hex").slice(0, 40)}`;
}

/** Lê bytes como UTF-8; se aparecerem caracteres inválidos, cai para Windows-1252 (comum em OFX). */
export function decodificar(bytes: Uint8Array) {
  const utf8 = new TextDecoder("utf-8").decode(bytes);
  return utf8.includes("�") ? new TextDecoder("windows-1252").decode(bytes) : utf8;
}
