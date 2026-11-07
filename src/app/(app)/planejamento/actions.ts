"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { paraCentavos } from "@/lib/dinheiro";
import { texto } from "@/lib/seguranca";
import { requireUser } from "@/lib/supabase/server";

const MAX = 100_000_000_000;

/** Salva os limites de todas as categorias-mãe de despesa de uma vez; campo vazio remove o orçamento. */
export async function salvarOrcamentos(fd: FormData) {
  const { supabase } = await requireUser();
  // Só categorias do próprio usuário (RLS) — ids vindos do form que não estiverem aqui são ignorados.
  const { data: cats } = await supabase.from("categorias").select("id").eq("tipo", "despesa").is("parent_id", null);
  const upserts: { categoria_id: string; valor_centavos: number }[] = [];
  const remover: string[] = [];
  let invalido = false;
  for (const { id } of cats ?? []) {
    const bruto = texto(fd, `orc_${id}`, 24);
    if (!bruto) { remover.push(id as string); continue; }
    const v = paraCentavos(bruto);
    if (v === null || v <= 0 || v > MAX) { invalido = true; continue; }
    upserts.push({ categoria_id: id as string, valor_centavos: v });
  }
  if (upserts.length) await supabase.from("orcamentos").upsert(upserts, { onConflict: "user_id,categoria_id" });
  if (remover.length) await supabase.from("orcamentos").delete().in("categoria_id", remover);
  revalidatePath("/", "layout");
  redirect(`/planejamento?ok=${invalido ? "parcial" : "orcamento"}`);
}
