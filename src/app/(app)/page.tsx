import Link from "next/link";
import { Fragment } from "react";
import { Acento } from "@/components/acento";
import { LinhaLancamento } from "@/components/linha-lancamento";
import { BoasVindas } from "@/components/painel/boas-vindas";
import { GraficoMeses } from "@/components/painel/grafico-meses";
import { Lottie } from "@/components/lottie";
import { SeletorMes } from "@/components/seletor-mes";
import { idMae } from "@/lib/categorias";
import { carregarContasECategorias } from "@/lib/dados";
import { primeiroNome } from "@/lib/nome";
import { carregarCarteira } from "@/lib/investimentos/carteira";
import { LinhaOcorrencia } from "@/components/recorrentes/ocorrencia";
import { carregarPrevistas, somaDias } from "@/lib/dados-recorrencias";
import { hojeISO } from "@/lib/datas";
import { efeitoNoSaldo } from "@/lib/recorrencias";
import { resumoDoCartao, type CompraCartao, type PagamentoFatura } from "@/lib/cartoes";
import { deslocaMes, intervaloMes, mesOuAtual, nomeMes } from "@/lib/datas";
import { brl } from "@/lib/dinheiro";
import { requireUser } from "@/lib/supabase/server";
import type { Lancamento, SaldoConta } from "@/lib/tipos";
import { CartaoMeta } from "@/components/painel/cartao-meta";
import { carregarPreferencias } from "@/lib/preferencias";
import { atualDaMeta, progressoMeta, progressoOrcamento, rendaPassivaMensal, type Meta } from "@/lib/planejamento";
import type { Bloco } from "@/lib/blocos";

export const metadata = { title: "Painel" };


