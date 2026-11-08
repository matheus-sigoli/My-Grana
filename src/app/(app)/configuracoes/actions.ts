"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ehBloco, type Bloco } from "@/lib/blocos";
import { excluirItemPluggy, pluggyConfigurado } from "@/lib/openfinance/pluggy";
import { texto } from "@/lib/seguranca";
import { requireUser } from "@/lib/supabase/server";
import type { EstadoForm } from "@/lib/tipos";

/** Ordem e visibilidade dos blocos do painel (só valores da lista fixa; o banco também confere). */
export async function salvarPainel(fd: FormData) {
  const { supabase } = await requireUser();
  const blocos = [...new Set(fd.getAll("bloco").map(String).filter(ehBloco))] as Bloco[];
  await supabase.from("preferencias").upsert({ painel_blocos: blocos, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
  revalidatePath("/", "layout");
  redirect("/configuracoes?ok=painel");
}

/** Mensagem amigável para o erro vindo das funções do banco. */
function erroDoBanco(msg: string | undefined, acao: string): string {
  if (msg?.includes("login_antigo")) return `Por segurança, saia e entre de novo antes de ${acao}.`;
  if (msg?.includes("autenticador")) return "Confirme o código do autenticador (2FA) e tente de novo.";
  return "Não foi possível concluir agora. Tente de novo em instantes.";
}

async function desconectarBancos(supabase: Awaited<ReturnType<typeof requireUser>>["supabase"]) {
  if (!pluggyConfigurado()) return;
  const { data: conexoes } = await supabase.from("conexoes_bancarias").select("pluggy_item_id");
  await Promise.all((conexoes ?? []).map((c) => excluirItemPluggy(c.pluggy_item_id as string).catch(() => undefined)));
}

/**
 * Apaga todas as informações (contas, lançamentos, cartões, investimentos, metas, importações…) e mantém o login.
 * As categorias padrão voltam. O banco confere 2FA e login recente (12 h). Pede para digitar APAGAR.
 */
export async function apagarDados(_: EstadoForm, fd: FormData): Promise<EstadoForm> {
  const { supabase } = await requireUser();
  if (texto(fd, "confirmacao", 20).toUpperCase() !== "APAGAR") return { erro: "Digite APAGAR para confirmar." };
  await desconectarBancos(supabase);
  const { error } = await supabase.rpc("apagar_meus_dados");
  if (error) return { erro: erroDoBanco(error.message, "apagar seus dados") };
  revalidatePath("/", "layout");
  redirect("/configuracoes?ok=dados");
}

/**
 * Exclui a conta: desconecta os bancos na Pluggy e chama excluir_minha_conta() no banco, que apaga os dados e o login
 * do próprio usuário (2FA e login recente conferidos lá). Não depende da chave de serviço. Pede para digitar EXCLUIR.
 */
export async function excluirConta(_: EstadoForm, fd: FormData): Promise<EstadoForm> {
  const { supabase } = await requireUser();
  if (texto(fd, "confirmacao", 20).toUpperCase() !== "EXCLUIR") return { erro: "Digite EXCLUIR para confirmar." };
  await desconectarBancos(supabase);
  const { error } = await supabase.rpc("excluir_minha_conta");
  if (error) return { erro: erroDoBanco(error.message, "excluir a conta") };
  await supabase.auth.signOut().catch(() => undefined);
  redirect("/login?conta=excluida");
}
