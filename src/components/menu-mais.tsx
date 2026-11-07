import Link from "next/link";
import type { Tema } from "@/app/tema/actions";
import { SeletorTema } from "./seletor-tema";

export type Atalho = { href: string; rotulo: string; icone: string; contador?: number };

export const ICONES = {
  recorrentes: "M4 12a8 8 0 0 1 14-5.3M20 12a8 8 0 0 1-14 5.3M18 3v4h-4M6 21v-4h4",
  openFinance: "M3 10h18M5 10v8M9.5 10v8M14.5 10v8M19 10v8M3 20h18M12 3l9 5H3z",
  revisar: "M4 5h16v14H4zM4 13h5l1.5 2h3L15 13h5",
  contas: "M3.5 8.5h17v10h-17zM3.5 8.5l2-3h13l2 3M15.5 13.5h2",
  categorias: "M4 7.5 12 4l8 3.5-8 3.5zM4 12l8 3.5 8-3.5M4 16.5 12 20l8-3.5",
  metas: "M12 21a9 9 0 1 1 0-18 9 9 0 0 1 0 18zM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8zM12 12h.01",
  calendario: "M4 6h16v14H4zM4 10h16M8 3v4M16 3v4M8 14h2M14 14h2M8 17h2",
  simuladores: "M6 3h12v18H6zM9 7h6M9 11h.01M12 11h.01M15 11h.01M9 14h.01M12 14h.01M15 14h.01M9 17h6",
  importar: "M12 4v11M7.5 10.5 12 15l4.5-4.5M4 17v3h16v-3",
  assistente: "M12 3l1.8 4.7L18.5 9l-4.7 1.8L12 15.5l-1.8-4.7L5.5 9l4.7-1.3zM18 15l.9 2.1L21 18l-2.1.9L18 21l-.9-2.1L15 18l2.1-.9z",
  avisos: "M6 16V11a6 6 0 1 1 12 0v5l2 2H4zM10 20a2 2 0 0 0 4 0",
  configuracoes: "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z",
};

export function IconeLinha({ d }: { d: string }) {
  return (
    <svg viewBox="0 0 24 24" className="size-[18px] shrink-0" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={d} />
    </svg>
  );
}

export function LinkAtalho({ a }: { a: Atalho }) {
  return (
    <Link href={a.href} className="flex min-h-11 items-center gap-3 rounded-full px-4 text-[14px] font-semibold text-suave transition-colors hover:bg-fundo hover:text-tinta">
      <IconeLinha d={a.icone} />
      <span className="flex-1">{a.rotulo}</span>
      {!!a.contador && <span className="rounded-full bg-acento px-2 text-[12px] font-bold text-[#0f1b17]">{a.contador}</span>}
    </Link>
  );
}

/** Menu "Mais" do celular: atalhos, tema e sair. Usa <details>, então funciona sem JavaScript. */
export function MenuMais({ atalhos, tema, sair, nome, email }: { atalhos: Atalho[]; tema: Tema; sair: () => Promise<void>; nome?: string; email?: string }) {
  return (
    <details className="group relative">
      <summary className="grid size-10 cursor-pointer list-none place-items-center rounded-full text-suave hover:bg-fundo hover:text-tinta [&::-webkit-details-marker]:hidden" aria-label="Mais opções">
        <svg viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden="true">
          <path d="M4 7h16M4 12h16M4 17h16" />
        </svg>
      </summary>
      <div className="absolute right-0 top-12 z-30 max-h-[calc(100dvh-5rem)] w-72 overflow-y-auto overscroll-contain rounded-2xl border border-linha bg-papel p-3 shadow-[0_12px_40px_rgb(0_0_0/0.18)]">
        {nome && (
          <div className="mb-2 border-b border-linha px-3 pb-3">
            <p className="truncate font-semibold">{nome}</p>
            <p className="truncate text-[13px] text-suave">{email}</p>
          </div>
        )}
        <nav aria-label="Mais">{atalhos.map((a) => <LinkAtalho key={a.href} a={a} />)}</nav>
        <div className="mt-2 border-t border-linha px-1 pt-3">
          <p className="mb-2 px-2 text-[13px] font-semibold text-suave">Aparência</p>
          <SeletorTema atual={tema} />
        </div>
        <form action={sair} className="mt-2 border-t border-linha pt-2">
          <button className="flex min-h-11 w-full items-center rounded-full px-4 text-[14px] font-semibold text-despesa hover:bg-despesa/10">Sair</button>
        </form>
      </div>
    </details>
  );
}
