"use client";

import { useEffect, useState, useTransition } from "react";
import { definirTema, type Tema } from "@/app/tema/actions";

const OPCOES: { valor: Tema; rotulo: string; icone: string }[] = [
  { valor: "sistema", rotulo: "Sistema", icone: "M4 5h16v11H4zM9 20h6M12 16v4" },
  { valor: "claro", rotulo: "Claro", icone: "M12 4V2M12 22v-2M4 12H2M22 12h-2M5.6 5.6 4.2 4.2M19.8 19.8l-1.4-1.4M5.6 18.4l-1.4 1.4M19.8 4.2l-1.4 1.4M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0z" },
  { valor: "escuro", rotulo: "Escuro", icone: "M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5z" },
];

export function SeletorTema({ atual }: { atual: Tema }) {
  const [, iniciar] = useTransition();
  const [escolhido, setEscolhido] = useState<Tema>(atual);
  useEffect(() => setEscolhido(atual), [atual]);

  function escolher(t: Tema) {
    // Troca na hora (sem esperar o servidor); o cookie é gravado em segundo plano.
    setEscolhido(t);
    if (t === "sistema") delete document.documentElement.dataset.tema;
    else document.documentElement.dataset.tema = t;
    iniciar(() => definirTema(t));
  }

  return (
    <div role="radiogroup" aria-label="Tema" className="grid grid-cols-3 gap-1 rounded-full bg-fundo p-1">
      {OPCOES.map((o) => (
        <button
          key={o.valor}
          type="button"
          role="radio"
          aria-checked={escolhido === o.valor}
          title={o.rotulo}
          onClick={() => escolher(o.valor)}
          className={`flex min-h-9 items-center justify-center gap-1.5 rounded-full text-[12px] font-semibold transition-colors ${escolhido === o.valor ? "bg-papel text-tinta shadow-sm" : "text-suave hover:text-tinta"}`}
        >
          <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d={o.icone} />
          </svg>
          <span>{o.rotulo}</span>
        </button>
      ))}
    </div>
  );
}
