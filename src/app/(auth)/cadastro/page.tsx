import Link from "next/link";
import { FormCadastro } from "./form";

export const metadata = { title: "Criar conta" };

export default function CadastroPage() {
  return (
    <>
      <h1 className="font-display text-[34px] font-bold tracking-[-0.02em]">Criar conta</h1>
      <p className="mt-1 text-[15px] text-suave">Grátis. Suas categorias já vêm prontas.</p>
      <FormCadastro />
      <p className="mt-8 text-center text-[15px] text-suave">
        Já tem conta?{" "}
        <Link href="/login" className="link">
          Entrar
        </Link>
      </p>
    </>
  );
}
