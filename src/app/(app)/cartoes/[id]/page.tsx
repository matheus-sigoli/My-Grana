import Link from "next/link";
import { notFound } from "next/navigation";
import { FormCartao } from "@/components/cartoes/form-cartao";
import { FormPagamento } from "@/components/cartoes/form-pagamento";
import { BotaoConfirmar } from "@/components/confirmar";
import { Erro } from "@/components/erro";
import { LinhaLancamento } from "@/components/linha-lancamento";
import { Lottie } from "@/components/lottie";
import { datasDaFatura, resumoDoCartao, type StatusFatura } from "@/lib/cartoes";
import { carregarContasECategorias } from "@/lib/dados";
import { carregarComprasEPagamentos } from "@/lib/dados-cartoes";
import { deslocaMes, hojeISO, nomeMes } from "@/lib/datas";
import { brl } from "@/lib/dinheiro";
import { ehUuid } from "@/lib/seguranca";
import { requireUser } from "@/lib/supabase/server";
import { MSG_EM_USO, type Lancamento } from "@/lib/tipos";
import { arquivarCartao, excluirCartao, excluirPagamento } from "../actions";

const ROTULO: Record<StatusFatura, string> = {
  aberta: "Aberta", futura: "Futura", fechada: "Fechada", paga: "Paga", vencida: "Vencida", vazia: "Sem compras",
};
const COR: Record<StatusFatura, string> = {
  aberta: "bg-marca-clara text-marca", futura: "bg-fundo text-suave", fechada: "bg-acento text-[#0f1b17]",
  paga: "bg-marca text-white", vencida: "bg-despesa text-white", vazia: "bg-fundo text-suave",
};
const dmy = (iso: string) => iso.split("-").reverse().join("/");

