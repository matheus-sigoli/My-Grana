import Link from "next/link";
import { BotaoConfirmar } from "@/components/confirmar";
import { notFound } from "next/navigation";
import { alternarArquivada, excluirConta } from "../actions";
import { Erro } from "@/components/erro";
import { FormConta } from "@/components/form-conta";
import { Titulo } from "@/components/titulo";
import { brl } from "@/lib/dinheiro";
import { ehUuid } from "@/lib/seguranca";
import { requireUser } from "@/lib/supabase/server";
import { MSG_EM_USO } from "@/lib/tipos";
import type { Conta } from "@/lib/tipos";

export default async function EditarContaPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ erro?: string }>;
}) {
  const { id } = await params;
  const { erro } = await searchParams;
  if (!ehUuid(id)) notFound();
  const { supabase } = await requireUser();
  const [{ data: conta }, { data: saldo }] = await Promise.all([
    supabase.from("contas").select("*").eq("id", id).maybeSingle(),
    supabase.from("saldos_contas").select("saldo_centavos").eq("conta_id", id).maybeSingle(),
  ]);
  if (!conta) notFound();
  const c = conta as Conta;

  return (
    <>
      <Link href="/contas" className="text-sm text-suave hover:text-marca">‹ Contas</Link>
      <Titulo sub={`Saldo atual: ${brl(Number(saldo?.saldo_centavos ?? 0))}`}>{c.nome}</Titulo>
      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <section className="painel"><FormConta conta={c} /></section>
        <aside className="painel h-fit space-y-4">
          <Link href={`/lancamentos?conta=${c.id}`} className="btn-sec w-full">Ver lançamentos desta conta</Link>
          {c.tipo === "corretora" && <Link href="/investimentos" className="btn-sec w-full">Ver carteira de investimentos</Link>}
          <form action={alternarArquivada}>
            <input type="hidden" name="id" value={c.id} />
            <input type="hidden" name="arquivada" value={String(c.arquivada)} />
            <button className="btn-sec w-full">{c.arquivada ? "Desarquivar" : "Arquivar conta"}</button>
          </form>
          <p className="text-xs text-suave">Arquivar esconde a conta das listas e do saldo total, sem apagar o histórico.</p>
          <form action={excluirConta} className="border-t border-linha pt-4">
            <input type="hidden" name="id" value={c.id} />
            <BotaoConfirmar>Excluir conta</BotaoConfirmar>
          </form>
          <Erro msg={erro ? MSG_EM_USO : null} />
        </aside>
      </div>
    </>
  );
}
