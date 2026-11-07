"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { paraCentavos } from "@/lib/dinheiro";
import { dataIsoValida, ehUuid, idOpcional, texto } from "@/lib/seguranca";
import { requireUser } from "@/lib/supabase/server";
import { mensagemErro, type EstadoForm } from "@/lib/tipos";

const TIPOS = ["economia", "patrimonio", "renda_passiva"] as const;

export async function salvarMeta(_: EstadoForm, fd: FormData): Promise<EstadoForm> {
  const { supabase } = await requireUser();
  const id = idOpcional(fd, "id");
  const nome = texto(fd, "nome", 80);
  const tipo = texto(fd, "tipo", 20) as (typeof TIPOS)[number];
  const alvo = paraCentavos(texto(fd, "alvo", 24));
  const prazo = texto(fd, "prazo", 10) || null;
  const conta = idOpcional(fd, "conta_id");

  if (id === false || conta === false) return { erro: "Dados inválidos. Recarregue a página." };
  if (!nome) return { erro: "Dê um nome para a meta." };
  if (!TIPOS.includes(tipo)) return { erro: "Escolha o tipo da meta." };
  if (alvo === null || alvo <= 0 || alvo > 100_000_000_000) return { erro: "Informe um valor-alvo maior que zero, como 5.000,00." };
  if (prazo && !dataIsoValida(prazo)) return { erro: "Prazo inválido." };
  if (tipo === "economia" && !conta) return { erro: "Escolha a conta onde o dinheiro da meta fica guardado." };

  const dados = { nome, tipo, valor_alvo_centavos: alvo, prazo, conta_id: tipo === "economia" ? conta : null };
  const { error } = id ? await supabase.from("metas").update(dados).eq("id", id) : await supabase.from("metas").insert(dados);
  if (error) return { erro: mensagemErro(error) };
  revalidatePath("/", "layout");
  redirect("/metas?ok=salva");
}

export async function excluirMeta(fd: FormData) {
  const { supabase } = await requireUser();
  const id = String(fd.get("id") ?? "");
  if (ehUuid(id)) await supabase.from("metas").delete().eq("id", id);
  revalidatePath("/", "layout");
  redirect("/metas?ok=excluida");
}
