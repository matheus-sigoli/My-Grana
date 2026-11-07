import Link from "next/link";
import { brl } from "@/lib/dinheiro";
import { carregarCarteira } from "@/lib/investimentos/carteira";
import { dataCurta, pct } from "@/lib/investimentos/formato";
import { NOME_PROVENTO } from "@/lib/investimentos/rotulos";
import { nomeMes } from "@/lib/datas";
import { requireUser } from "@/lib/supabase/server";

export const metadata = { title: "Proventos" };
const MES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

export default async function ProventosPage() {
  const { supabase } = await requireUser();
  const { carteira: c, proventos, ativos, hoje } = await carregarCarteira(supabase, { incluirArquivados: true });
  const nome = new Map(ativos.map((a) => [a.id, a.ticker ?? a.nome]));

  // Últimos 12 meses, incluindo os meses sem provento.
  const meses = Array.from({ length: 12 }, (_, i) => {
    const d = new Date(Date.UTC(+hoje.slice(0, 4), +hoje.slice(5, 7) - 1 - (11 - i), 1));
    return d.toISOString().slice(0, 7);
  });
  const porMes = new Map(c.proventosPorMes.map((m) => [m.mes, m.valorCentavos]));
  const max = Math.max(1, ...meses.map((m) => porMes.get(m) ?? 0));
  const total12 = meses.reduce((s, m) => s + (porMes.get(m) ?? 0), 0);
  const ranking = c.posicoes.filter((p) => p.proventos12mCentavos > 0).sort((a, b) => b.proventos12mCentavos - a.proventos12mCentavos);

  return (
    <>
      <div className="mb-6">
        <h1 className="font-display text-[28px] font-bold leading-tight tracking-[-0.02em] sm:text-[34px]">Proventos</h1>
        <p className="mt-1.5 text-[15px] text-suave">Dividendos, JCP, rendimentos e juros recebidos.</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <section aria-labelledby="t-meses" className="painel">
          <div className="mb-5 flex flex-wrap items-baseline justify-between gap-3">
            <h2 id="t-meses" className="font-display text-xl font-bold">Últimos 12 meses</h2>
            <p className="font-display text-2xl font-bold text-receita">{brl(total12)}</p>
          </div>
          <div className="flex h-44 items-end gap-1.5 sm:gap-2">
            {meses.map((m) => {
              const v = porMes.get(m) ?? 0;
              return (
                <div key={m} className="flex flex-1 flex-col items-center gap-1.5" title={`${nomeMes(m)}: ${brl(v)}`}>
                  <div className="flex h-36 w-full items-end justify-center">
                    <div className="w-full max-w-6 rounded-t-md bg-receita" style={{ height: `${v ? Math.max(3, (v / max) * 100) : 0}%` }} />
                  </div>
                  <span className={`text-[12px] ${m === hoje.slice(0, 7) ? "font-bold" : "text-suave"}`}>{MES[+m.slice(5) - 1]}</span>
                </div>
              );
            })}
          </div>
          <p className="mt-4 text-[15px] text-suave">Média mensal: <strong className="text-tinta">{brl(Math.round(total12 / 12))}</strong></p>
        </section>

        <section aria-labelledby="t-quem" className="painel">
          <h2 id="t-quem" className="mb-4 font-display text-xl font-bold">Quem mais pagou (12 meses)</h2>
          {ranking.length === 0 ? (
            <p className="text-[15px] text-suave">Nenhum provento nos últimos 12 meses.</p>
          ) : (
            <ul className="space-y-3">
              {ranking.map((p) => (
                <li key={p.ativo.id} className="flex items-baseline justify-between gap-3 text-[15px]">
                  <Link href={`/investimentos/${p.ativo.id}`} className="min-w-0 truncate font-semibold hover:text-marca">{p.ativo.ticker ?? p.ativo.nome}</Link>
                  <span className="whitespace-nowrap font-bold">
                    {brl(p.proventos12mCentavos)}
                    {p.valorCentavos > 0 && <span className="ml-1.5 text-[13px] font-medium text-suave">yield {pct(p.proventos12mCentavos / p.valorCentavos)}</span>}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section aria-labelledby="t-todos" className="mt-6 overflow-hidden rounded-2xl border border-linha bg-papel">
        <h2 id="t-todos" className="px-5 pb-2 pt-5 font-display text-xl font-bold">Todos os recebimentos</h2>
        {proventos.length === 0 ? (
          <p className="px-5 pb-5 text-[15px] text-suave">Registre proventos na página de cada ativo.</p>
        ) : (
          <ul className="divide-y divide-linha">
            {[...proventos].reverse().map((p) => (
              <li key={p.id}>
                <Link href={`/investimentos/${p.ativo_id}`} className="flex min-h-14 items-center gap-3 px-5 py-3 hover:bg-fundo">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[15px] font-semibold">{nome.get(p.ativo_id)}</span>
                    <span className="block text-[13px] text-suave">{NOME_PROVENTO[p.tipo]} · {dataCurta(p.data)}</span>
                  </span>
                  <span className="whitespace-nowrap text-[15px] font-bold text-receita">+{brl(p.valor_centavos)}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
