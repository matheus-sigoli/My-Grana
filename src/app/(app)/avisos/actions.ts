"use server";

import { requireUser } from "@/lib/supabase/server";

const B64URL = /^[A-Za-z0-9_-]+={0,2}$/;

/** Hosts dos serviços de push dos navegadores (Chrome/Edge, Firefox, Safari). Evita guardar URLs arbitrárias (SSRF no envio). */
const HOSTS_PUSH = [/\.googleapis\.com$/, /\.mozilla\.com$/, /\.mozaws\.net$/, /\.push\.apple\.com$/, /\.notify\.windows\.com$/];

export async function salvarInscricao(i: { endpoint: string; p256dh: string; auth: string }): Promise<{ ok: boolean }> {
  const { supabase } = await requireUser();
  let url: URL;
  try { url = new URL(String(i?.endpoint)); } catch { return { ok: false }; }
  if (url.protocol !== "https:" || !HOSTS_PUSH.some((h) => h.test(url.hostname)) || i.endpoint.length > 1000) return { ok: false };
  if (!B64URL.test(String(i.p256dh)) || i.p256dh.length > 200 || !B64URL.test(String(i.auth)) || i.auth.length > 100) return { ok: false };
  // Mesmo navegador de novo: substitui (o endpoint é único; se for de outra conta, a RLS impede ver/alterar).
  await supabase.from("inscricoes_push").delete().eq("endpoint", i.endpoint);
  const { error } = await supabase.from("inscricoes_push").insert({ endpoint: i.endpoint, p256dh: i.p256dh, auth: i.auth });
  return { ok: !error };
}

export async function removerInscricao(endpoint: string): Promise<{ ok: boolean }> {
  const { supabase } = await requireUser();
  if (typeof endpoint !== "string" || endpoint.length > 1000) return { ok: false };
  await supabase.from("inscricoes_push").delete().eq("endpoint", endpoint);
  return { ok: true };
}
