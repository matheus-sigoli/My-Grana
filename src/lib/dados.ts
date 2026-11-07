import type { SupabaseClient } from "@supabase/supabase-js";
import type { Cartao } from "./cartoes";
import type { Categoria, Conta } from "./tipos";

export async function carregarContasECategorias(supabase: SupabaseClient) {
  const [{ data: contas }, { data: categorias }, { data: cartoes }] = await Promise.all([
    supabase.from("contas").select("*").order("nome"),
    supabase.from("categorias").select("*").order("nome"),
    supabase.from("cartoes").select("*").order("nome"),
  ]);
  return {
    contas: (contas ?? []) as Conta[],
    categorias: (categorias ?? []) as Categoria[],
    cartoes: ((cartoes ?? []) as Cartao[]).map((c) => ({ ...c, limite_centavos: Number(c.limite_centavos) })),
  };
}
