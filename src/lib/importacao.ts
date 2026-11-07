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
};

export const MAX_BYTES = 2 * 1024 * 1024;
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
    const descricao = limparTexto(campo(b, "MEMO") || campo(b, "NAME") || "Sem descrição");
    if (!data || valor === null || valor === 0) continue;
    linhas.push({ data, descricao, valorCentavos: valor, idExterno: campo(b, "FITID").slice(0, 120) || null });
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
