import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { carregarAvisos } from "@/lib/dados-avisos";
import { hojeISO } from "@/lib/datas";
import { enviarPush, pushConfigurado } from "@/lib/push";
import { adminConfigurado, createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function autorizado(req: NextRequest) {
  const segredo = process.env.CRON_SECRET;
  if (!segredo || segredo.length < 16) return false;
  const recebido = Buffer.from(req.headers.get("authorization") ?? "");
  const esperado = Buffer.from(`Bearer ${segredo}`);
  return recebido.length === esperado.length && timingSafeEqual(recebido, esperado);
}

/**
 * Resumo diário por push (Vercel Cron, 1x por dia). Protegido por CRON_SECRET.
 * Usa a chave de serviço só para ler os avisos de quem ligou as notificações — sempre filtrando por user_id.
 */
export async function GET(req: NextRequest) {
  if (!autorizado(req)) return new NextResponse("Não autorizado", { status: 401 });
  if (!pushConfigurado() || !adminConfigurado()) return NextResponse.json({ enviados: 0, motivo: "desligado" });

  const admin = createAdminClient();
  const hoje = hojeISO();
  const { data: inscricoes } = await admin.from("inscricoes_push").select("id,user_id,endpoint,p256dh,auth").limit(2000);
  const porUsuario = new Map<string, typeof inscricoes>();
  for (const i of inscricoes ?? []) porUsuario.set(i.user_id, [...(porUsuario.get(i.user_id) ?? []), i]);

  let enviados = 0, expiradas = 0;
  for (const [userId, lista] of porUsuario) {
    const avisos = await carregarAvisos(admin, userId, hoje).catch(() => []);
    const relevantes = avisos.filter((a) => a.nivel === "alerta" || a.titulo.includes("vence"));
    if (relevantes.length === 0) continue;
    const msg = relevantes.length === 1
      ? { titulo: relevantes[0].titulo, texto: relevantes[0].texto, href: relevantes[0].href, tag: "mygrana-resumo" }
      : { titulo: `${relevantes.length} avisos para hoje`, texto: relevantes.slice(0, 3).map((a) => a.titulo).join(" · "), href: "/avisos", tag: "mygrana-resumo" };
    for (const i of lista ?? []) {
      const r = await enviarPush(i, msg);
      if (r === "ok") enviados++;
      if (r === "expirada") { expiradas++; await admin.from("inscricoes_push").delete().eq("id", i.id).eq("user_id", userId); }
    }
  }
  return NextResponse.json({ enviados, expiradas });
}
