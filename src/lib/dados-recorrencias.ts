import type { SupabaseClient } from "@supabase/supabase-js";
import { ocorrenciasPrevistas, type Recorrencia, type Tratada } from "./recorrencias";

/** Ocorrências previstas (ainda não confirmadas nem puladas) entre `de` e `ate`. */
export async function carregarPrevistas(supabase: SupabaseClient, de: string, ate: string, hoje: string) {
  const [{ data: regras }, { data: tratadas }] = await Promise.all([
    supabase.from("recorrencias").select("*").eq("ativa", true),
    supabase.from("ocorrencias_tratadas").select("recorrencia_id,data_ocorrencia,situacao").gte("data_ocorrencia", de).lte("data_ocorrencia", ate),
  ]);
  const rs = ((regras ?? []) as Recorrencia[]).map((r) => ({ ...r, valor_centavos: Number(r.valor_centavos) }));
  return { regras: rs, previstas: ocorrenciasPrevistas(rs, (tratadas ?? []) as Tratada[], de, ate, hoje) };
}

export const somaDias = (iso: string, dias: number) => new Date(Date.parse(`${iso}T00:00:00Z`) + dias * 86_400_000).toISOString().slice(0, 10);
