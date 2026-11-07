"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Fator = { id: string; nome: string | null; criado: string };

/** Autenticador (TOTP) do Supabase Auth: ativar com QR code + código, ou desativar. */
export function DoisFatores({ fatores }: { fatores: Fator[] }) {
  const router = useRouter();
  const [novo, setNovo] = useState<{ id: string; qr: string; segredo: string } | null>(null);
  const [codigo, setCodigo] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  async function comecar() {
    setErro(null); setOcupado(true);
    const supabase = createClient();
    // Limpa tentativas anteriores não concluídas (o Supabase guarda fatores "unverified").
    const { data: lista } = await supabase.auth.mfa.listFactors();
    for (const f of lista?.all ?? []) if (f.status === "unverified") await supabase.auth.mfa.unenroll({ factorId: f.id });
    const { data, error } = await supabase.auth.mfa.enroll({ factorType: "totp", friendlyName: `MyGrana ${new Date().toLocaleDateString("pt-BR")} ${Date.now() % 10000}` });
    setOcupado(false);
    if (error || !data) { setErro("Não foi possível começar agora. Tente de novo."); return; }
    setNovo({ id: data.id, qr: data.totp.qr_code, segredo: data.totp.secret });
  }

  async function confirmar(e: React.FormEvent) {
    e.preventDefault();
    if (!novo) return;
    setErro(null); setOcupado(true);
    const { error } = await createClient().auth.mfa.challengeAndVerify({ factorId: novo.id, code: codigo.replace(/\D/g, "") });
    setOcupado(false);
    if (error) { setErro("Código incorreto ou expirado. Confira a hora do celular e tente o código atual."); return; }
    setNovo(null); setCodigo("");
    router.refresh();
  }

  async function desativar(id: string) {
    setErro(null); setOcupado(true);
    const { error } = await createClient().auth.mfa.unenroll({ factorId: id });
    setOcupado(false);
    if (error) { setErro("Não foi possível desativar. Saia, entre de novo com o código e tente outra vez."); return; }
    router.refresh();
  }

  if (fatores.length > 0) {
    return (
      <div className="space-y-3">
        <p className="flex items-center gap-2 text-[15px] font-semibold text-receita"><span aria-hidden="true">●</span> Verificação em duas etapas ativa</p>
        <p className="text-[13px] text-suave">Ao entrar, pedimos o código do app autenticador. Seus dados só abrem depois dele.</p>
        {fatores.map((f) => (
          <div key={f.id} className="flex items-center justify-between gap-3 rounded-xl bg-fundo px-3 py-2 text-[15px]">
            <span className="truncate">{f.nome ?? "Autenticador"}</span>
            <button type="button" onClick={() => desativar(f.id)} disabled={ocupado} className="btn-perigo min-h-9 px-3 text-sm">Desativar</button>
          </div>
        ))}
        {erro && <p role="alert" className="text-[13px] font-semibold text-despesa">{erro}</p>}
      </div>
    );
  }

  if (novo) {
    return (
      <form onSubmit={confirmar} className="space-y-4">
        <ol className="space-y-1 text-[15px]">
          <li>1. Abra o Google Authenticator, Microsoft Authenticator, 1Password ou similar.</li>
          <li>2. Leia o QR code abaixo (ou digite a chave).</li>
          <li>3. Digite o código de 6 dígitos que aparecer.</li>
        </ol>
        {/* QR gerado pelo Supabase como imagem SVG (data:) — não é HTML injetado. */}
        <img src={novo.qr} alt="QR code para o app autenticador" width={180} height={180} className="rounded-xl bg-white p-2" />
        <p className="break-all text-[13px] text-suave">Chave: <code className="font-mono text-tinta">{novo.segredo}</code></p>
        <div>
          <label htmlFor="codigo-2fa" className="rotulo">Código de 6 dígitos</label>
          <input id="codigo-2fa" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9 ]{6,7}" maxLength={7} required value={codigo} onChange={(e) => setCodigo(e.target.value)} className="campo w-40 text-center font-mono text-lg tracking-widest" />
        </div>
        {erro && <p role="alert" className="text-[13px] font-semibold text-despesa">{erro}</p>}
        <div className="flex gap-2">
          <button className="btn" disabled={ocupado}>{ocupado ? "Conferindo…" : "Ativar"}</button>
          <button type="button" className="btn-sec" onClick={() => setNovo(null)}>Cancelar</button>
        </div>
      </form>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-[15px] text-suave">Além da senha, peça um código do celular para entrar. Recomendado para quem conecta bancos.</p>
      {erro && <p role="alert" className="text-[13px] font-semibold text-despesa">{erro}</p>}
      <button type="button" className="btn" onClick={comecar} disabled={ocupado}>{ocupado ? "Aguarde…" : "Ativar verificação em duas etapas"}</button>
    </div>
  );
}
