import Link from "next/link";
import { BotaoEnviar } from "@/components/botao-enviar";
import { Titulo } from "@/components/titulo";
import { resumoDoCartao } from "@/lib/cartoes";
import { carregarContasECategorias } from "@/lib/dados";
import { carregarComprasEPagamentos } from "@/lib/dados-cartoes";
import { gastoPorCategoriaMae } from "@/lib/dados-avisos";
import { deslocaMes, hojeISO, nomeMes } from "@/lib/datas";
import { brl, paraInput } from "@/lib/dinheiro";
import { fluxoDeCaixa, progressoOrcamento } from "@/lib/planejamento";
import type { Recorrencia, Tratada } from "@/lib/recorrencias";
import { requireUser } from "@/lib/supabase/server";
import { salvarOrcamentos } from "./actions";

export const metadata = { title: "Planejamento" };

const COR_ESTADO = { ok: "bg-receita", atencao: "bg-acento", estourado: "bg-despesa" } as const;
const MESES_CURTOS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const mesCurto = (m: string) => `${MESES_CURTOS[Number(m.slice(5, 7)) - 1]}/${m.slice(2, 4)}`;

export default async function PlanejamentoPage({ searchParams }: { searchParams: Promise<{ ok?: string }> }) {
  const sp = await searchParams;
  const { supabase, user } = await requireUser();
  const hoje = hojeISO();
  const mes = hoje.slice(0, 7);
  const meses = Array.from({ length: 6 }, (_, i) => deslocaMes(mes, i));

  const [{ categorias, cartoes }, { data: orcs }, { data: saldos }, { compras, pagamentos }, { data: regras }, { data: tratadas }] = await Promise.all([
    carregarContasECategorias(supabase),
    supabase.from("orcamentos").select("categoria_id,valor_centavos"),
    supabase.from("saldos_contas").select("saldo_centavos").eq("arquivada", false),
    carregarComprasEPagamentos(supabase),
    supabase.from("recorrencias").select("*").eq("ativa", true),
    supabase.from("ocorrencias_tratadas").select("recorrencia_id,data_ocorrencia,situacao").gte("data_ocorrencia", `${mes}-01`),
  ]);
  const gastos = await gastoPorCategoriaMae(supabase, user.id, `${mes}-01`, categorias);

  // ORÇAMENTO
  const limite = new Map((orcs ?? []).map((o) => [o.categoria_id as string, Number(o.valor_centavos)]));
  const maes = categorias.filter((c) => c.tipo === "despesa" && !c.parent_id && !c.arquivada);
  const totalOrcado = [...limite.values()].reduce((s, v) => s + v, 0);
  const gastoOrcado = maes.filter((c) => limite.has(c.id)).reduce((s, c) => s + (gastos.get(c.id) ?? 0), 0);

  // FLUXO DE CAIXA: faturas a vencer por mês (as vencidas entram no mês atual)
  const faturasPorMes = new Map<string, number>();
  for (const c of cartoes.filter((x) => !x.arquivado)) {
    for (const f of resumoDoCartao(c, compras, pagamentos, hoje).faturas) {
      if (f.restanteCentavos <= 0) continue;
      const m = f.vencimento.slice(0, 7) < mes ? mes : f.vencimento.slice(0, 7);
      faturasPorMes.set(m, (faturasPorMes.get(m) ?? 0) + f.restanteCentavos);
    }
  }
  const saldoAtual = (saldos ?? []).reduce((s, c) => s + Number(c.saldo_centavos), 0);
  const fluxo = fluxoDeCaixa({
    saldoAtualCentavos: saldoAtual,
    hoje,
    meses,
    regras: ((regras ?? []) as Recorrencia[]).map((r) => ({ ...r, valor_centavos: Number(r.valor_centavos) })),
    tratadas: (tratadas ?? []) as Tratada[],
    faturasPorMes,
  });
  const maxAbs = Math.max(1, ...fluxo.map((f) => Math.abs(f.saldoFinalCentavos)), Math.abs(saldoAtual));
  const primeiroNegativo = fluxo.find((f) => f.saldoFinalCentavos < 0);

  return (
    <>
      <Titulo sub="Quanto você pode gastar por categoria e como o saldo deve andar nos próximos meses." acao={<Link href="/metas" className="btn-sec">Metas</Link>}>
        Planejamento
      </Titulo>
      {sp.ok === "orcamento" && <p role="status" className="mb-6 rounded-2xl bg-marca-clara px-4 py-3 font-semibold text-marca">Orçamento salvo.</p>}
      {sp.ok === "parcial" && <p role="alert" className="mb-6 rounded-2xl bg-despesa/10 px-4 py-3 font-semibold text-despesa">Alguns valores não foram entendidos e ficaram de fora. Use o formato 1.200,00.</p>}

      <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
        <section aria-labelledby="t-orc" className="painel lg:row-span-2">
          <div className="mb-1 flex items-baseline justify-between gap-3">
            <h2 id="t-orc" className="font-display text-xl font-bold">Orçamento de {nomeMes(mes).split(" ")[0]}</h2>
            {totalOrcado > 0 && <span className="text-[13px] font-semibold text-suave">{brl(gastoOrcado)} de {brl(totalOrcado)}</span>}
          </div>
          <p className="mb-5 text-[15px] text-suave">Defina um limite por mês para as categorias que quer controlar. Avisamos em 80% e 100%.</p>
          <form action={salvarOrcamentos} className="space-y-4">
            {maes.map((c) => {
              const g = gastos.get(c.id) ?? 0;
              const l = limite.get(c.id);
              const p = l ? progressoOrcamento(g, l) : null;
              return (
                <div key={c.id}>
                  <div className="flex items-center gap-3">
                    <label htmlFor={`orc_${c.id}`} className="flex min-w-0 flex-1 items-center gap-2 text-[15px] font-semibold">
                      <span className="size-2.5 shrink-0 rounded-full" style={{ background: c.cor }} aria-hidden="true" />
                      <span className="truncate">{c.nome}</span>
                    </label>
                    <span className="hidden text-[13px] text-suave sm:inline">gasto {brl(g)}</span>
                    <input id={`orc_${c.id}`} name={`orc_${c.id}`} inputMode="decimal" autoComplete="off" placeholder="sem limite"
                      defaultValue={l ? paraInput(l) : ""} className="campo w-32 text-right" aria-describedby={`orc_${c.id}_d`} />
                  </div>
                  <p id={`orc_${c.id}_d`} className="mt-1 text-[13px] text-suave sm:hidden">gasto {brl(g)}</p>
                  {p && (
                    <div className="mt-2">
                      <div className="h-2 overflow-hidden rounded-full bg-fundo" aria-hidden="true">
                        <div className={`h-full rounded-full ${COR_ESTADO[p.estado]}`} style={{ width: `${Math.min(100, Math.max(2, p.pct))}%` }} />
                      </div>
                      <p className={`mt-1 text-[13px] ${p.estado === "estourado" ? "font-semibold text-despesa" : "text-suave"}`}>
                        {p.pct}% · {p.restanteCentavos >= 0 ? `restam ${brl(p.restanteCentavos)}` : `passou ${brl(-p.restanteCentavos)}`}
                      </p>
                    </div>
                  )}
                </div>
              );
            })}
            <div className="flex justify-end pt-2"><BotaoEnviar>Salvar orçamento</BotaoEnviar></div>
          </form>
        </section>

        <section aria-labelledby="t-fluxo" className="painel">
          <h2 id="t-fluxo" className="font-display text-xl font-bold">Fluxo de caixa</h2>
          <p className="mt-1 text-[15px] text-suave">
            Saldo das contas hoje: <strong className="text-tinta">{brl(saldoAtual)}</strong>. Projeção com recorrências e faturas já lançadas.
          </p>
          {primeiroNegativo && (
            <p role="alert" className="mt-4 rounded-xl bg-despesa/10 px-3 py-2 text-[15px] font-semibold text-despesa">
              O saldo fica negativo em {nomeMes(primeiroNegativo.mes)}. Reveja gastos ou antecipe receitas.
            </p>
          )}
          <ul className="mt-5 space-y-3">
            {fluxo.map((f) => {
              const neg = f.saldoFinalCentavos < 0;
              return (
                <li key={f.mes} className="grid grid-cols-[52px_1fr_auto] items-center gap-3">
                  <span className="text-[13px] font-semibold text-suave">{mesCurto(f.mes)}</span>
                  <div className="h-3 overflow-hidden rounded-full bg-fundo" aria-hidden="true">
                    <div className={`h-full rounded-full ${neg ? "bg-despesa" : "bg-marca"}`} style={{ width: `${Math.max(2, (Math.abs(f.saldoFinalCentavos) / maxAbs) * 100)}%` }} />
                  </div>
                  <span className={`whitespace-nowrap text-right text-[15px] font-bold ${neg ? "text-despesa" : ""}`}>{brl(f.saldoFinalCentavos)}</span>
                </li>
              );
            })}
          </ul>
          <details className="mt-5">
            <summary className="cursor-pointer text-sm font-semibold text-marca">Ver entradas e saídas de cada mês</summary>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[460px] text-[13px]">
                <thead className="text-left text-suave">
                  <tr><th className="py-1.5 font-semibold">Mês</th><th className="text-right font-semibold">Entra</th><th className="text-right font-semibold">Sai</th><th className="text-right font-semibold">Faturas</th><th className="text-right font-semibold">Aportes</th></tr>
                </thead>
                <tbody className="divide-y divide-linha">
                  {fluxo.map((f) => (
                    <tr key={f.mes}>
                      <td className="py-1.5 font-semibold">{mesCurto(f.mes)}</td>
                      <td className="text-right text-receita">{brl(f.entradasCentavos)}</td>
                      <td className="text-right">{brl(f.saidasCentavos)}</td>
                      <td className="text-right">{brl(f.faturasCentavos)}</td>
                      <td className="text-right">{brl(f.investidoCentavos)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-2 text-[13px] text-suave">Gastos avulsos que ainda não foram lançados não entram. Recorrências no cartão contam no mês da compra.</p>
          </details>
        </section>

        <section className="painel">
          <h2 className="font-display text-xl font-bold">Ferramentas</h2>
          <ul className="mt-3 divide-y divide-linha">
            {[
              { href: "/metas", t: "Metas", d: "Economia, patrimônio e renda passiva, com quanto guardar por mês." },
              { href: "/calendario", t: "Calendário financeiro", d: "Vencimentos, faturas e recebimentos dia a dia." },
              { href: "/simuladores", t: "Simuladores", d: "Juros compostos, independência financeira e financiamentos." },
              { href: "/recorrentes", t: "Recorrentes", d: "Contas fixas e salários que alimentam a projeção." },
            ].map((x) => (
              <li key={x.href}>
                <Link href={x.href} className="-mx-2 block rounded-xl px-2 py-3 hover:bg-fundo">
                  <span className="block text-[15px] font-semibold">{x.t}</span>
                  <span className="block text-[13px] text-suave">{x.d}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </>
  );
}
