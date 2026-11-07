import Link from "next/link";
import { brl } from "@/lib/dinheiro";
import { diagnosticar, gastoMensalMedio, notaCarteira, type Diagnostico } from "@/lib/investimentos/analise";
import type { Grupo } from "@/lib/investimentos/calculo";
import { carregarCarteira } from "@/lib/investimentos/carteira";
import { pct, sinal } from "@/lib/investimentos/formato";
import { somaDias } from "@/lib/dados-recorrencias";
import { requireUser } from "@/lib/supabase/server";

export const metadata = { title: "Nota e análise" };

const STATUS: Record<Diagnostico["status"], { rotulo: string; cor: string }> = {
  revisar: { rotulo: "Revisar", cor: "bg-despesa text-white" },
  atencao: { rotulo: "Atenção", cor: "bg-acento text-[#0f1b17]" },
  em_dia: { rotulo: "Em dia", cor: "bg-marca-clara text-marca" },
};

export default async function AnalisePage() {
  const { supabase } = await requireUser();
  const { carteira: c, hoje } = await carregarCarteira(supabase);
  const [{ data: alvoData }, { data: despesas }] = await Promise.all([
    supabase.from("alocacao_alvo").select("grupo,percentual"),
    supabase.from("lancamentos").select("data,valor_centavos").eq("tipo", "despesa").eq("status", "efetivado").gte("data", somaDias(hoje, -220)),
  ]);
  const alvo = Object.fromEntries((alvoData ?? []).map((a) => [a.grupo, Number(a.percentual)])) as Partial<Record<Grupo, number>>;
  const gasto = gastoMensalMedio((despesas ?? []).map((d) => ({ data: d.data, valor_centavos: Number(d.valor_centavos) })), hoje);

  if (c.posicoes.filter((p) => p.valorCentavos > 0).length === 0) {
    return (
      <div className="painel max-w-xl">
        <h1 className="font-display text-2xl font-bold">Nota e análise</h1>
        <p className="mt-2 text-[15px] text-suave">Cadastre seus investimentos para receber a nota da carteira e o diagnóstico de cada ativo.</p>
        <Link href="/investimentos/novo" className="btn mt-5">Cadastrar investimento</Link>
      </div>
    );
  }

  const nota = notaCarteira(c, alvo, gasto, hoje);
  const diags = c.posicoes
    .filter((p) => p.valorCentavos > 0)
    .map((p) => diagnosticar(p, c.totalCentavos, hoje))
    .sort((a, b) => ({ revisar: 0, atencao: 1, em_dia: 2 })[a.status] - ({ revisar: 0, atencao: 1, em_dia: 2 })[b.status] || b.posicao.valorCentavos - a.posicao.valorCentavos);
  const contagem = { revisar: 0, atencao: 0, em_dia: 0 };
  for (const d of diags) contagem[d.status]++;

  return (
    <>
      <div className="mb-6">
        <h1 className="font-display text-[28px] font-bold leading-tight tracking-[-0.02em] sm:text-[34px]">Nota e análise</h1>
        <p className="mt-1.5 max-w-2xl text-[15px] text-suave">
          Fatos sobre a sua carteira para você decidir. O MyGrana não é consultoria de investimentos e não recomenda comprar, manter ou vender.
        </p>
      </div>

      <section aria-labelledby="t-nota" className="mb-8 grid gap-8 rounded-3xl bg-destaque p-6 text-white sm:p-8 lg:grid-cols-[auto_1fr] lg:items-center lg:p-10">
        <div className="text-center lg:pr-6">
          <h2 id="t-nota" className="text-[15px] text-white/80">Nota da carteira</h2>
          <p className="font-display text-[88px] font-extrabold leading-none tracking-[-0.04em]">
            {nota.nota.toLocaleString("pt-BR", { minimumFractionDigits: 1 })}
          </p>
          <p className="mt-1 text-lg font-bold text-acento">{nota.faixa}</p>
        </div>
        <ul className="space-y-4">
          {nota.criterios.map((k) => (
            <li key={k.id}>
              <div className="mb-1.5 flex items-baseline justify-between gap-3">
                <span className="font-semibold">{k.nome}</span>
                <span className="text-[15px] font-bold">{k.pontos.toLocaleString("pt-BR")} de {k.peso}</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-white/15" aria-hidden="true">
                <div className="h-full rounded-full bg-acento" style={{ width: `${(k.pontos / k.peso) * 100}%` }} />
              </div>
              <p className="mt-1.5 text-[14px] text-white/75">{k.resumo}</p>
              {k.dica && <p className="mt-0.5 text-[14px] font-semibold text-white">{k.dica}</p>}
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="t-diag">
        <div className="mb-4 flex flex-wrap items-baseline justify-between gap-3">
          <h2 id="t-diag" className="font-display text-2xl font-bold tracking-[-0.02em]">Diagnóstico por ativo</h2>
          <p className="text-[15px] text-suave">
            {contagem.revisar} para revisar · {contagem.atencao} com atenção · {contagem.em_dia} em dia
          </p>
        </div>
        <ul className="space-y-3">
          {diags.map((d) => {
            const p = d.posicao;
            const s = STATUS[d.status];
            return (
              <li key={p.ativo.id} className="rounded-2xl border border-linha bg-papel p-4 sm:p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <Link href={`/investimentos/${p.ativo.id}`} className="font-semibold hover:text-marca">
                      {p.ativo.ticker && p.ativo.ticker !== p.ativo.nome ? `${p.ativo.ticker} · ${p.ativo.nome}` : p.ativo.ticker ?? p.ativo.nome}
                    </Link>
                    <p className="text-[13px] text-suave">
                      {brl(p.valorCentavos)} · {pct(d.pesoNaCarteira)} da carteira · {d.meses < 1 ? "menos de 1 mês" : `${d.meses} ${d.meses === 1 ? "mês" : "meses"}`}
                    </p>
                  </div>
                  <span className={`rounded-full px-3 py-1 text-[13px] font-bold ${s.cor}`}>{s.rotulo}</span>
                </div>
                <dl className="mt-3 grid gap-3 text-[14px] sm:grid-cols-3">
                  <div>
                    <dt className="text-suave">Resultado total</dt>
                    <dd className={`font-bold ${p.resultadoCentavos < 0 ? "text-despesa" : "text-receita"}`}>
                      {sinal(p.resultadoCentavos)}{p.aportesCentavos > 0 ? ` (${pct(p.resultadoCentavos / p.aportesCentavos)})` : ""}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-suave">Mesmo dinheiro no CDI</dt>
                    <dd className="font-bold">{brl(p.equivalenteCdiCentavos)}{d.fracaoDoCdi !== null ? ` · você teve ${pct(Math.max(0, d.fracaoDoCdi), 0)} do ganho` : ""}</dd>
                  </div>
                  <div>
                    <dt className="text-suave">Só a inflação</dt>
                    <dd className="font-bold">{brl(p.equivalenteInflacaoCentavos)}</dd>
                  </div>
                </dl>
                {d.sinais.length > 0 && (
                  <ul className="mt-3 space-y-1.5 border-t border-linha pt-3 text-[14px]">
                    {d.sinais.map((x) => (
                      <li key={x.texto} className="flex gap-2">
                        <span aria-hidden="true" className={`mt-1.5 size-2 shrink-0 rounded-full ${x.nivel === "revisar" ? "bg-despesa" : x.nivel === "atencao" ? "bg-acento" : "bg-linha"}`} />
                        <span>{x.texto}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
        <p className="mt-4 text-[13px] text-suave">
          Comparações usam os mesmos valores e datas dos seus aportes, retiradas e proventos, corrigidos pelo CDI e pelo IPCA oficiais. Resultado passado não garante resultado futuro.
        </p>
      </section>
    </>
  );
}
