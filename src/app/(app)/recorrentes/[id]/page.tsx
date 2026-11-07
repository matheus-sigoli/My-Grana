import Link from "next/link";
import { notFound } from "next/navigation";
import { BotaoConfirmar } from "@/components/confirmar";
import { FormRecorrencia } from "@/components/recorrentes/form-recorrencia";
import { Titulo } from "@/components/titulo";
import { carregarContasECategorias } from "@/lib/dados";
import { somaDias } from "@/lib/dados-recorrencias";
import { hojeISO } from "@/lib/datas";
import { datasEntre, type Recorrencia } from "@/lib/recorrencias";
import { ehUuid } from "@/lib/seguranca";
import { requireUser } from "@/lib/supabase/server";
import { encerrarRecorrencia, excluirRecorrencia } from "../actions";

export default async function EditarRecorrenciaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!ehUuid(id)) notFound();
  const { supabase } = await requireUser();
  const hoje = hojeISO();
  const [{ data }, { contas, categorias, cartoes }, { data: ativos }] = await Promise.all([
    supabase.from("recorrencias").select("*").eq("id", id).maybeSingle(),
    carregarContasECategorias(supabase),
    supabase.from("ativos").select("id,nome,ticker").order("nome"),
  ]);
  if (!data) notFound();
  const r = { ...data, valor_centavos: Number(data.valor_centavos) } as Recorrencia;
  const proxima = datasEntre(r, hoje, somaDias(hoje, 400))[0];

  return (
    <div className="mx-auto max-w-2xl">
      <Link href="/recorrentes" className="text-sm text-suave hover:text-marca">‹ Recorrentes</Link>
      <Titulo sub={r.ativa ? undefined : "Encerrada"}>{r.descricao}</Titulo>
      <section className="painel">
        <FormRecorrencia cartoes={cartoes} contas={contas} categorias={categorias} ativos={ativos ?? []} hoje={hoje} regra={r} proxima={proxima} />
      </section>
      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        {r.ativa && (
          <form action={encerrarRecorrencia}>
            <input type="hidden" name="id" value={r.id} />
            <button className="btn-sec w-full">Encerrar (para de prever)</button>
          </form>
        )}
        <form action={excluirRecorrencia}>
          <input type="hidden" name="id" value={r.id} />
          <BotaoConfirmar confirmar="Excluir recorrência">Excluir</BotaoConfirmar>
        </form>
      </div>
      <p className="mt-3 text-[13px] text-suave">Excluir não apaga os lançamentos já confirmados.</p>
    </div>
  );
}
