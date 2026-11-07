"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export function FormVerificar() {
  const router = useRouter();
  const [codigo, setCodigo] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null); setOcupado(true);
    const supabase = createClient();
    const { data } = await supabase.auth.mfa.listFactors();
    const fator = data?.totp?.[0];
    if (!fator) { setOcupado(false); setErro("Nenhum autenticador encontrado. Entre de novo."); return; }
    const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId: fator.id, code: codigo.replace(/\D/g, "") });
    if (error) { setOcupado(false); setErro("Código incorreto ou expirado. Use o código que está aparecendo agora."); return; }
    router.replace("/");
    router.refresh();
  }

  return (
    <form onSubmit={enviar} className="mt-8 space-y-4">
      <div>
        <label htmlFor="codigo" className="rotulo">Código do app autenticador</label>
        <input id="codigo" inputMode="numeric" autoComplete="one-time-code" autoFocus pattern="[0-9 ]{6,7}" maxLength={7} required value={codigo}
          onChange={(e) => setCodigo(e.target.value)} className="campo text-center font-mono text-xl tracking-[0.3em]" />
      </div>
      {erro && <p role="alert" className="rounded-xl bg-despesa/10 px-4 py-3 text-[15px] font-medium text-despesa">{erro}</p>}
      <button className="btn w-full" disabled={ocupado}>{ocupado ? "Conferindo…" : "Entrar"}</button>
    </form>
  );
}
