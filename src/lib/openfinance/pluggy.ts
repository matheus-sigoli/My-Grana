/**
 * Cliente da API da Pluggy — SÓ NO SERVIDOR (usa PLUGGY_CLIENT_SECRET). Ver ADR-0008.
 * Nunca importe este arquivo em componente "use client".
 */

const BASE = "https://api.pluggy.ai";
const ID = /^[0-9A-Za-z-]{1,64}$/;
const TEMPO_LIMITE = 15_000;

export class ErroPluggy extends Error {
  constructor(public status: number, mensagem: string) {
    super(mensagem);
  }
}

export const pluggyConfigurado = () => !!(process.env.PLUGGY_CLIENT_ID && process.env.PLUGGY_CLIENT_SECRET);

// A API key vale 2 h; guardamos por 100 min na memória do servidor.
let chaveEmCache: { valor: string; expira: number } | null = null;

async function apiKey(): Promise<string> {
  if (chaveEmCache && chaveEmCache.expira > Date.now()) return chaveEmCache.valor;
  if (!pluggyConfigurado()) throw new ErroPluggy(0, "Open Finance não configurado");
  const res = await fetch(`${BASE}/auth`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ clientId: process.env.PLUGGY_CLIENT_ID, clientSecret: process.env.PLUGGY_CLIENT_SECRET }),
    cache: "no-store",
    signal: AbortSignal.timeout(TEMPO_LIMITE),
  });
  if (!res.ok) throw new ErroPluggy(res.status, "Falha ao autenticar na Pluggy");
  const j = (await res.json()) as { apiKey?: string };
  if (!j.apiKey) throw new ErroPluggy(500, "Resposta inesperada da Pluggy");
  chaveEmCache = { valor: j.apiKey, expira: Date.now() + 100 * 60_000 };
  return j.apiKey;
}

async function chamar<T>(caminho: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${BASE}${caminho}`, {
    ...init,
    headers: { "Content-Type": "application/json", "X-API-KEY": await apiKey(), ...(init.headers ?? {}) },
    cache: "no-store",
    signal: AbortSignal.timeout(TEMPO_LIMITE),
  });
  if (res.status === 401 || res.status === 403) chaveEmCache = null;
  if (!res.ok) throw new ErroPluggy(res.status, `Pluggy respondeu ${res.status}`);
  return res.status === 204 ? (undefined as T) : ((await res.json()) as T);
}

const validar = (id: string) => {
  if (!ID.test(id)) throw new ErroPluggy(400, "Identificador inválido");
  return id;
};

/** Token de 30 min para abrir o widget. clientUserId amarra a conexão ao usuário do MyGrana. */
export async function criarConnectToken(clientUserId: string, itemId?: string) {
  const corpo: Record<string, unknown> = { options: { clientUserId, avoidDuplicates: true } };
  if (itemId) corpo.itemId = validar(itemId);
  const j = await chamar<{ accessToken?: string }>("/connect_token", { method: "POST", body: JSON.stringify(corpo) });
  if (!j.accessToken) throw new ErroPluggy(500, "Resposta inesperada da Pluggy");
  return j.accessToken;
}

export type ItemPluggy = {
  id: string;
  status?: string;
  executionStatus?: string;
  clientUserId?: string | null;
  connector?: { name?: string };
  error?: { message?: string } | null;
};

export const buscarItem = (itemId: string) => chamar<ItemPluggy>(`/items/${validar(itemId)}`);
export const atualizarItem = (itemId: string) => chamar<ItemPluggy>(`/items/${validar(itemId)}`, { method: "PATCH", body: "{}" });
export const excluirItemPluggy = (itemId: string) => chamar<void>(`/items/${validar(itemId)}`, { method: "DELETE" });

export type ContaPluggy = { id: string; type?: string; subtype?: string; name?: string; marketingName?: string; number?: string; balance?: number };

export async function listarContas(itemId: string) {
  const j = await chamar<{ results?: ContaPluggy[] }>(`/accounts?itemId=${validar(itemId)}`);
  return j.results ?? [];
}

export type TransacaoPluggy = { id: string; date: string; description?: string; amount: number; type?: "DEBIT" | "CREDIT"; category?: string | null };

/** Transações desde `de` (YYYY-MM-DD), todas as páginas (limite de segurança: 20 × 500). */
export async function listarTransacoes(accountId: string, de: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(de)) throw new ErroPluggy(400, "Data inválida");
  const todas: TransacaoPluggy[] = [];
  for (let pagina = 1; pagina <= 20; pagina++) {
    const j = await chamar<{ results?: TransacaoPluggy[]; totalPages?: number }>(
      `/transactions?accountId=${validar(accountId)}&from=${de}&pageSize=500&page=${pagina}`,
    );
    todas.push(...(j.results ?? []));
    if (!j.totalPages || pagina >= j.totalPages) break;
  }
  return todas;
}

/** Valor em centavos com sinal do ponto de vista da conta: saída negativa, entrada positiva. */
export function valorComSinal(t: TransacaoPluggy) {
  const abs = Math.round(Math.abs(Number(t.amount)) * 100);
  if (t.type === "DEBIT") return -abs;
  if (t.type === "CREDIT") return abs;
  return Math.round(Number(t.amount) * 100);
}