export default async function CartaoPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ fatura?: string; ok?: string; erro?: string }> }) {
  const { id } = await params;
  const sp = await searchParams;
  if (!ehUuid(id)) notFound();
  const { supabase } = await requireUser();
  const hoje = hojeISO();
  const [{ contas, categorias, cartoes }, { compras, pagamentos }] = await Promise.all([carregarContasECategorias(supabase), carregarComprasEPagamentos(supabase)]);
  const c = cartoes.find((x) => x.id === id);
  if (!c) notFound();
  const r = resumoDoCartao(c, compras, pagamentos, hoje);

  // Fatura exibida: a da URL, senão a que precisa ser paga, senão a aberta.
  const padrao = (r.aPagar ?? r.aberta).fatura;
  const escolhida = sp.fatura && /^\d{4}-\d{2}$/.test(sp.fatura) ? `${sp.fatura}-01` : padrao;
  const f = r.faturas.find((x) => x.fatura === escolhida) ?? {
    fatura: escolhida, ...datasDaFatura(c, escolhida), totalCentavos: 0, pagoCentavos: 0, restanteCentavos: 0, status: "vazia" as StatusFatura,
  };
  const { data: itens } = await supabase.from("lancamentos").select("*").eq("cartao_id", id).eq("competencia", escolhida).order("data", { ascending: false });
  const lancs = ((itens ?? []) as Lancamento[]).map((l) => ({ ...l, valor_centavos: Number(l.valor_centavos) }));
  const pagos = pagamentos.filter((p) => p.cartao_id === id && p.fatura === escolhida);
  const mesF = escolhida.slice(0, 7);
  const nomeConta = new Map(contas.map((x) => [x.id, x.nome]));

  return (
    <>
      <Link href="/cartoes" className="text-sm text-suave hover:text-marca">‹ Cartões</Link>
      <div className="mb-6 mt-1 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2.5 font-display text-[28px] font-bold leading-tight tracking-[-0.02em] sm:text-[34px]">
            <span className="size-4 rounded-full" style={{ background: c.cor }} aria-hidden="true" />{c.nome}
          </h1>
          <p className="mt-1 text-[15px] text-suave">
            {c.limite_centavos > 0 ? `${brl(r.disponivelCentavos)} disponíveis de ${brl(c.limite_centavos)} · ` : ""}fecha dia {c.dia_fechamento}, vence dia {c.dia_vencimento}
          </p>
        </div>
        <Link href={`/lancamentos/novo?tipo=despesa`} className="btn">Nova compra</Link>
      </div>

      {sp.ok === "paga" && (
        <div role="status" className="mb-6 flex items-center gap-3 rounded-2xl bg-marca-clara px-4 py-3 text-marca">
          <Lottie src="/animacoes/sucesso.json" className="size-10 shrink-0" />
          <p className="font-semibold">Pagamento registrado.</p>
        </div>
      )}

      <nav aria-label="Faturas" className="mb-6 flex items-center gap-2">
        <Link href={`/cartoes/${id}?fatura=${deslocaMes(mesF, -1)}`} aria-label="Fatura anterior" className="grid size-10 place-items-center rounded-full border border-linha bg-papel text-lg hover:bg-fundo">‹</Link>
        <p className="min-w-44 text-center font-semibold first-letter:uppercase">Fatura de {nomeMes(mesF)}</p>
        <Link href={`/cartoes/${id}?fatura=${deslocaMes(mesF, 1)}`} aria-label="Próxima fatura" className="grid size-10 place-items-center rounded-full border border-linha bg-papel text-lg hover:bg-fundo">›</Link>
      </nav>

      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        <div className="space-y-6">
          <section aria-label="Resumo da fatura" className="grid gap-6 rounded-3xl bg-destaque p-6 text-white sm:grid-cols-[1fr_auto] sm:p-8">
            <div>
              <span className={`inline-block rounded-full px-3 py-1 text-[13px] font-bold ${COR[f.status]}`}>{ROTULO[f.status]}</span>
              <p className="mt-3 font-display text-[clamp(36px,6vw,56px)] font-extrabold leading-none tracking-[-0.03em]">{brl(f.totalCentavos)}</p>
              {f.pagoCentavos > 0 && <p className="mt-2 text-[15px] text-white/80">Pago {brl(f.pagoCentavos)} · falta {brl(f.restanteCentavos)}</p>}
            </div>
            <dl className="grid content-end gap-2 text-[15px]">
              <div className="flex justify-between gap-6"><dt className="text-white/70">Fecha</dt><dd className="font-semibold">{dmy(f.fechamento)}</dd></div>
              <div className="flex justify-between gap-6"><dt className="text-white/70">Vence</dt><dd className="font-semibold">{dmy(f.vencimento)}</dd></div>
            </dl>
          </section>

          <section className="overflow-hidden rounded-2xl border border-linha bg-papel">
            <h2 className="px-5 pb-2 pt-5 font-display text-xl font-bold">Compras nesta fatura</h2>
            {lancs.length === 0 ? (
              <p className="px-5 pb-5 text-[15px] text-suave">Nenhuma compra nesta fatura.</p>
            ) : (
              <div className="divide-y divide-linha">
                {lancs.map((l) => <LinhaLancamento key={l.id} l={l} contas={new Map(contas.map((x) => [x.id, x]))} cats={new Map(categorias.map((x) => [x.id, x]))} cartoes={new Map([[c.id, c]])} />)}
              </div>
            )}
          </section>

          {pagos.length > 0 && (
            <section className="overflow-hidden rounded-2xl border border-linha bg-papel">
              <h2 className="px-5 pb-2 pt-5 font-display text-xl font-bold">Pagamentos</h2>
              <ul className="divide-y divide-linha">
                {pagos.map((p) => (
                  <li key={p.id} className="flex items-center gap-3 px-5 py-3">
                    <span className="flex-1 text-[15px]">{dmy(p.data)} · {nomeConta.get(p.conta_id) ?? "conta"}</span>
                    <span className="font-bold">{brl(p.valor_centavos)}</span>
                    <form action={excluirPagamento}>
                      <input type="hidden" name="id" value={p.id} />
                      <input type="hidden" name="cartao_id" value={c.id} />
                      <button className="rounded-full px-3 py-1.5 text-[13px] font-semibold text-suave hover:bg-despesa/10 hover:text-despesa" aria-label={`Excluir pagamento de ${dmy(p.data)}`}>Excluir</button>
                    </form>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>

        <aside className="space-y-6">
          {f.restanteCentavos > 0 && (
            <section className="painel">
              <h2 className="mb-4 font-display text-xl font-bold">Pagar fatura</h2>
              <FormPagamento cartaoId={c.id} fatura={f.fatura} restante={f.restanteCentavos} contas={contas} contaPadrao={c.conta_pagamento_id} hoje={hoje} />
            </section>
          )}
          <details className="painel">
            <summary className="cursor-pointer font-display text-xl font-bold">Editar cartão</summary>
            <div className="mt-4 space-y-5">
              <FormCartao cartao={c} contas={contas} />
              <form action={arquivarCartao}>
                <input type="hidden" name="id" value={c.id} />
                <input type="hidden" name="arquivado" value={String(c.arquivado)} />
                <button className="btn-sec w-full">{c.arquivado ? "Desarquivar" : "Arquivar cartão"}</button>
              </form>
              <form action={excluirCartao}>
                <input type="hidden" name="id" value={c.id} />
                <BotaoConfirmar>Excluir cartão</BotaoConfirmar>
              </form>
              <Erro msg={sp.erro ? MSG_EM_USO : null} />
            </div>
          </details>
        </aside>
      </div>
    </>
  );
}
