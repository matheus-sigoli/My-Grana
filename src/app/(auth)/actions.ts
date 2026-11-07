"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { texto } from "@/lib/seguranca";
import { createClient } from "@/lib/supabase/server";
import type { EstadoForm } from "@/lib/tipos";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** URL base para o link de confirmação. Usa a variável fixa em produção; nunca confia no cabeçalho Origin. */
async function urlDoSite() {
  const fixo = process.env.NEXT_PUBLIC_SITE_URL;
  if (fixo) return fixo.replace(/\/$/, "");
  const h = await headers();
  const host = h.get("host") ?? "localhost:3000";
  return `${host.startsWith("localhost") ? "http" : "https"}://${host}`;
}

export async function entrar(_: EstadoForm, fd: FormData): Promise<EstadoForm> {
  const email = texto(fd, "email", 254).toLowerCase();
  const senha = String(fd.get("senha") ?? "").slice(0, 128);
  if (!EMAIL.test(email) || !senha) return { erro: "Informe e-mail e senha." };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password: senha });
  if (error) {
    if (error.code === "email_not_confirmed") return { erro: "Confirme seu e-mail antes de entrar. O link está na sua caixa de entrada." };
    if (error.status === 429) return { erro: "Muitas tentativas. Espere alguns minutos e tente de novo." };
    // Mensagem única: não revela se o e-mail existe.
    return { erro: "E-mail ou senha incorretos." };
  }
  redirect("/");
}

export async function cadastrar(_: EstadoForm, fd: FormData): Promise<EstadoForm & { ok?: boolean }> {
  const nome = texto(fd, "nome", 60);
  const email = texto(fd, "email", 254).toLowerCase();
  const senha = String(fd.get("senha") ?? "");
  if (!EMAIL.test(email)) return { erro: "Informe um e-mail válido." };
  if (senha.length < 8) return { erro: "A senha precisa ter pelo menos 8 caracteres." };
  if (senha.length > 128) return { erro: "A senha pode ter no máximo 128 caracteres." };

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password: senha,
    options: { data: { nome }, emailRedirectTo: `${await urlDoSite()}/auth/confirm` },
  });
  if (error) {
    if (error.code === "weak_password") return { erro: "Senha fraca. Use uma frase ou combinação mais longa." };
    if (error.status === 429) return { erro: "Muitas tentativas. Espere alguns minutos e tente de novo." };
    // E-mail já cadastrado responde igual a um cadastro novo: não revela quem tem conta.
    if (error.code === "user_already_exists" || error.code === "email_exists") return { erro: null, ok: true };
    console.error("[mygrana] erro no cadastro:", error.code);
    return { erro: "Não foi possível criar a conta agora. Tente de novo em instantes." };
  }
  if (data.session) redirect("/");
  return { erro: null, ok: true };
}

export async function sair() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
