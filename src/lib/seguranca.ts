/**
 * Content-Security-Policy com nonce por requisição.
 * - scripts: só os do próprio app com o nonce ('strict-dynamic' libera os chunks que eles carregam);
 * - estilos: 'unsafe-inline' é necessário para atributos style (React/Lottie) — não executa código;
 * - conexões: só o próprio site e o Supabase do projeto.
 */
export function montarCsp(nonce: string) {
  const dev = process.env.NODE_ENV !== "production";
  const supabase = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const supabaseWs = supabase.replace(/^https:/, "wss:");

  const diretivas = [
    `default-src 'self'`,
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${dev ? " 'unsafe-eval'" : ""}`,
    `style-src 'self' 'unsafe-inline'`,
    `img-src 'self' data: blob: https:`,
    `font-src 'self'`,
    `frame-src 'self' https://*.pluggy.ai`,
    `connect-src 'self' ${supabase} ${supabaseWs} https://*.pluggy.ai${dev ? " ws://localhost:* http://localhost:* ws://127.0.0.1:* http://127.0.0.1:*" : ""}`,
    `object-src 'none'`,
    `base-uri 'self'`,
    `form-action 'self'`,
    `frame-ancestors 'none'`,
    ...(dev ? [] : ["upgrade-insecure-requests"]),
  ];
  return diretivas.join("; ");
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const ehUuid = (v: unknown): v is string => typeof v === "string" && UUID.test(v);
export const ehCor = (v: unknown): v is string => typeof v === "string" && /^#[0-9a-f]{6}$/i.test(v);

/** Lê um campo de texto do form, aparado e limitado (nunca confia no maxLength do navegador). */
export function texto(fd: FormData, campo: string, max: number) {
  const v = fd.get(campo);
  return typeof v === "string" ? v.trim().slice(0, max) : "";
}

/** Data AAAA-MM-DD real e dentro do intervalo aceito pelo banco (31/02 não passa). */
export function dataIsoValida(v: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v) || v < "2000-01-01" || v > "2100-12-31") return false;
  const t = Date.parse(`${v}T00:00:00Z`);
  return !Number.isNaN(t) && new Date(t).toISOString().slice(0, 10) === v;
}

/** id opcional: string vazia vira null; qualquer coisa que não seja UUID é rejeitada. */
export function idOpcional(fd: FormData, campo: string): string | null | false {
  const v = texto(fd, campo, 64);
  if (!v) return null;
  return ehUuid(v) ? v : false;
}
