"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const ITENS: { href: string; rotulo: string; curto?: string; icone: string; soLateral?: boolean }[] = [
  { href: "/", rotulo: "Painel", icone: "M4 13h6V4H4zM14 20h6v-9h-6zM4 20h6v-3H4zM14 7h6V4h-6z" },
  { href: "/lancamentos", rotulo: "Lançamentos", icone: "M5 7h14M5 12h14M5 17h9" },
  { href: "/planejamento", rotulo: "Planejamento", curto: "Planejar", icone: "M4 19V5M4 19h16M8 15l3-4 3 2 5-6" },
  { href: "/investimentos", rotulo: "Investimentos", curto: "Investir", icone: "M4 17l5-5 4 4 7-7M15 9h5v5" },
  { href: "/cartoes", rotulo: "Cartões", icone: "M3 6.5h18v11H3zM3 10h18M6.5 14.5h4" },
  { href: "/relatorios", rotulo: "Relatórios", icone: "M6 3h9l3 3v15H6zM9 17v-3M12 17v-6M15 17v-4", soLateral: true },
  { href: "/contas", rotulo: "Contas", icone: "M3.5 8.5h17v10h-17zM3.5 8.5l2-3h13l2 3M15.5 13.5h2", soLateral: true },
  { href: "/categorias", rotulo: "Categorias", icone: "M4 7.5 12 4l8 3.5-8 3.5zM4 12l8 3.5 8-3.5M4 16.5 12 20l8-3.5", soLateral: true },
];

function ativo(path: string, href: string) {
  return href === "/" ? path === "/" : path === href || path.startsWith(href + "/");
}

function Icone({ d }: { d: string }) {
  return (
    <svg viewBox="0 0 24 24" className="size-5 shrink-0" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={d} />
    </svg>
  );
}

export function NavLateral() {
  const path = usePathname();
  return (
    <nav aria-label="Principal" className="space-y-0.5">
      {ITENS.map((i) => {
        const a = ativo(path, i.href);
        return (
          <Link
            key={i.href}
            href={i.href}
            aria-current={a ? "page" : undefined}
            className={`flex min-h-11 items-center gap-3 rounded-full px-4 text-[15px] font-semibold transition-colors duration-150 ${
              a ? "bg-tinta text-papel" : "text-suave hover:bg-fundo hover:text-tinta"
            }`}
          >
            <Icone d={i.icone} />
            {i.rotulo}
          </Link>
        );
      })}
    </nav>
  );
}

export function NavInferior() {
  const path = usePathname();
  return (
    <nav aria-label="Principal" className="fixed inset-x-0 bottom-0 z-20 grid grid-cols-5 border-t border-linha bg-papel pb-[env(safe-area-inset-bottom)] lg:hidden">
      {ITENS.filter((i) => !i.soLateral).map((i) => {
        const a = ativo(path, i.href);
        return (
          <Link
            key={i.href}
            href={i.href}
            aria-current={a ? "page" : undefined}
            className={`flex min-h-14 flex-col items-center justify-center gap-0.5 text-[11px] font-semibold ${a ? "text-tinta" : "text-suave"}`}
          >
            <span className={`grid h-7 w-11 place-items-center rounded-full transition-colors ${a ? "bg-acento text-[#0f1b17]" : ""}`}>
              <Icone d={i.icone} />
            </span>
            {i.curto ?? i.rotulo}
          </Link>
        );
      })}
    </nav>
  );
}
