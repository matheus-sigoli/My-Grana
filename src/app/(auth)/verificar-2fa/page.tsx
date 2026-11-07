import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { sair } from "../actions";
import { FormVerificar } from "./form";

export const metadata = { title: "Verificação em duas etapas" };

export default async function VerificarPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (!aal || aal.nextLevel !== "aal2" || aal.currentLevel === "aal2") redirect("/");

  return (
    <>
      <h1 className="font-display text-[34px] font-bold tracking-[-0.02em]">Só mais um passo</h1>
      <p className="mt-1 text-[15px] text-suave">Digite o código de 6 dígitos do seu app autenticador.</p>
      <FormVerificar />
      <form action={sair} className="mt-6 text-center">
        <button className="text-[15px] font-semibold text-suave hover:text-tinta">Sair e entrar com outra conta</button>
      </form>
    </>
  );
}
