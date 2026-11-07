import Link from "next/link";
import { SeletorMes } from "@/components/seletor-mes";
import { Titulo } from "@/components/titulo";
import { faturasDoCartao } from "@/lib/cartoes";
import { carregarContasECategorias } from "@/lib/dados";
import { carregarComprasEPagamentos } from "@/lib/dados-cartoes";
import { carregarPrevistas } from "@/lib/dados-recorrencias";
import { hojeISO, intervaloMes, mesOuAtual, nomeMes } from "@/lib/datas";
import { brl } from "@/lib/dinheiro";
import { requireUser } from "@/lib/supabase/server";

export const metadata = { title: "Calendário" };

type Evento = { dia: string; tipo: "receita" | "despesa" | "fatura" | "meta" | "outro"; titulo: string; valor: number | null; href: string; pago?: boolean };

const COR = { receita: "bg-receita", despesa: "bg-despesa", fatura: "bg-acento", meta: "bg-marca", outro: "bg-transf" } as const;
const SEMANA = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

export default async function CalendarioPage({ searchParams }: { searchParams: Promise<{ mes?: string }> }) {
  const sp = await searchParams;
  const mes = mesOuAtual(sp.mes);
  const { inicio } = intervaloMes(mes);
  const ultimo = new Date(Date.UTC(Number(mes.slice(0, 4)), Number(mes.slice(5, 7)), 0)).toISOString().slice(0, 10);
  const hoje = hojeISO();
  const { supabase } = await requireUser();

  const [{ cartoes }, { compras, pagamentos }, { previstas }, { data: metas }] = await Promise.all([
    carregarContasECategorias(supabase),
    carregarComprasEPagamentos(supabase),
    carregarPrevistas(supabase, inicio, ultimo, hoje),
    supabase.from("metas").select("id,nome,prazo").gte("prazo", inicio).lte("prazo", ultimo),
  ]);

  const eventos: Evento[] = [
    ...previstas.map((o) => ({
      dia: o.data,
      tipo: (o.recorrencia.tipo === "receita" ? "receita" : o.recorrencia.tipo === "despesa" ? "despesa" : "outro") as Evento["tipo"],
      titulo: o.recorrencia.descricao,
      valor: o.recorrencia.valor_centavos,
      href: "/recorrentes",
    })),
    ...cartoes.filter((c) => !c.arquivado).flatMap((c) =>
      faturasDoCartao(c, compras, pagamentos, hoje)
        .filter((f) => f.vencimento >= inicio && f.vencimento <= ultimo && f.totalCentavos > 0)
        .map((f) => ({ dia: f.vencimento, tipo: "fatura" as const, titulo: `Fatura ${c.nome}`, valor: f.restanteCentavos || f.totalCentavos, href: `/cartoes/${c.id}`, pago: f.status === "paga" })),
    ),
    ...(metas ?? []).map((m) => ({ dia: m.prazo as string, tipo: "meta" as const, titulo: `Prazo da meta ${m.nome}`, valor: null, href: `/metas/${m.id}` })),
  ].sort((a, b) => a.dia.localeCompare(b.dia));

  const porDia = new Map<string, Evento[]>();
  for (const e of eventos) porDia.set(e.dia, [...(porDia.get(e.dia) ?? []), e]);

  const primeiroDiaSemana = new Date(`${inicio}T12:00:00Z`).getUTCDay();
  const totalDias = Number(ultimo.slice(8, 10));
  const celulas: (string | null)[] = [
    ...Array(primeiroDiaSemana).fill(null),
    ...Array.from({ length: totalDias }, (_, i) => `${mes}-${String(i + 1).padStart(2, "0")}`),
  ];
  while (celulas.length % 7) celulas.push(null);

  const saidas = eventos.filter((e) => (e.tipo === "despesa" || e.tipo === "fatura") && !e.pago).reduce((s, e) => s + (e.valor ?? 0), 0);
  const entradas = eventos.filter((e) => e.tipo === "receita").reduce((s, e) => s + (e.valor ?? 0), 0);

  return (
    <>
      <Titulo sub="Vencimentos, faturas e recebimentos previstos, dia a dia." acao={<SeletorMes mes={mes} base="/calendario" />}>Calendário</Titulo>

      <p className="mb-4 text-[15px] text-suave">
        Previsto em {nomeMes(mes)}: <strong className="text-receita">{brl(entradas)}</strong> a receber e <strong className="text-tinta">{brl(saidas)}</strong> a pagar.
      </p>

      <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        <section aria-label={`Calendário de ${nomeMes(mes)}`} className="painel p-3 sm:p-4">
          <div className="grid grid-cols-7 gap-1 text-center text-[12px] font-semibold text-suave" aria-hidden="true">
            {SEMANA.map((d) => <div key={d} className="py-1">{d}</div>)}
          </div>
          <ol className="grid grid-cols-7 gap-1">
            {celulas.map((dia, i) => {
              if (!dia) return <li key={`v${i}`} aria-hidden="true" />;
              const evs = porDia.get(dia) ?? [];
              const ehHoje = dia === hoje;
              return (
                <li key={dia} className={`min-h-14 rounded-xl p-1.5 sm:min-h-24 ${evs.length ? "bg-fundo" : ""} ${ehHoje ? "ring-2 ring-marca" : ""}`}>
                  <a href={evs.length ? `#d-${dia}` : undefined} className="block h-full" aria-label={`${Number(dia.slice(8))} de ${nomeMes(mes)}: ${evs.length} ${evs.length === 1 ? "evento" : "eventos"}`}>
                    <span className={`text-[13px] font-semibold ${ehHoje ? "text-marca" : dia < hoje ? "text-suave" : ""}`}>{Number(dia.slice(8))}</span>
                    <span className="mt-1 flex flex-wrap gap-1 sm:hidden" aria-hidden="true">
                      {evs.slice(0, 4).map((e, k) => <span key={k} className={`size-1.5 rounded-full ${COR[e.tipo]}`} />)}
                    </span>
                    <span className="mt-1 hidden space-y-0.5 sm:block" aria-hidden="true">
                      {evs.slice(0, 3).map((e, k) => (
                        <span key={k} className={`flex items-center gap-1 truncate text-[11px] leading-tight ${e.pago ? "text-suave line-through" : ""}`}>
                          <span className={`size-1.5 shrink-0 rounded-full ${COR[e.tipo]}`} />
                          <span className="truncate">{e.titulo}</span>
                        </span>
                      ))}
                      {evs.length > 3 && <span className="block text-[11px] text-suave">+{evs.length - 3}</span>}
                    </span>
                  </a>
                </li>
              );
            })}
          </ol>
        </section>

        <section aria-labelledby="t-agenda" className="overflow-hidden rounded-2xl border border-linha bg-papel">
          <h2 id="t-agenda" className="px-5 pb-2 pt-5 font-display text-xl font-bold">Agenda</h2>
          {eventos.length === 0 ? (
            <p className="px-5 pb-5 text-[15px] text-suave">Nada previsto neste mês. Cadastre <Link href="/recorrentes" className="link">recorrências</Link> e <Link href="/cartoes" className="link">cartões</Link> para ver os vencimentos aqui.</p>
          ) : (
            <ol className="divide-y divide-linha">
              {[...porDia.entries()].map(([dia, evs]) => (
                <li key={dia} id={`d-${dia}`} className="scroll-mt-20 px-5 py-3">
                  <p className={`mb-1 text-[13px] font-bold ${dia < hoje ? "text-suave" : dia === hoje ? "text-marca" : ""}`}>
                    {dia.split("-").reverse().slice(0, 2).join("/")}{dia === hoje ? " · hoje" : ""}
                  </p>
                  <ul className="space-y-1">
                    {evs.map((e, k) => (
                      <li key={k}>
                        <Link href={e.href} className="-mx-2 flex items-center gap-2 rounded-lg px-2 py-1 hover:bg-fundo">
                          <span className={`size-2 shrink-0 rounded-full ${COR[e.tipo]}`} aria-hidden="true" />
                          <span className={`min-w-0 flex-1 truncate text-[15px] ${e.pago ? "text-suave line-through" : ""}`}>{e.titulo}{e.pago ? " (paga)" : ""}</span>
                          {e.valor !== null && <span className={`whitespace-nowrap text-[15px] font-bold ${e.tipo === "receita" ? "text-receita" : ""}`}>{brl(e.valor)}</span>}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>
    </>
  );
}
