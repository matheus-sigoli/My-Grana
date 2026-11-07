import Link from "next/link";
import { FormCategoria } from "@/components/form-categoria";
import { Titulo } from "@/components/titulo";
import { agrupar } from "@/lib/categorias";
import { requireUser } from "@/lib/supabase/server";
import type { Categoria } from "@/lib/tipos";

export const metadata = { title: "Categorias" };

export default async function CategoriasPage() {
  const { supabase } = await requireUser();
  const { data } = await supabase.from("categorias").select("*");
  const cats = (data ?? []) as Categoria[];
  const maes = cats.filter((c) => !c.parent_id);
  const arquivadas = cats.filter((c) => c.arquivada);

  return (
    <>
      <Titulo sub="Organize receitas e despesas em categorias e, se quiser, subcategorias.">Categorias</Titulo>
      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="grid gap-6 md:grid-cols-2">
          {(["despesa", "receita"] as const).map((tipo) => (
            <section key={tipo}>
              <h2 className="mb-3 flex items-center gap-2 font-display text-xl font-bold tracking-[-0.01em]"><span className={`size-2.5 rounded-full ${tipo === "despesa" ? "bg-despesa" : "bg-receita"}`} aria-hidden="true" />
                {tipo === "despesa" ? "Despesas" : "Receitas"}
              </h2>
              <ul className="space-y-2">
                {agrupar(cats, tipo).map(({ mae, filhas }) => (
                  <li key={mae.id} className="rounded-2xl border border-linha bg-papel p-4">
                    <Link href={`/categorias/${mae.id}`} className="flex min-h-8 items-center gap-2 font-semibold hover:text-marca">
                      <span className="size-3 rounded-full" style={{ background: mae.cor }} />
                      {mae.nome}
                    </Link>
                    {filhas.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1.5 pl-5">
                        {filhas.map((f) => (
                          <Link key={f.id} href={`/categorias/${f.id}`} className="rounded-full bg-fundo px-3 py-1 text-[13px] font-medium text-suave hover:bg-marca-clara hover:text-marca">
                            {f.nome}
                          </Link>
                        ))}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          ))}
          {arquivadas.length > 0 && (
            <details className="md:col-span-2">
              <summary className="cursor-pointer text-sm font-medium text-suave">Arquivadas ({arquivadas.length})</summary>
              <div className="mt-2 flex flex-wrap gap-2">
                {arquivadas.map((c) => (
                  <Link key={c.id} href={`/categorias/${c.id}`} className="rounded-full border border-linha px-3 py-1 text-xs text-suave">{c.nome}</Link>
                ))}
              </div>
            </details>
          )}
        </div>
        <aside className="painel h-fit">
          <h2 className="mb-5 font-display text-xl font-bold tracking-[-0.01em]">Nova categoria</h2>
          <FormCategoria maes={maes} />
        </aside>
      </div>
    </>
  );
}
