"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { pedirTokenConexao, salvarConexao } from "@/app/(app)/conexoes/actions";

type Instancia = { init: () => void };
type Construtor = new (opcoes: Record<string, unknown>) => Instancia;
declare global {
  interface Window { PluggyConnect?: Construtor }
}

const SCRIPTS = [
  "https://cdn.pluggy.ai/pluggy-connect/v2.8.1/pluggy-connect.js",
  "https://cdn.pluggy.ai/pluggy-connect/latest/pluggy-connect.js",
];

/** Carrega o widget oficial da Pluggy sob demanda (só nesta página). */
async function carregarWidget(): Promise<Construtor> {
  if (window.PluggyConnect) return window.PluggyConnect;
  for (const src of SCRIPTS) {
    try {
      await new Promise<void>((ok, falha) => {
        const s = document.createElement("script");
        s.src = src;
        s.async = true;
        s.onload = () => ok();
        s.onerror = () => falha(new Error(src));
        document.head.appendChild(s);
      });
      if (window.PluggyConnect) return window.PluggyConnect;
    } catch {
      // tenta o próximo endereço
    }
  }
  throw new Error("widget indisponível");
}

export function BotaoConectar({ itemId, rotulo = "Conectar banco", secundario = false }: { itemId?: string; rotulo?: string; secundario?: boolean }) {
  const router = useRouter();
  const [estado, setEstado] = useState<"livre" | "abrindo" | "salvando">("livre");
  const [erro, setErro] = useState<string | null>(null);

  async function abrir() {
    setErro(null);
    setEstado("abrindo");
    const { token, erro: e } = await pedirTokenConexao(itemId);
    if (!token) {
      setErro(e ?? "Não foi possível iniciar a conexão.");
      setEstado("livre");
      return;
    }
    try {
      const Pluggy = await carregarWidget();
      new Pluggy({
        connectToken: token,
        includeSandbox: true,
        language: "pt",
        ...(itemId ? { updateItem: itemId } : {}),
        onSuccess: async (dados: { item?: { id?: string }; id?: string }) => {
          const id = dados?.item?.id ?? dados?.id;
          if (!id) return;
          setEstado("salvando");
          const r = await salvarConexao(id);
          if (r.erro) setErro(r.erro);
          setEstado("livre");
          router.refresh();
        },
        onError: () => setErro("A conexão não foi concluída. Tente de novo."),
        onClose: () => setEstado((s) => (s === "abrindo" ? "livre" : s)),
      }).init();
    } catch {
      setErro("Não foi possível carregar o widget da Pluggy. Verifique sua internet ou bloqueadores de anúncio.");
      setEstado("livre");
    }
  }

  return (
    <div>
      <button type="button" onClick={abrir} disabled={estado !== "livre"} className={secundario ? "btn-sec" : "btn"}>
        {estado === "abrindo" ? "Abrindo…" : estado === "salvando" ? "Sincronizando…" : rotulo}
      </button>
      {erro && <p role="alert" className="mt-2 text-[15px] font-medium text-despesa">{erro}</p>}
    </div>
  );
}
