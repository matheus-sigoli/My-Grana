import Link from "next/link";
import { deslocaMes, nomeMes } from "@/lib/datas";

export function SeletorMes({ mes, base, escuro = false }: { mes: string; base: string; escuro?: boolean }) {
  const sep = base.includes("?") ? "&" : "?";
  const seta = `grid size-9 place-items-center rounded-full text-lg transition-colors ${escuro ? "text-white/80 hover:bg-white/10" : "text-suave hover:bg-fundo hover:text-tinta"}`;
  return (
    <nav aria-label="Mês" className={`inline-flex items-center gap-1 rounded-full p-1 ${escuro ? "bg-white/10" : "border border-linha bg-papel"}`}>
      <Link aria-label="Mês anterior" href={`${base}${sep}mes=${deslocaMes(mes, -1)}`} className={seta}>‹</Link>
      <span className={`min-w-36 text-center text-sm font-semibold first-letter:uppercase ${escuro ? "text-white" : ""}`} aria-live="polite">{nomeMes(mes)}</span>
      <Link aria-label="Próximo mês" href={`${base}${sep}mes=${deslocaMes(mes, 1)}`} className={seta}>›</Link>
    </nav>
  );
}
