"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { paraCentavos } from "@/lib/dinheiro";
import { ehCor, ehUuid, idOpcional, texto } from "@/lib/seguranca";
import { requireUser } from "@/lib/supabase/server";
import { mensagemErro, type EstadoForm, type TipoConta } from "@/lib/tipos";

const TIPOS: TipoConta[] = ["corrente", "poupanca", "carteira", "corretora"];

export async function salvarConta(_: EstadoForm, fd: FormData): Promise<EstadoForm> {
  const { supabase } = await requireUser();
  const id = idOpcional(fd, "id");
  const nome = texto(fd, "nome", 60);
  const tipo = texto(fd, "tipo", 20) as TipoConta;
  const cor = texto(fd, "cor", 7);
  const saldo = paraCentavos(texto(fd, "saldo_inicial", 24) || "0");

  if (id === false) return { erro: "Dados inválidos. Recarregue a página." };
  if (!nome) return { erro: "Dê um nome para a conta." };
  if (!TIPOS.includes(tipo)) return { erro: "Tipo de conta inválido." };
  if (!ehCor(cor)) return { erro: "Escolha uma cor." };
  if (saldo === null || Math.abs(saldo) > 100_000_000_000) return { erro: "Saldo inicial inválido. Use o formato 1.234,56." };

  const dados = { nome, tipo, cor, saldo_inicial_centavos: saldo };
  const { error } = id
    ? await supabase.from("contas").update(dados).eq("id", id)
    : await supabase.from("contas").insert(dados);
  if (error) return { erro: mensagemErro(error) };

  revalidatePath("/", "layout");
  redirect("/contas");
}

export async function alternarArquivada(fd: FormData) {
  const { supabase } = await requireUser();
  const id = String(fd.get("id") ?? "");
  if (!ehUuid(id)) return;
  const arquivada = fd.get("arquivada") === "true";
  await supabase.from("contas").update({ arquivada: !arquivada }).eq("id", id);
  revalidatePath("/", "layout");
}

export async function excluirConta(fd: FormData) {
  const { supabase } = await requireUser();
  const id = String(fd.get("id") ?? "");
  if (!ehUuid(id)) redirect("/contas");
  const { error } = await supabase.from("contas").delete().eq("id", id);
  if (error) redirect(`/contas/${id}?erro=uso`);
  revalidatePath("/", "layout");
  redirect("/contas");
}
