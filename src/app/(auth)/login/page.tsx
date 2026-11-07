import Link from "next/link";
import { FormEntrar } from "./form";

export const metadata = { title: "Entrar" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ confirmado?: string; erro?: string; conta?: string }> }) {
  const sp = await searchParams;
  return (
    <>
      <h1 className="font-display text-[34px] font-bold tracking-[-0.02em]">Entrar</h1>
      <p className="mt-1 text-[15px] text-suave">Bom te ver de novo.</p>
      {sp.confirmado && (
        <p role="status" className="mt-5 rounded-xl bg-marca-clara px-4 py-3 text-[15px] text-marca">E-mail confirmado! Agora é só entrar.</p>
      )}
      {sp.conta === "excluida" && (
        <p role="status" className="mt-5 rounded-xl bg-fundo px-4 py-3 text-[15px]">Sua conta e todos os seus dados foram excluídos.</p>
      )}
      {sp.erro && (
        <p role="alert" className="mt-5 rounded-xl bg-despesa/10 px-4 py-3 text-[15px] text-despesa">Esse link de confirmação expirou ou já foi usado. Entre com seu e-mail e senha, ou crie a conta de novo.</p>
      )}
      <FormEntrar />
      <p className="mt-8 text-center text-[15px] text-suave">
        Ainda não tem conta?{" "}
        <Link href="/cadastro" className="link">
          Criar conta
        </Link>
      </p>
    </>
  );
}
