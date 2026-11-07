"use client";

import { useEffect, useState } from "react";
import { useFormStatus } from "react-dom";

/** Botão de exclusão em dois passos: o primeiro clique pede confirmação; some sozinho após 5s. */
export function BotaoConfirmar({ children, confirmar = "Confirmar exclusão" }: { children: React.ReactNode; confirmar?: string }) {
  const [armado, setArmado] = useState(false);
  const { pending } = useFormStatus();

  useEffect(() => {
    if (!armado) return;
    const t = setTimeout(() => setArmado(false), 5000);
    return () => clearTimeout(t);
  }, [armado]);

  if (!armado) {
    return (
      <button type="button" className="btn-perigo w-full" onClick={() => setArmado(true)}>
        {children}
      </button>
    );
  }
  return (
    <button type="submit" disabled={pending} className="inline-flex min-h-11 w-full items-center justify-center rounded-full bg-despesa px-4 text-[15px] font-bold text-white" aria-live="polite">
      {pending ? "Excluindo…" : confirmar}
    </button>
  );
}
