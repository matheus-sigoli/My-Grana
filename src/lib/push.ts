import "server-only";
import webpush from "web-push";

/** Push (M8). Chaves VAPID: a pública vai para o navegador; a privada fica só no servidor. */
export const pushConfigurado = () =>
  !!(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY && process.env.VAPID_SUBJECT);

let pronto = false;
function configurar() {
  if (pronto) return;
  webpush.setVapidDetails(process.env.VAPID_SUBJECT!, process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!, process.env.VAPID_PRIVATE_KEY!);
  pronto = true;
}

export type Inscricao = { endpoint: string; p256dh: string; auth: string };
export type Mensagem = { titulo: string; texto: string; href: string; tag?: string };

/** Envia; devolve "expirada" quando o navegador cancelou a inscrição (404/410) para apagarmos a linha. */
export async function enviarPush(i: Inscricao, m: Mensagem): Promise<"ok" | "expirada" | "erro"> {
  configurar();
  try {
    await webpush.sendNotification({ endpoint: i.endpoint, keys: { p256dh: i.p256dh, auth: i.auth } }, JSON.stringify(m), { TTL: 60 * 60 * 12, urgency: "normal" });
    return "ok";
  } catch (e) {
    const status = (e as { statusCode?: number }).statusCode;
    return status === 404 || status === 410 ? "expirada" : "erro";
  }
}
