"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { paraCentavos } from "@/lib/dinheiro";
import { ehCor, ehUuid, idOpcional, texto } from "@/lib/seguranca";
import { requireUser } from "@/lib/supabase/server";
import { mensagemErro, type EstadoForm } from "@/lib/tipos";

const LIMITE = 100_000_000_000;
const dia = (v: string) => {
  const n = Math.trunc(Number(v));
  return Number.isInteger(n) && n >= 1 && n <= 31 ? n : null;
};

export async function salvarCartao(_: EstadoForm, fd: FormData): Promise<EstadoForm> {
  const { supabase } = await requireUser();
  const id = idOpcional(fd, "id");
  const nome = texto(fd, "nome", 60);
  const limite = paraCentavos(texto(fd, "limite", 24) || "0");
  const fechamento = dia(texto(fd, "dia_fechamento", 2));
  const vencimento = dia(texto(fd, "dia_vencimento", 2));
  const conta = idOpcional(fd, "conta_pagamento_id");
  const cor = texto(fd, "cor", 7);

  if (id === false || conta === false) return { erro: "Dados inválidos. Recarregue a página." };
  if (!nome) return { erro: "Dê um nome, como “Nubank” ou “Itaú Platinum”." };
  if (limite === null || limite < 0 || limite > LIMITE) return { erro: "Limite inválido. Use o formato 5.000,00." };
  if (!fechamento) return { erro: "Informe o dia do fechamento (1 a 31)." };
  if (!vencimento) return { erro: "Informe o dia do vencimento (1 a 31)." };
  if (!ehCor(cor)) return { erro: "Escolha uma cor." };

  const dados = { nome, limite_centavos: limite, dia_fechamento: fechamento, dia_vencimento: vencimento, conta_pagamento_id: conta, cor };
  const { data, error } = id
    ? await supabase.from("cartoes").update(dados).eq("id", id).select("id").single()
    : await supabase.from("cartoes").insert(dados).select("id").single();
  if (error || !data) return { erro: mensagemErro(error) };
  revalidatePath("/", "layout");
  redirect(`/cartoes/${data.id}`);
}

export async function pagarFatura(_: EstadoForm, fd: FormData): Promise<EstadoForm> {
  const { supabase } = await requireUser();
  const cartao_id = texto(fd, "cartao_id", 64);
  const fatura = texto(fd, "fatura", 10);
  const conta_id = texto(fd, "conta_id", 64);
  const data = texto(fd, "data", 10);
  const valor = paraCentavos(texto(fd, "valor", 24));
  if (!ehUuid(cartao_id) || !/^\d{4}-\d{2}-01$/.test(fatura)) return { erro: "Fatura inválida." };
  if (!ehUuid(conta_id)) return { erro: "Escolha a conta de onde sai o pagamento." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data) || data < "2000-01-01" || data > "2100-12-31") return { erro: "Data inválida." };
  if (valor === null || valor <= 0 || valor > LIMITE) return { erro: "Informe o valor pago." };
  const { error } = await supabase.from("pagamentos_fatura").insert({ cartao_id, fatura, conta_id, data, valor_centavos: valor });
  if (error) return { erro: mensagemErro(error) };
  revalidatePath("/", "layout");
  redirect(`/cartoes/${cartao_id}?fatura=${fatura.slice(0, 7)}&ok=paga`);
}

export async function excluirPagamento(fd: FormData) {
  const { supabase } = await requireUser();
  const id = texto(fd, "id", 64);
  const cartao = texto(fd, "cartao_id", 64);
  if (ehUuid(id)) await supabase.from("pagamentos_fatura").delete().eq("id", id);
  revalidatePath("/", "layout");
  redirect(ehUuid(cartao) ? `/cartoes/${cartao}` : "/cartoes");
}

export async function arquivarCartao(fd: FormData) {
  const { supabase } = await requireUser();
  const id = texto(fd, "id", 64);
  if (!ehUuid(id)) redirect("/cartoes");
  await supabase.from("cartoes").update({ arquivado: fd.get("arquivado") !== "true" }).eq("id", id);
  revalidatePath("/", "layout");
  redirect("/cartoes");
}

export async function excluirCartao(fd: FormData) {
  const { supabase } = await requireUser();
  const id = texto(fd, "id", 64);
  if (!ehUuid(id)) redirect("/cartoes");
  const { error } = await supabase.from("cartoes").delete().eq("id", id);
  if (error) redirect(`/cartoes/${id}?erro=uso`);
  revalidatePath("/", "layout");
  redirect("/cartoes");
}
