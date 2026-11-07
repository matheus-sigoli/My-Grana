"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ehCor, ehUuid, idOpcional, texto } from "@/lib/seguranca";
import { requireUser } from "@/lib/supabase/server";
import { mensagemErro, type EstadoForm, type TipoCategoria } from "@/lib/tipos";

export async function salvarCategoria(_: EstadoForm, fd: FormData): Promise<EstadoForm> {
  const { supabase } = await requireUser();
  const id = idOpcional(fd, "id");
  const nome = texto(fd, "nome", 40);
  const tipo = texto(fd, "tipo", 10) as TipoCategoria;
  const parent_id = idOpcional(fd, "parent_id");
  const cor = texto(fd, "cor", 7);

  if (id === false || parent_id === false) return { erro: "Dados inválidos. Recarregue a página." };
  if (!nome) return { erro: "Dê um nome para a categoria." };
  if (!id && tipo !== "receita" && tipo !== "despesa") return { erro: "Escolha se é de despesa ou de receita." };
  if (!ehCor(cor)) return { erro: "Escolha uma cor." };
  if (id && parent_id === id) return { erro: "Uma categoria não pode ficar dentro dela mesma." };

  // O tipo não muda depois de criada (lançamentos antigos dependem dele).
  const { error } = id
    ? await supabase.from("categorias").update({ nome, parent_id, cor }).eq("id", id)
    : await supabase.from("categorias").insert({ nome, tipo, parent_id, cor });
  if (error) return { erro: mensagemErro(error) };

  revalidatePath("/", "layout");
  redirect("/categorias");
}

export async function alternarCategoriaArquivada(fd: FormData) {
  const { supabase } = await requireUser();
  const id = String(fd.get("id") ?? "");
  if (!ehUuid(id)) return;
  const arquivada = fd.get("arquivada") === "true";
  await supabase.from("categorias").update({ arquivada: !arquivada }).eq("id", id);
  revalidatePath("/", "layout");
}

export async function excluirCategoria(fd: FormData) {
  const { supabase } = await requireUser();
  const id = String(fd.get("id") ?? "");
  if (!ehUuid(id)) redirect("/categorias");
  const { error } = await supabase.from("categorias").delete().eq("id", id);
  if (error) redirect(`/categorias/${id}?erro=uso`);
  revalidatePath("/", "layout");
  redirect("/categorias");
}
