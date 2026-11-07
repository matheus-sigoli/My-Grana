import Link from "next/link";
import { BotaoImprimir } from "@/components/botao-imprimir";
import { Titulo } from "@/components/titulo";
import { carregarContasECategorias } from "@/lib/dados";
import { carregarAno } from "@/lib/dados-relatorio";
import { hojeISO } from "@/lib/datas";
import { brl } from "@/lib/dinheiro";
import { balancoAnual, saldosFimDoMes } from "@/lib/relatorio";
import { requireUser } from "@/lib/supabase/server";

export const metadata = { title: "Relatórios" };

const MESES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

export default async function RelatoriosPage({ searchParams }: { searchParams: Promise<{ ano?: string }> }) {
  const sp = await searchParams;
  const hoje = hojeISO();
  const anoAtual = Number(hoje.slice(0, 4));
  const anoPedido = Number(sp.ano);
  const ano = Number.isInteger(anoPedido) && anoPedido >= 2000 && anoPedido <= anoAtual + 1 ? anoPedido : anoAtual;
  const { supabase } = await requireUser();
  const [{ categorias }, dados] = await Promise.all([carregarContasECategorias(supabase), carregarAno(supabase, ano)]);

  const b = balancoAnual(dados.lancs, ano, categorias);
  const saldos = saldosFimDoMes(dados.saldoAtual, dados.efeitos, ano, hoje);
  const maxMes = Math.max(1, ...b.meses.flatMap((m) => [m.receitas, m.despesas]));
  const despesasCat = b.categorias.filter((c) => c.tipo === "despesa");
  const receitasCat = b.categorias.filter((c) => c.tipo === "receita");
  const mesesComDado = b.meses.filter((m) => m.receitas || m.despesas).length || 1;

  // Linha do saldo no fim de cada mês (SVG simples, escala própria)
  const pontos = saldos.map((s, i) => (s === null ? null : { i, s }));
  const validos = pontos.filter((p): p is { i: number; s: number } => p !== null);
  const minS = Math.min(0, ...validos.map((p) => p.s)), maxS = Math.max(1, ...validos.map((p) => p.s));
  const y = (s: number) => 110 - ((s - minS) / (maxS - minS || 1)) * 100;
  const linha = validos.map((p) => `${(p.i * 100) / 11 + 0},${y(p.s).toFixed(1)}`).join(" ");

  return (
    <>
      <Titulo
        sub="Balanço do ano: quanto entrou, quanto saiu, onde foi parar e como o saldo andou."
        acao={
          <div className="no-print flex flex-wrap gap-2">
            <a href={`/relatorios/exportar?ano=${ano}`} className="btn-sec" download>Excel (CSV)</a>
            <BotaoImprimir />
          </div>
        }
      >
        Relatório de {ano}
      </Titulo>

      <nav aria-label="Ano" className="no-print mb-6 flex items-center gap-2">
        <Link href={`/relatorios?ano=${ano - 1}`} className="btn-sec min-h-10 px-4" aria-label={`Ano ${ano - 1}`}>← {ano - 1}</Link>
        {ano < anoAtual && <Link href={`/relatorios?ano=${ano + 1}`} className="btn-sec min-h-10 px-4" aria-label={`Ano ${ano + 1}`}>{ano + 1} →</Link>}
      </nav>

      <dl className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { t: "Entrou", v: brl(b.receitas), c: "text-receita" },
          { t: "Saiu", v: brl(b.despesas), c: "" },
          { t: "Resultado", v: brl(b.resultado), c: b.resultado < 0 ? "text-despesa" : "" },
          { t: "Taxa de poupança", v: b.taxaPoupanca === null ? "—" : `${b.taxaPoupanca}%`, c: "" },
        ].map((x) => (
          <div key={x.t} className="painel">
            <dt className="text-[13px] font-semibold text-suave">{x.t}</dt>
            <dd className={`mt-1 font-display text-xl font-bold sm:text-2xl ${x.c}`}>{x.v}</dd>
          </div>
        ))}
      </dl>

      <div className="grid gap-6 lg:grid-cols-2">
        <section aria-labelledby="t-mes" className="painel lg:col-span-2">
          <h2 id="t-mes" className="mb-4 font-display text-xl font-bold">Mês a mês</h2>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[620px] text-[14px]">
              <thead className="text-left text-[13px] text-suave">
                <tr>
                  <th className="py-2 font-semibold">Mês</th>
                  <th className="w-[38%] font-semibold"><span className="sr-only">Gráfico</span></th>
                  <th className="text-right font-semibold">Entrou</th>
                  <th className="text-right font-semibold">Saiu</th>
                  <th className="text-right font-semibold">Resultado</th>
                  <th className="text-right font-semibold">Saldo no fim</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-linha">
                {b.meses.map((m, i) => (
                  <tr key={i}>
                    <td className="py-2 font-semibold">{MESES[i]}</td>
                    <td className="pr-4" aria-hidden="true">
                      <div className="space-y-1">
                        <div className="h-1.5 rounded-full bg-receita" style={{ width: `${(m.receitas / maxMes) * 100}%` }} />
                        <div className="h-1.5 rounded-full bg-despesa" style={{ width: `${(m.despesas / maxMes) * 100}%` }} />
                      </div>
                    </td>
                    <td className="text-right text-receita">{m.receitas ? brl(m.receitas) : "—"}</td>
                    <td className="text-right">{m.despesas ? brl(m.despesas) : "—"}</td>
                    <td className={`text-right font-semibold ${m.resultado < 0 ? "text-despesa" : ""}`}>{m.receitas || m.despesas ? brl(m.resultado) : "—"}</td>
                    <td className="text-right text-suave">{saldos[i] === null ? "—" : brl(saldos[i]!)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section aria-labelledby="t-desp" className="painel">
          <h2 id="t-desp" className="mb-4 font-display text-xl font-bold">Despesas por categoria</h2>
          {despesasCat.length === 0 ? <p className="text-[15px] text-suave">Nenhuma despesa em {ano}.</p> : (
            <ul className="space-y-3">
              {despesasCat.map((c) => (
                <li key={c.id}>
                  <div className="mb-1 flex items-baseline justify-between gap-3 text-[15px]">
                    <span className="flex min-w-0 items-center gap-2 font-semibold"><span className="size-2.5 shrink-0 rounded-full" style={{ background: c.cor }} aria-hidden="true" /><span className="truncate">{c.nome}</span></span>
                    <span className="whitespace-nowrap font-bold">{brl(c.total)} <span className="text-[13px] font-medium text-suave">{Math.round((c.total / b.despesas) * 100)}%</span></span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-fundo" aria-hidden="true"><div className="h-full rounded-full bg-despesa" style={{ width: `${Math.max(2, (c.total / despesasCat[0].total) * 100)}%` }} /></div>
                  <p className="mt-1 text-[13px] text-suave">média de {brl(Math.round(c.total / mesesComDado))} por mês</p>
                </li>
              ))}
            </ul>
          )}
        </section>

        <div className="space-y-6">
          <section aria-labelledby="t-saldo" className="painel">
            <h2 id="t-saldo" className="font-display text-xl font-bold">Saldo das contas</h2>
            <p className="mt-1 text-[13px] text-suave">Total das contas no fim de cada mês (investimentos à parte).</p>
            {validos.length > 1 ? (
              <svg viewBox="-2 0 104 120" className="mt-4 h-40 w-full" preserveAspectRatio="none" role="img" aria-label={`Saldo foi de ${brl(validos[0].s)} a ${brl(validos[validos.length - 1].s)}`}>
                {minS < 0 && <line x1="0" x2="100" y1={y(0)} y2={y(0)} className="stroke-linha" strokeWidth="0.6" strokeDasharray="2 2" />}
                <polyline points={linha} fill="none" className="stroke-marca" strokeWidth="2" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
              </svg>
            ) : <p className="mt-4 text-[15px] text-suave">Poucos meses para desenhar a linha.</p>}
          </section>

          <section aria-labelledby="t-rec" className="painel">
            <h2 id="t-rec" className="mb-4 font-display text-xl font-bold">Receitas por categoria</h2>
            {receitasCat.length === 0 ? <p className="text-[15px] text-suave">Nenhuma receita em {ano}.</p> : (
              <ul className="divide-y divide-linha">
                {receitasCat.map((c) => (
                  <li key={c.id} className="flex items-center justify-between gap-3 py-2 text-[15px]">
                    <span className="truncate font-semibold">{c.nome}</span>
                    <span className="font-bold text-receita">{brl(c.total)}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </>
  );
}
