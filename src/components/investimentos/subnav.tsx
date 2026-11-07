"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const ABAS = [
  { href: "/investimentos", rotulo: "Carteira" },
  { href: "/investimentos/analise", rotulo: "Nota e análise" },
  { href: "/investimentos/alocacao", rotulo: "Alocação" },
  { href: "/investimentos/proventos", rotulo: "Proventos" },
  { href: "/investimentos/ir", rotulo: "Imposto de renda" },
];

export function SubnavInvestimentos() {
  const path = usePathname();
  return (
    <nav aria-label="Seções de investimentos" className="-mx-4 mb-8 overflow-x-auto px-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <ul className="flex w-max gap-1 rounded-full border border-linha bg-papel p-1">
        {ABAS.map((a) => {
          const ativo = a.href === "/investimentos" ? path === a.href : path.startsWith(a.href);
          return (
            <li key={a.href}>
              <Link
                href={a.href}
                aria-current={ativo ? "page" : undefined}
                className={`flex min-h-10 items-center rounded-full px-4 text-sm font-semibold whitespace-nowrap transition-colors ${ativo ? "bg-tinta text-papel" : "text-suave hover:text-tinta"}`}
              >
                {a.rotulo}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
