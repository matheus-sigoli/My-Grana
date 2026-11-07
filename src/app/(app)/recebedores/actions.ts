"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ehUuid, texto } from "@/lib/seguranca";
import { requireUser } from "@/lib/supabase/server";

/** Muda o destino da regra: "cat:<id>" (categoria) ou "rec:<id>" (conta fixa). As FKs garantem que são do usuário. */
export async function salvarRegra(fd: FormData) {
  const { supabase } = await requireUser();
  const id = texto(fd, "id", 40);
  const [tipo, alvo] = texto(fd, "destino", 50).split(":");
  if (!ehUuid(id) || !ehUuid(alvo) || (tipo !== "cat" && tipo !== "rec")) redirect("/recebedores?ok=erro");

  let dados: { categoria_id: string; recorrencia_id: string | null } | null = null;
  if (tipo === "cat") dados = { categoria_id: alvo, recorrencia_id: null };
  else {
    const { data: r } = await supabase.from("recorrencias").select("categoria_id").eq("id", alvo).maybeSingle();
    if (r?.categoria_id) dados = { categoria_id: r.categoria_id as string, recorrencia_id: alvo };
  }
  const { error } = dados
    ? await supabase.from("regras_recebedor").update({ ...dados, updated_at: new Date().toISOString() }).eq("id", id)
    : { error: true };
  revalidatePath("/recebedores");
  redirect(`/recebedores?ok=${error ? "erro" : "salva"}`);
}

export async function excluirRegra(fd: FormData) {
  const { supabase } = await requireUser();
  const id = String(fd.get("id") ?? "");
  if (ehUuid(id)) await supabase.from("regras_recebedor").delete().eq("id", id);
  revalidatePath("/recebedores");
  redirect("/recebedores?ok=excluida");
}
