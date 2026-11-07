import Link from "next/link";
import { BotaoConfirmar } from "@/components/confirmar";
import { notFound } from "next/navigation";
import { alternarCategoriaArquivada, excluirCategoria } from "../actions";
import { Erro } from "@/components/erro";
import { FormCategoria } from "@/components/form-categoria";
import { Titulo } from "@/components/titulo";
import { ehUuid } from "@/lib/seguranca";
import { requireUser } from "@/lib/supabase/server";
import { MSG_EM_USO } from "@/lib/tipos";
import type { Categoria } from "@/lib/tipos";

export default async function EditarCategoriaPage({
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
  const { data } = await supabase.from("categorias").select("*");
  const cats = (data ?? []) as Categoria[];
  const c = cats.find((x) => x.id === id);
  if (!c) notFound();
  const temFilhas = cats.some((x) => x.parent_id === c.id);

  return (
    <>
      <Link href="/categorias" className="text-sm text-suave hover:text-marca">‹ Categorias</Link>
      <Titulo>{c.nome}</Titulo>
      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <section className="painel">
          <FormCategoria categoria={c} maes={cats.filter((x) => !x.parent_id)} temFilhas={temFilhas} />
        </section>
        <aside className="painel h-fit space-y-4">
          <form action={alternarCategoriaArquivada}>
            <input type="hidden" name="id" value={c.id} />
            <input type="hidden" name="arquivada" value={String(c.arquivada)} />
            <button className="btn-sec w-full">{c.arquivada ? "Desarquivar" : "Arquivar categoria"}</button>
          </form>
          <p className="text-xs text-suave">Arquivada, ela some dos formulários mas continua nos lançamentos antigos.</p>
          <form action={excluirCategoria} className="border-t border-linha pt-4">
            <input type="hidden" name="id" value={c.id} />
            <BotaoConfirmar>Excluir categoria</BotaoConfirmar>
          </form>
          <Erro msg={erro ? MSG_EM_USO : null} />
        </aside>
      </div>
    </>
  );
}
