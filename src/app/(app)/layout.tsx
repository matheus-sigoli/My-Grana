import Link from "next/link";
import { Suspense } from "react";
import { Logo } from "@/components/logo";
import { ICONES, LinkAtalho, MenuMais, type Atalho } from "@/components/menu-mais";
import { NavInferior, NavLateral } from "@/components/navegacao";
import { SeletorTema } from "@/components/seletor-tema";
import { AtalhoAvisos, Sino, SinoAvisos } from "@/components/sino-avisos";
import { iaConfigurada } from "@/lib/ia";
import { primeiroNome } from "@/lib/nome";
import { pluggyConfigurado } from "@/lib/openfinance/pluggy";
import { requireUser } from "@/lib/supabase/server";
import { temaAtual } from "@/lib/tema";
import { sair } from "../(auth)/actions";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { supabase, user } = await requireUser();
  const openFinance = pluggyConfigurado();
  const [{ count }, tema] = await Promise.all([
    supabase.from("transacoes_importadas").select("id", { count: "exact", head: true }).eq("situacao", "pendente"),
    temaAtual(),
  ]);
  const nomeCompleto = (user.user_metadata?.nome as string | undefined) || user.email?.split("@")[0] || "";
  const nome = primeiroNome(nomeCompleto);
  const inicial = (nome || "?").slice(0, 1).toUpperCase();

  // Ferramentas: Open Finance e Assistente só aparecem quando estão ativos de verdade.
  const ferramentas: Atalho[] = [
    { href: "/metas", rotulo: "Metas", icone: ICONES.metas },
    { href: "/recorrentes", rotulo: "Recorrentes", icone: ICONES.recorrentes },
    { href: "/calendario", rotulo: "Calendário", icone: ICONES.calendario },
    { href: "/simuladores", rotulo: "Simuladores", icone: ICONES.simuladores },
    ...(iaConfigurada() ? [{ href: "/assistente", rotulo: "Assistente", icone: ICONES.assistente }] : []),
  ];
  const dados: Atalho[] = [
    { href: "/importar", rotulo: "Importar extrato", icone: ICONES.importar },
    { href: "/revisar", rotulo: "Revisar importações", icone: ICONES.revisar, contador: count ?? 0 },
    ...(openFinance ? [{ href: "/conexoes", rotulo: "Open Finance", icone: ICONES.openFinance }] : []),
  ];
  const atalhosCelular: Atalho[] = [
    { href: "/relatorios", rotulo: "Relatórios", icone: "M6 3h9l3 3v15H6zM9 17v-3M12 17v-6M15 17v-4" },
    { href: "/contas", rotulo: "Contas", icone: ICONES.contas },
    { href: "/categorias", rotulo: "Categorias", icone: ICONES.categorias },
    ...ferramentas,
    ...dados,
    { href: "/configuracoes", rotulo: "Configurações", icone: ICONES.configuracoes },
  ];

  return (
    <div className="lg:grid lg:min-h-dvh lg:grid-cols-[256px_1fr]">
      <a href="#conteudo" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-full focus:bg-acento focus:px-4 focus:py-2 focus:font-bold focus:text-[#0f1b17]">
        Pular para o conteúdo
      </a>

      <aside className="sticky top-0 hidden h-dvh flex-col overflow-y-auto border-r border-linha bg-papel px-4 py-6 lg:flex">
        <Link href="/" className="mb-7 px-4" aria-label="MyGrana — painel"><Logo /></Link>
        <NavLateral />
        <Link href="/lancamentos/novo" className="btn mt-5">Novo lançamento</Link>
        <nav aria-label="Ferramentas" className="mt-5 space-y-0.5">
          <p className="px-4 pb-1 text-[12px] font-semibold uppercase tracking-wide text-suave">Ferramentas</p>
          {ferramentas.map((a) => <LinkAtalho key={a.href} a={a} />)}
          <Suspense fallback={<LinkAtalho a={{ href: "/avisos", rotulo: "Avisos", icone: ICONES.avisos }} />}>
            <AtalhoAvisos userId={user.id} />
          </Suspense>
        </nav>
        <nav aria-label="Importação" className="mt-4 space-y-0.5">
          <p className="px-4 pb-1 text-[12px] font-semibold uppercase tracking-wide text-suave">Dados</p>
          {dados.map((a) => <LinkAtalho key={a.href} a={a} />)}
        </nav>
        <div className="mt-auto space-y-3 pt-6">
          <SeletorTema atual={tema} />
          <div className="flex items-center gap-3 rounded-2xl bg-fundo p-3">
            <span className="grid size-9 shrink-0 place-items-center rounded-full bg-marca text-sm font-bold text-papel" aria-hidden="true">{inicial}</span>
            <Link href="/configuracoes" className="min-w-0 flex-1" aria-label="Configurações da conta">
              <p className="truncate text-sm font-semibold">{nome}</p>
              <p className="truncate text-xs text-suave">Configurações</p>
            </Link>
            <form action={sair}>
              <button className="rounded-full px-2 py-1 text-xs font-semibold text-suave hover:bg-papel hover:text-despesa">Sair</button>
            </form>
          </div>
        </div>
      </aside>

      <header className="sticky top-0 z-20 flex items-center justify-between border-b border-linha bg-papel/95 px-4 py-2.5 backdrop-blur-sm lg:hidden">
        <Link href="/" aria-label="MyGrana — painel"><Logo className="text-xl" /></Link>
        <div className="flex items-center gap-0.5">
          <Link href="/lancamentos/novo" className="btn mr-1 min-h-10 px-4 text-sm">Lançar</Link>
          <Suspense fallback={<Sino />}>
            <SinoAvisos userId={user.id} />
          </Suspense>
          <MenuMais atalhos={atalhosCelular} tema={tema} sair={sair} nome={nomeCompleto} email={user.email} />
        </div>
      </header>

      <main id="conteudo" className="mx-auto w-full max-w-6xl px-4 pb-28 pt-6 lg:px-10 lg:pb-14 lg:pt-10">{children}</main>
      <NavInferior />
    </div>
  );
}
