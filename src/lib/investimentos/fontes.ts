/**
 * Fontes externas — só no servidor (nunca importar em componente "use client").
 * Cada chamada tem tempo limite, cache do Next e validação do símbolo (evita SSRF/injeção na URL).
 */
import type { Indices } from "./calculo";

const TICKER = /^[A-Z0-9]{2,12}$/;
const TEMPO_LIMITE = 8000;

const brParaIso = (d: string) => `${d.slice(6, 10)}-${d.slice(3, 5)}-${d.slice(0, 2)}`;
const isoParaBr = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)}`;

/** Série do SGS/Banco Central. Diárias aceitam no máximo 10 anos por consulta, então divide em janelas. */
async function serieBcb(codigo: number, desde: string, ate: string): Promise<Map<string, number> | null> {
  const mapa = new Map<string, number>();
  const anoIni = Number(desde.slice(0, 4));
  const anoFim = Number(ate.slice(0, 4));
  for (let a = anoIni; a <= anoFim; a += 9) {
    const ini = a === anoIni ? `${anoIni}-01-01` : `${a}-01-01`;
    const fim = Math.min(a + 8, anoFim) === anoFim ? ate : `${a + 8}-12-31`;
    const url = `https://api.bcb.gov.br/dados/serie/bcdata.sgs.${codigo}/dados?formato=json&dataInicial=${isoParaBr(ini)}&dataFinal=${isoParaBr(fim)}`;
    try {
      const res = await fetch(url, { next: { revalidate: 43_200 }, signal: AbortSignal.timeout(TEMPO_LIMITE) });
      if (!res.ok) return null;
      const dados: unknown = await res.json();
      if (!Array.isArray(dados)) return null;
      for (const p of dados as { data?: string; valor?: string }[]) {
        if (typeof p.data !== "string" || typeof p.valor !== "string") continue;
        const v = Number(p.valor);
        if (Number.isFinite(v)) mapa.set(brParaIso(p.data), v);
      }
    } catch {
      return null;
    }
  }
  return mapa;
}

/** CDI (12), Selic (11) diários e IPCA (433) mensal desde a primeira operação. Cache de 12 h. */
export async function carregarIndices(desde: string, hoje: string): Promise<{ indices: Indices; ok: boolean }> {
  // Começa em 1º de janeiro para que várias páginas compartilhem o mesmo cache.
  const ini = `${desde.slice(0, 4)}-01-01`;
  const [cdi, selic, ipcaDiario] = await Promise.all([serieBcb(12, ini, hoje), serieBcb(11, ini, hoje), serieBcb(433, ini, hoje)]);
  const ipca = new Map<string, number>();
  for (const [d, v] of ipcaDiario ?? []) ipca.set(d.slice(0, 7), v);
  return {
    indices: { cdi: cdi ?? new Map(), selic: selic ?? new Map(), ipca },
    ok: cdi !== null && selic !== null && ipcaDiario !== null,
  };
}

/** Cotação de ação/FII/ETF/BDR pela brapi.dev (plano grátis: 1 ativo por requisição). Cache de 30 min. */
export async function cotacaoB3(ticker: string): Promise<number | null> {
  if (!TICKER.test(ticker)) return null;
  const token = process.env.BRAPI_TOKEN;
  try {
    const res = await fetch(`https://brapi.dev/api/quote/${ticker}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      next: { revalidate: 1800 },
      signal: AbortSignal.timeout(TEMPO_LIMITE),
    });
    if (!res.ok) return null;
    const j = (await res.json()) as { results?: { regularMarketPrice?: unknown }[] };
    const p = j.results?.[0]?.regularMarketPrice;
    return typeof p === "number" && Number.isFinite(p) && p > 0 ? p : null;
  } catch {
    return null;
  }
}

/** Cotação de cripto em reais pelo Mercado Bitcoin (API pública, sem chave). Cache de 5 min. */
export async function cotacaoCripto(simbolo: string): Promise<number | null> {
  if (!TICKER.test(simbolo)) return null;
  try {
    const res = await fetch(`https://api.mercadobitcoin.net/api/v4/tickers?symbols=${simbolo}-BRL`, {
      next: { revalidate: 300 },
      signal: AbortSignal.timeout(TEMPO_LIMITE),
    });
    if (!res.ok) return null;
    const j: unknown = await res.json();
    const ultimo = Array.isArray(j) ? Number((j[0] as { last?: string })?.last) : NaN;
    return Number.isFinite(ultimo) && ultimo > 0 ? ultimo : null;
  } catch {
    return null;
  }
}

export const temTokenBrapi = () => !!process.env.BRAPI_TOKEN;
