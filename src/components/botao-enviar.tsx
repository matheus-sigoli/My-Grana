"use client";
import { useFormStatus } from "react-dom";

export function BotaoEnviar({ children, className = "btn", enviando = "Salvando…" }: { children: React.ReactNode; className?: string; enviando?: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className={className} disabled={pending}>
      {pending ? enviando : children}
    </button>
  );
}
