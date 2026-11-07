"use client";
import { useEffect, useState } from "react";
import { removerInscricao, salvarInscricao } from "@/app/(app)/avisos/actions";

type Estado = "carregando" | "indisponivel" | "bloqueado" | "desligado" | "ligado" | "erro";

function chaveParaBytes(b64: string) {
  const pad = "=".repeat((4 - (b64.length % 4)) % 4);
  const bin = atob((b64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

/** Liga/desliga o resumo diário no celular ou computador (Web Push). A chave pública VAPID vem do servidor. */
export function BotaoPush({ chavePublica }: { chavePublica: string }) {
  const [estado, setEstado] = useState<Estado>("carregando");

  useEffect(() => {
    if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
      setEstado("indisponivel");
      return;
    }
    if (Notification.permission === "denied") { setEstado("bloqueado"); return; }
    navigator.serviceWorker.register("/sw.js", { scope: "/" })
      .then((reg) => reg.pushManager.getSubscription())
      .then((s) => setEstado(s ? "ligado" : "desligado"))
      .catch(() => setEstado("indisponivel"));
  }, []);

  async function ligar() {
    setEstado("carregando");
    try {
      const permissao = await Notification.requestPermission();
      if (permissao !== "granted") { setEstado(permissao === "denied" ? "bloqueado" : "desligado"); return; }
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: chaveParaBytes(chavePublica) });
      const j = sub.toJSON();
      const r = await salvarInscricao({ endpoint: sub.endpoint, p256dh: j.keys?.p256dh ?? "", auth: j.keys?.auth ?? "" });
      if (!r.ok) { await sub.unsubscribe(); setEstado("erro"); return; }
      setEstado("ligado");
    } catch {
      setEstado("erro");
    }
  }

  async function desligar() {
    setEstado("carregando");
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (sub) {
      await removerInscricao(sub.endpoint);
      await sub.unsubscribe();
    }
    setEstado("desligado");
  }

  if (estado === "indisponivel") return <p className="text-[15px] text-suave">Este navegador não recebe notificações. No iPhone, instale o MyGrana na tela de início (Compartilhar → Adicionar à Tela de Início) e abra por lá.</p>;
  if (estado === "bloqueado") return <p className="text-[15px] text-suave">As notificações estão bloqueadas para este site. Libere nas configurações do navegador e recarregue.</p>;
  return (
    <div className="flex flex-wrap items-center gap-3">
      {estado === "ligado" ? (
        <button type="button" onClick={desligar} className="btn-sec">Desligar neste aparelho</button>
      ) : (
        <button type="button" onClick={ligar} disabled={estado === "carregando"} className="btn">
          {estado === "carregando" ? "Aguarde…" : "Receber avisos neste aparelho"}
        </button>
      )}
      <p className="text-[13px] text-suave" aria-live="polite">
        {estado === "ligado" ? "Ligado: um resumo por dia, de manhã, só quando houver algo." : estado === "erro" ? "Não deu certo. Tente de novo." : ""}
      </p>
    </div>
  );
}
