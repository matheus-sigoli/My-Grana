import Link from "next/link";
import { Lottie } from "@/components/lottie";

export function BoasVindas({ nome }: { nome?: string }) {
  return (
    <div className="mx-auto max-w-xl py-6 text-center sm:py-10">
      <Lottie src="/animacoes/vazio.json" className="mx-auto h-40 w-52" />
      <h1 className="mt-4 font-display text-[34px] font-bold leading-tight tracking-[-0.02em]">Bem-vindo{nome ? `, ${nome}` : ""}!</h1>
      <p className="mt-2 text-[15px] text-suave">Vamos organizar? São dois passos.</p>
      <ol className="mt-8 space-y-3 text-left">
        <li className="painel flex items-center gap-4">
          <span className="grid size-10 shrink-0 place-items-center rounded-full bg-acento font-display text-lg font-bold text-[#0f1b17]" aria-hidden="true">1</span>
          <div className="min-w-0 flex-1">
            <p className="font-semibold">Cadastre suas contas</p>
            <p className="text-sm text-suave">Banco, carteira, poupança — com o saldo de hoje.</p>
          </div>
          <Link href="/contas" className="btn shrink-0">Começar</Link>
        </li>
        <li className="painel flex items-center gap-4 bg-fundo">
          <span className="grid size-10 shrink-0 place-items-center rounded-full bg-papel font-display text-lg font-bold text-suave" aria-hidden="true">2</span>
          <div>
            <p className="font-semibold">Lance seus gastos e receitas</p>
            <p className="text-sm text-suave">Suas categorias já estão prontas.</p>
          </div>
        </li>
      </ol>
    </div>
  );
}
