"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ehBloco, type Bloco } from "@/lib/blocos";
import { excluirItemPluggy, pluggyConfigurado } from "@/lib/openfinance/pluggy";
import { texto } from "@/lib/seguranca";
import { adminConfigurado, createAdminClient } from "@/lib/supabase/admin";
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

/**
 * Exclui a conta: apaga as conexões bancárias na Pluggy, todos os dados (função no banco, exige 2FA se ativo)
 * e o usuário do Auth (chave de serviço, só aqui). Pede para digitar EXCLUIR.
 */
export async function excluirConta(_: EstadoForm, fd: FormData): Promise<EstadoForm> {
  const { supabase, user } = await requireUser();
  if (texto(fd, "confirmacao", 20).toUpperCase() !== "EXCLUIR") return { erro: "Digite EXCLUIR para confirmar." };
  if (!adminConfigurado()) return { erro: "A exclusão de conta está indisponível no momento. Fale com o suporte." };
  // Reautenticação: só com login recente (protege contra sessão esquecida aberta em outro aparelho).
  const ultimoLogin = Date.parse(user.last_sign_in_at ?? "");
  if (!Number.isFinite(ultimoLogin) || Date.now() - ultimoLogin > 12 * 60 * 60 * 1000) {
    return { erro: "Por segurança, saia e entre de novo antes de excluir a conta." };
  }

  if (pluggyConfigurado()) {
    const { data: conexoes } = await supabase.from("conexoes_bancarias").select("pluggy_item_id");
    await Promise.all((conexoes ?? []).map((c) => excluirItemPluggy(c.pluggy_item_id as string).catch(() => undefined)));
  }
  const { error } = await supabase.rpc("apagar_meus_dados");
  if (error) return { erro: "Não foi possível apagar seus dados agora. Tente de novo." };

  const admin = createAdminClient();
  const { error: e2 } = await admin.auth.admin.deleteUser(user.id);
  if (e2) return { erro: "Seus dados foram apagados, mas o login não pôde ser removido. Tente de novo." };
  await supabase.auth.signOut();
  redirect("/login?conta=excluida");
}