export default async function PainelPage({ searchParams }: { searchParams: Promise<{ mes?: string }> }) {
  const sp = await searchParams;
  const mes = mesOuAtual(sp.mes);
  const { inicio, fim } = intervaloMes(mes);
  const inicio6 = intervaloMes(deslocaMes(mes, -5)).inicio;
  const { supabase, user } = await requireUser();

  const [{ data: saldosData }, { data: lancData }, { data: recentes }, { contas, categorias, cartoes }, { data: comprasCartao }, { data: pagamentosFatura }, prefs, { data: orcsData }, { data: metasData }] = await Promise.all([
    supabase.from("saldos_contas").select("*").eq("arquivada", false).order("saldo_centavos", { ascending: false }),
    supabase.from("lancamentos").select("tipo,valor_centavos,data,competencia,categoria_id").eq("status", "efetivado")
      .in("tipo", ["receita", "despesa"]).gte("competencia", inicio6).lt("competencia", fim),
    supabase.from("lancamentos").select("*").eq("competencia", inicio)
      .order("data", { ascending: false }).order("created_at", { ascending: false }).limit(6),
    carregarContasECategorias(supabase),
    supabase.from("lancamentos").select("id,cartao_id,competencia,valor_centavos").not("cartao_id", "is", null),
    supabase.from("pagamentos_fatura").select("*"),
    carregarPreferencias(),
    supabase.from("orcamentos").select("categoria_id,valor_centavos"),
    supabase.from("metas").select("*").order("created_at").limit(6),
  ]);
  const mostrar = new Set<Bloco>(prefs.painel_blocos);

  const nome = primeiroNome(user.user_metadata?.nome as string | undefined) || undefined;
  if (contas.length === 0) return <BoasVindas nome={nome} />;

  // Patrimônio = saldo das contas + carteira a mercado. Se a carteira falhar, o painel segue sem ela.
  let investido = 0;
  let proventosPorMes: { mes: string; valorCentavos: number }[] = [];
  const classeAtivo = new Map<string, string>();
  try {
    const cart = await carregarCarteira(supabase);
    investido = cart.carteira.totalCentavos;
    proventosPorMes = cart.carteira.proventosPorMes;
    for (const a of cart.ativos) classeAtivo.set(a.id, a.classe);
  } catch {
    investido = 0;
  }

  // Previstos: atrasados dos últimos 60 dias + o resto do mês corrente.
  const hoje = hojeISO();
  const fimDoMes = somaDias(`${somaDias(`${hoje.slice(0, 7)}-01`, 32).slice(0, 7)}-01`, -1);
  const { previstas } = await carregarPrevistas(supabase, somaDias(hoje, -60), fimDoMes, hoje);
  const idsAtivas = new Set(saldosAtivos(saldosData));
  const efeito = efeitoNoSaldo(previstas);

  // Cartões: faturas, dívida total e o que vence até o fim do mês.
  const compras = ((comprasCartao ?? []) as CompraCartao[]).map((x) => ({ ...x, valor_centavos: Number(x.valor_centavos) }));
  const pagamentos = ((pagamentosFatura ?? []) as PagamentoFatura[]).map((x) => ({ ...x, valor_centavos: Number(x.valor_centavos) }));
  const resumosCartoes = cartoes.filter((c) => !c.arquivado).map((c) => ({ c, r: resumoDoCartao(c, compras, pagamentos, hoje) }));
  const dividaCartoes = resumosCartoes.reduce((s, { r }) => s + r.usadoCentavos, 0);
  for (const { c, r } of resumosCartoes) {
    if (!c.conta_pagamento_id) continue;
    for (const f of r.faturas) {
      if (f.restanteCentavos > 0 && f.vencimento <= fimDoMes) efeito.set(c.conta_pagamento_id, (efeito.get(c.conta_pagamento_id) ?? 0) - f.restanteCentavos);
    }
  }
  const variacaoPrevista = [...efeito.entries()].filter(([id]) => idsAtivas.has(id)).reduce((s, [, v]) => s + v, 0);
  const proximasDoPainel = previstas.slice(0, 5);
  const atrasadas = previstas.filter((o) => o.atrasada).length;

  const saldos = (saldosData ?? []) as SaldoConta[];
  const lancs = ((lancData ?? []) as Pick<Lancamento, "tipo" | "valor_centavos" | "data" | "competencia" | "categoria_id">[]).map((l) => ({ ...l, valor_centavos: Number(l.valor_centavos) }));
  const mapaContas = new Map(contas.map((c) => [c.id, c]));
  const mapaCats = new Map(categorias.map((c) => [c.id, c]));

  const total = saldos.reduce((s, c) => s + Number(c.saldo_centavos), 0);
  const doMes = lancs.filter((l) => l.competencia === inicio);
  const receitas = doMes.filter((l) => l.tipo === "receita").reduce((s, l) => s + l.valor_centavos, 0);
  const despesas = doMes.filter((l) => l.tipo === "despesa").reduce((s, l) => s + l.valor_centavos, 0);
  const resultado = receitas - despesas;
  const pctGasto = receitas > 0 ? Math.round((despesas / receitas) * 100) : null;

  const porCat = new Map<string, number>();
  for (const l of doMes) {
    if (l.tipo !== "despesa") continue;
    const m = idMae(mapaCats, l.categoria_id) ?? "sem";
    porCat.set(m, (porCat.get(m) ?? 0) + l.valor_centavos);
  }
  const ranking = [...porCat.entries()].sort((a, b) => b[1] - a[1]);
  const maiorCat = ranking[0]?.[1] ?? 0;

  const meses = Array.from({ length: 6 }, (_, i) => deslocaMes(mes, i - 5));
  const evol = meses.map((m) => {
    const ls = lancs.filter((l) => l.competencia.startsWith(m));
    return {
      mes: m,
      receitas: ls.filter((l) => l.tipo === "receita").reduce((s, l) => s + l.valor_centavos, 0),
      despesas: ls.filter((l) => l.tipo === "despesa").reduce((s, l) => s + l.valor_centavos, 0),
    };
  });
  const maxEvol = Math.max(1, ...evol.flatMap((e) => [e.receitas, e.despesas]));

  // Orçamento do mês (gasto efetivado por categoria-mãe já está em porCat)
  const orcamentos = (orcsData ?? [])
    .map((o) => ({ cat: mapaCats.get(o.categoria_id as string), ...progressoOrcamento(porCat.get(o.categoria_id as string) ?? 0, Number(o.valor_centavos)), limite: Number(o.valor_centavos), gasto: porCat.get(o.categoria_id as string) ?? 0 }))
    .filter((o) => o.cat)
    .sort((x, y) => y.pct - x.pct);

  // Metas: economia lê a conta; patrimônio e renda passiva usam os totais já calculados acima
  const ctxMeta = {
    saldoConta: new Map(saldos.map((c) => [c.conta_id, Number(c.saldo_centavos)])),
    patrimonioCentavos: total + investido - dividaCartoes,
    rendaPassivaCentavos: rendaPassivaMensal(proventosPorMes, hoje),
  };
  const metas = ((metasData ?? []) as Meta[]).map((m) => {
    const meta = { ...m, valor_alvo_centavos: Number(m.valor_alvo_centavos) };
    const atual = atualDaMeta(meta, ctxMeta);
    return { meta, atual, ...progressoMeta({ alvoCentavos: meta.valor_alvo_centavos, atualCentavos: atual, prazo: meta.prazo }, hoje) };
  });

  const blocos: Record<Bloco, React.ReactNode> = {
    previstos: proximasDoPainel.length > 0 && (
          <section aria-labelledby="t-prev" className="overflow-hidden rounded-2xl border border-linha bg-papel lg:col-span-2">
            <div className="flex items-baseline justify-between gap-3 px-5 pb-2 pt-5 sm:px-6">
              <h2 id="t-prev" className="font-display text-xl font-bold tracking-[-0.01em]">
                A pagar e receber
                {atrasadas > 0 && <span className="ml-2 rounded-full bg-despesa px-2.5 py-0.5 align-middle text-[13px] text-white">{atrasadas} atrasado{atrasadas > 1 ? "s" : ""}</span>}
              </h2>
              <Link href="/recorrentes" className="link text-sm">Ver todos</Link>
            </div>
            <ul className="divide-y divide-linha">
              {proximasDoPainel.map((o) => (
                <LinhaOcorrencia key={`${o.recorrencia.id}-${o.data}`} recorrenciaId={o.recorrencia.id} data={o.data} descricao={o.recorrencia.descricao}
                  valor={o.recorrencia.valor_centavos} tipo={o.recorrencia.tipo} atrasada={o.atrasada}
                  contaNome={o.recorrencia.cartao_id ? cartoes.find((c) => c.id === o.recorrencia.cartao_id)?.nome ?? "cartão" : mapaContas.get(o.recorrencia.conta_id ?? "")?.nome ?? "conta"} hoje={hoje} voltar="painel"
                  rv={o.recorrencia.ativo_id ? ["acao", "fii", "etf", "bdr", "cripto"].includes(classeAtivo.get(o.recorrencia.ativo_id) ?? "") : false} />
              ))}
            </ul>
          </section>
        ),
    cartoes: resumosCartoes.length > 0 && (
          <section aria-labelledby="t-cart" className="painel lg:col-span-2">
            <div className="mb-4 flex items-baseline justify-between gap-3">
              <h2 id="t-cart" className="font-display text-xl font-bold tracking-[-0.01em]">Cartões</h2>
              <Link href="/cartoes" className="link text-sm">Ver faturas</Link>
            </div>
            <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {resumosCartoes.map(({ c, r }) => {
                const destaque = r.aPagar ?? r.aberta;
                return (
                  <li key={c.id}>
                    <Link href={`/cartoes/${c.id}`} className="block rounded-xl bg-fundo p-4 hover:bg-marca-clara">
                      <p className="flex items-center gap-2 font-semibold"><span className="size-2.5 rounded-full" style={{ background: c.cor }} aria-hidden="true" />{c.nome}</p>
                      <p className="mt-2 font-display text-2xl font-bold tracking-[-0.01em]">{brl(destaque.restanteCentavos || destaque.totalCentavos)}</p>
                      <p className={`text-[13px] ${destaque.status === "vencida" ? "font-bold text-despesa" : "text-suave"}`}>
                        {destaque.status === "vencida" ? "fatura vencida" : destaque.status === "fechada" ? "fatura fechada" : "fatura aberta"} · vence {destaque.vencimento.split("-").reverse().slice(0, 2).join("/")}
                      </p>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
        ),
    categorias: (
        <section aria-labelledby="t-cats" className="painel">
          <div className="mb-5 flex items-baseline justify-between gap-3">
            <h2 id="t-cats" className="font-display text-xl font-bold tracking-[-0.01em]">Para onde foi o dinheiro</h2>
            <Link href={`/lancamentos?mes=${mes}&tipo=despesa`} className="link text-sm">Ver despesas</Link>
          </div>
          {ranking.length === 0 ? (
            <div className="flex flex-col items-center py-4 text-center">
              <Lottie src="/animacoes/vazio.json" className="h-32 w-40" />
              <p className="mt-2 font-semibold">Nenhuma despesa em {nomeMes(mes)}.</p>
              <Link href="/lancamentos/novo" className="link mt-1 text-sm">Lançar uma despesa</Link>
            </div>
          ) : (
            <ul className="space-y-4">
              {ranking.map(([id, v]) => {
                const c = mapaCats.get(id);
                return (
                  <li key={id}>
                    <div className="mb-1.5 flex items-baseline justify-between gap-3 text-[15px]">
                      <span className="flex min-w-0 items-center gap-2 font-semibold">
                        <span className="size-2.5 shrink-0 rounded-full" style={{ background: c?.cor ?? "#94a3b8" }} aria-hidden="true" />
                        <span className="truncate">{c?.nome ?? "Sem categoria"}</span>
                      </span>
                      <span className="whitespace-nowrap font-bold">
                        {brl(v)} <span className="ml-1 text-[13px] font-medium text-suave">{Math.round((v / despesas) * 100)}%</span>
                      </span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-fundo" aria-hidden="true">
                      <div className="h-full rounded-full bg-despesa" style={{ width: `${Math.max(2, (v / maiorCat) * 100)}%` }} />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
    ),
    contas: (
        <section aria-labelledby="t-contas" className="painel">
          <div className="mb-5 flex items-baseline justify-between gap-3">
            <h2 id="t-contas" className="font-display text-xl font-bold tracking-[-0.01em]">Contas</h2>
            <Link href="/contas" className="link text-sm">Gerenciar</Link>
          </div>
          <ul className="divide-y divide-linha">
            {saldos.map((c) => (
              <li key={c.conta_id}>
                <Link href={`/lancamentos?conta=${c.conta_id}&mes=${mes}`} className="-mx-2 flex min-h-12 items-center gap-3 rounded-xl px-2 hover:bg-fundo">
                  <span className="size-3 shrink-0 rounded-full" style={{ background: c.cor }} aria-hidden="true" />
                  <span className="flex-1 truncate text-[15px]">{c.nome}</span>
                  <span className={`text-[15px] font-bold ${Number(c.saldo_centavos) < 0 ? "text-despesa" : ""}`}>{brl(Number(c.saldo_centavos))}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
    ),
    grafico: (
        <GraficoMeses evol={evol} mes={mes} maxEvol={maxEvol} />
    ),
    recentes: (
        <section aria-labelledby="t-rec" className="overflow-hidden rounded-2xl border border-linha bg-papel">
          <div className="flex items-baseline justify-between gap-3 px-5 pb-2 pt-5 sm:px-6 sm:pt-6">
            <h2 id="t-rec" className="font-display text-xl font-bold tracking-[-0.01em]">Lançamentos recentes</h2>
            <Link href={`/lancamentos?mes=${mes}`} className="link text-sm">Ver todos</Link>
          </div>
          {(recentes ?? []).length === 0 ? (
            <p className="px-6 pb-6 pt-3 text-[15px] text-suave">Nada lançado em {nomeMes(mes)} ainda.</p>
          ) : (
            <div className="divide-y divide-linha">
              {(recentes as Lancamento[]).map((l) => <LinhaLancamento key={l.id} l={l} contas={mapaContas} cats={mapaCats} cartoes={new Map(cartoes.map((c) => [c.id, c]))} />)}
            </div>
          )}
        </section>
    ),
    orcamento: orcamentos.length > 0 ? (
          <section aria-labelledby="t-orc" className="painel">
            <div className="mb-4 flex items-baseline justify-between gap-3">
              <h2 id="t-orc" className="font-display text-xl font-bold tracking-[-0.01em]">Orçamento do mês</h2>
              <Link href="/planejamento" className="link text-sm">Ajustar</Link>
            </div>
            <ul className="space-y-4">
              {orcamentos.slice(0, 5).map((o) => (
                <li key={o.cat!.id}>
                  <div className="mb-1.5 flex items-baseline justify-between gap-3 text-[15px]">
                    <span className="truncate font-semibold">{o.cat!.nome}</span>
                    <span className={`whitespace-nowrap text-[13px] font-semibold ${o.estado === "estourado" ? "text-despesa" : "text-suave"}`}>{brl(o.gasto)} de {brl(o.limite)}</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-fundo" aria-hidden="true">
                    <div className={`h-full rounded-full ${o.estado === "estourado" ? "bg-despesa" : o.estado === "atencao" ? "bg-acento" : "bg-receita"}`} style={{ width: `${Math.min(100, Math.max(2, o.pct))}%` }} />
                  </div>
                </li>
              ))}
            </ul>
          </section>
        ) : (
          <section aria-labelledby="t-orc" className="painel">
            <h2 id="t-orc" className="font-display text-xl font-bold tracking-[-0.01em]">Orçamento do mês</h2>
            <p className="mt-2 text-[15px] text-suave">Defina quanto quer gastar por categoria e acompanhe aqui.</p>
            <Link href="/planejamento" className="btn-sec mt-4">Criar orçamento</Link>
          </section>
        ),
    metas: metas.length > 0 ? (
          <section aria-labelledby="t-metas" className="painel">
            <div className="mb-4 flex items-baseline justify-between gap-3">
              <h2 id="t-metas" className="font-display text-xl font-bold tracking-[-0.01em]">Metas</h2>
              <Link href="/metas" className="link text-sm">Ver todas</Link>
            </div>
            <ul className="space-y-3">
              {metas.slice(0, 3).map((m) => <li key={m.meta.id}><CartaoMeta {...m} /></li>)}
            </ul>
          </section>
        ) : (
          <section aria-labelledby="t-metas" className="painel">
            <h2 id="t-metas" className="font-display text-xl font-bold tracking-[-0.01em]">Metas</h2>
            <p className="mt-2 text-[15px] text-suave">Reserva de emergência, viagem, primeiro R$ 100 mil: dê um alvo ao seu dinheiro.</p>
            <Link href="/metas" className="btn-sec mt-4">Criar meta</Link>
          </section>
        ),
  };

  return (
    <>
      <h1 className="sr-only">Painel de {nomeMes(mes)}</h1>

      {/* Bloco do saldo: o número que importa, grande, com o resultado do mês ao lado */}
      <section aria-labelledby="t-saldo" className="mb-6 grid gap-8 rounded-3xl bg-destaque p-6 text-white sm:p-8 lg:grid-cols-[1.15fr_1fr] lg:gap-12 lg:p-10">
        <div className="flex flex-col justify-between gap-6">
          <p className="text-[15px] text-white/80">{nome ? `Olá, ${nome}.` : "Olá."} Você tem hoje</p>
          <div>
            <h2 id="t-saldo" className="sr-only">Saldo em contas</h2>
            <p className={`font-display text-[clamp(44px,7vw,72px)] font-extrabold leading-none tracking-[-0.03em] ${total < 0 ? "text-[#ff9a6b]" : ""}`}>
              {brl(total)}
            </p>
            <p className="mt-3 text-[15px] text-white/70">
              somando {saldos.length} {saldos.length === 1 ? "conta" : "contas"} ·{" "}
              <Link href="/contas" className="font-semibold text-white underline-offset-4 hover:underline">ver contas</Link>
            </p>
            {previstas.length > 0 && (
              <p className="mt-1 text-[15px] text-white/70">
                Previsto para o fim de {nomeMes(hoje.slice(0, 7)).split(" ")[0]}:{" "}
                <strong className={total + variacaoPrevista < 0 ? "text-[#ff9a6b]" : "text-white"}>{brl(total + variacaoPrevista)}</strong>
              </p>
            )}
            {(investido > 0 || dividaCartoes > 0) && (
              <p className="mt-1 text-[15px] text-white/70">
                {investido > 0 && <>+ {brl(investido)} investidos </>}
                {dividaCartoes > 0 && <>− {brl(dividaCartoes)} no cartão </>}·{" "}
                <Link href="/investimentos" className="font-semibold text-white underline-offset-4 hover:underline">
                  patrimônio líquido {brl(total + investido - dividaCartoes)}
                </Link>
              </p>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-5">
          <SeletorMes mes={mes} base="/" escuro />
          <dl className="grid grid-cols-3 gap-4">
            <div>
              <dt className="text-[13px] text-white/70">Entrou</dt>
              <dd className="mt-1 text-lg font-bold sm:text-xl">{brl(receitas)}</dd>
            </div>
            <div>
              <dt className="text-[13px] text-white/70">Saiu</dt>
              <dd className="mt-1 text-lg font-bold sm:text-xl">{brl(despesas)}</dd>
            </div>
            <div>
              <dt className="text-[13px] text-white/70">Sobrou</dt>
              <dd className={`mt-1 flex items-center gap-1 text-lg font-bold sm:text-xl ${resultado < 0 ? "text-[#ff9a6b]" : "text-acento"}`}>
                <Acento positivo={resultado >= 0} />
                {brl(Math.abs(resultado))}
              </dd>
            </div>
          </dl>
          <div>
            <div className="h-2.5 overflow-hidden rounded-full bg-white/15" aria-hidden="true">
              <div className="h-full rounded-full bg-white" style={{ width: `${Math.min(100, pctGasto ?? (despesas > 0 ? 100 : 0))}%` }} />
            </div>
            <p className="mt-2 text-[15px] text-white/85">
              {pctGasto === null
                ? despesas > 0
                  ? `Nenhuma receita em ${nomeMes(mes)} ainda — só saídas até agora.`
                  : `Nada lançado em ${nomeMes(mes)} ainda.`
                : pctGasto > 100
                  ? `Você gastou ${pctGasto}% do que entrou: ${brl(despesas - receitas)} a mais.`
                  : `Você gastou ${pctGasto}% do que entrou em ${nomeMes(mes)}.`}
            </p>
          </div>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-[1.35fr_1fr]">
        {prefs.painel_blocos.filter((b) => mostrar.has(b)).map((b) => <Fragment key={b}>{blocos[b]}</Fragment>)}
      </div>
    </>
  );
}

function saldosAtivos(dados: unknown) {
  return ((dados ?? []) as SaldoConta[]).filter((c) => !c.arquivada).map((c) => c.conta_id);
}
