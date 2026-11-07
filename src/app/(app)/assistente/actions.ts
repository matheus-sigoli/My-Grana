"use server";

import { revalidatePath } from "next/cache";
import { iaConfigurada, LIMITE_DIARIO, montarContexto, perguntarAoAssistente } from "@/lib/ia";
import { lerPreferencias } from "@/lib/preferencias";
import { texto } from "@/lib/seguranca";
import { requireUser } from "@/lib/supabase/server";

export type EstadoIa = { pergunta: string | null; resposta: string | null; erro: string | null; restantes: number | null };

/** Consentimento explícito: sem ele, nenhum dado sai do MyGrana. */
export async function definirIa(fd: FormData) {
  const { supabase } = await requireUser();
  const ativar = fd.get("ativar") === "1";
  await supabase.from("preferencias").upsert({ ia_ativada: ativar, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
  revalidatePath("/assistente");
}

export async function perguntar(_: EstadoIa, fd: FormData): Promise<EstadoIa> {
  const { supabase } = await requireUser();
  const pergunta = texto(fd, "pergunta", 500);
  const base = { pergunta, resposta: null, restantes: null };
  if (pergunta.length < 3) return { ...base, erro: "Escreva sua pergunta." };
  if (!iaConfigurada()) return { ...base, erro: "O assistente está indisponível no momento." };

  // Consentimento é conferido no servidor (não basta esconder o formulário).
  const prefs = await lerPreferencias(supabase);
  if (!prefs.ia_ativada) return { ...base, erro: "Ative o assistente antes de perguntar." };

  // Limite diário contado no banco (o usuário não consegue zerar).
  const { data: usados, error: eUso } = await supabase.rpc("registrar_uso_ia");
  if (eUso) return { ...base, erro: "Não foi possível perguntar agora. Tente de novo." };
  const restantes = Math.max(0, LIMITE_DIARIO - Number(usados));
  if (Number(usados) > LIMITE_DIARIO) return { ...base, restantes: 0, erro: `Você usou as ${LIMITE_DIARIO} perguntas de hoje. Volte amanhã.` };

  try {
    const contexto = await montarContexto(supabase);
    const resposta = await perguntarAoAssistente(pergunta, contexto);
    return { pergunta, resposta: resposta || "Não consegui responder. Tente reformular.", erro: null, restantes };
  } catch {
    return { ...base, restantes, erro: "O assistente não respondeu a tempo. Tente de novo em instantes." };
  }
}
