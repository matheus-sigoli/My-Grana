import Link from "next/link";
import { BotaoConfirmar } from "@/components/confirmar";
import { notFound } from "next/navigation";
import { excluirLancamento } from "../actions";
import { FormLancamento } from "@/components/form-lancamento";
import { Titulo } from "@/components/titulo";
import { carregarContasECategorias } from "@/lib/dados";
import { hojeISO } from "@/lib/datas";
import { ehUuid } from "@/lib/seguranca";
import { requireUser } from "@/lib/supabase/server";
import type { Lancamento } from "@/lib/tipos";

export const metadata = { title: "Editar lançamento" };

export default async function EditarLancamentoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!ehUuid(id)) notFound();
  const { supabase } = await requireUser();
  const [{ data }, { contas, categorias, cartoes }] = await Promise.all([
    supabase.from("lancamentos").select("*").eq("id", id).maybeSingle(),
    carregarContasECategorias(supabase),
  ]);
  if (!data) notFound();
  const l = data as Lancamento;
  let totalGrupo: number | undefined;
  let primeira = l;
  if (l.grupo_parcelas) {
    const { data: grupo } = await supabase.from("lancamentos").select("*").eq("grupo_parcelas", l.grupo_parcelas).order("parcela");
    const parcelas = (grupo ?? []) as Lancamento[];
    totalGrupo = parcelas.reduce((s, p) => s + Number(p.valor_centavos), 0);
    primeira = parcelas[0] ?? l;
  }

  return (
    <div className="mx-auto max-w-xl">
      <Link href={`/lancamentos?mes=${l.data.slice(0, 7)}`} className="text-sm text-suave hover:text-marca">‹ Lançamentos</Link>
      <Titulo sub={l.total_parcelas ? `Compra parcelada em ${l.total_parcelas}x — você está vendo a parcela ${l.parcela}.` : undefined}>Editar lançamento</Titulo>
      <section className="painel">
        <FormLancamento contas={contas} categorias={categorias} cartoes={cartoes} lancamento={primeira} totalGrupo={totalGrupo} hoje={hojeISO()} />
      </section>
      <form action={excluirLancamento} className="mt-4 flex">
        <input type="hidden" name="id" value={l.id} />
        <input type="hidden" name="mes" value={l.data.slice(0, 7)} />
        <div className="ml-auto w-full sm:w-64"><BotaoConfirmar confirmar={l.total_parcelas ? `Excluir as ${l.total_parcelas} parcelas` : "Confirmar exclusão"}>{l.total_parcelas ? "Excluir compra" : "Excluir lançamento"}</BotaoConfirmar></div>
      </form>
    </div>
  );
}
