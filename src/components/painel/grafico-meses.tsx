import Link from "next/link";
import { nomeMes } from "@/lib/datas";
import { brl } from "@/lib/dinheiro";

const MES_CURTO = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const mesCurto = (m: string) => MES_CURTO[Number(m.slice(5)) - 1];

/** Entradas × saídas dos últimos meses (barras por competência). Cada mês leva ao painel daquele mês. */
export function GraficoMeses({ evol, mes, maxEvol }: { evol: { mes: string; receitas: number; despesas: number }[]; mes: string; maxEvol: number }) {
  return (
    <section aria-labelledby="t-evol" className="painel">
      <h2 id="t-evol" className="mb-5 font-display text-xl font-bold tracking-[-0.01em]">Últimos 6 meses</h2>
      <div className="flex h-44 items-end gap-2 sm:gap-3">
        {evol.map((e) => (
          <Link key={e.mes} href={`/?mes=${e.mes}`} className="group flex flex-1 flex-col items-center gap-1.5" aria-label={`${nomeMes(e.mes)}: entrou ${brl(e.receitas)}, saiu ${brl(e.despesas)}`}>
            <div className="flex h-36 w-full items-end justify-center gap-1 rounded-lg group-hover:bg-fundo">
              <div className="w-[38%] max-w-5 rounded-t-md bg-receita" style={{ height: `${(e.receitas / maxEvol) * 100}%` }} />
              <div className="w-[38%] max-w-5 rounded-t-md bg-despesa" style={{ height: `${(e.despesas / maxEvol) * 100}%` }} />
            </div>
            <span className={`text-[13px] ${e.mes === mes ? "rounded-full bg-tinta px-2 font-bold text-papel" : "text-suave"}`}>{mesCurto(e.mes)}</span>
          </Link>
        ))}
      </div>
      <div className="mt-4 flex gap-5 text-[13px] text-suave">
        <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-sm bg-receita" aria-hidden="true" />Entrou</span>
        <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-sm bg-despesa" aria-hidden="true" />Saiu</span>
      </div>
    </section>
  );
}
