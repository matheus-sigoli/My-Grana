import { Logo } from "@/components/logo";
import { Lottie } from "@/components/lottie";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="grid min-h-dvh lg:grid-cols-[1.1fr_1fr]">
      <section className="relative hidden flex-col justify-between overflow-hidden bg-destaque p-12 text-white lg:flex" aria-hidden="true">
        <Logo className="text-white" />
        <div className="max-w-lg">
          <Lottie src="/animacoes/marca.json" className="-ml-6 h-36 w-48" />
          <p className="mt-6 font-display text-[56px] font-extrabold leading-[0.95] tracking-[-0.03em]">
            Seu dinheiro, enfim no lugar.
          </p>
          <p className="mt-5 max-w-md text-[17px] leading-relaxed text-white/75">
            Contas, cartões, investimentos e metas — e quanto sobra no fim do mês — num painel só.
          </p>
        </div>
        <p className="text-sm text-white/50">MyGrana · controle financeiro pessoal</p>
      </section>
      <section className="flex items-center justify-center px-4 py-12 sm:px-8">
        <div className="w-full max-w-sm">
          <Logo className="mb-10 block lg:hidden" />
          {children}
        </div>
      </section>
    </main>
  );
}
