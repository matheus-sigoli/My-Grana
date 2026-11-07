import Link from "next/link";
import { notFound } from "next/navigation";
import { BotaoConfirmar } from "@/components/confirmar";
import { FormMeta } from "@/components/form-meta";
import { Titulo } from "@/components/titulo";
import { carregarContasECategorias } from "@/lib/dados";
import type { Meta } from "@/lib/planejamento";
import { ehUuid } from "@/lib/seguranca";
import { requireUser } from "@/lib/supabase/server";
import { excluirMeta } from "../actions";

export const metadata = { title: "Editar meta" };

export default async function EditarMetaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!ehUuid(id)) notFound();
  const { supabase } = await requireUser();
  const [{ data }, { contas }] = await Promise.all([
    supabase.from("metas").select("*").eq("id", id).maybeSingle(),
    carregarContasECategorias(supabase),
  ]);
  if (!data) notFound();
  const meta = { ...(data as Meta), valor_alvo_centavos: Number(data.valor_alvo_centavos) };

  return (
    <div className="mx-auto max-w-lg">
      <Link href="/metas" className="link text-sm">← Metas</Link>
      <div className="mt-4"><Titulo>Editar meta</Titulo></div>
      <div className="painel"><FormMeta contas={contas} meta={meta} /></div>
      <form action={excluirMeta} className="mt-4">
        <input type="hidden" name="id" value={meta.id} />
        <BotaoConfirmar>Excluir meta</BotaoConfirmar>
      </form>
    </div>
  );
}
