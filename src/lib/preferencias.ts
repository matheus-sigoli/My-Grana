import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { cache } from "react";
import { createClient } from "./supabase/server";
import { BLOCOS_PADRAO, ehBloco, type Bloco } from "./blocos";

export type Preferencias = { ia_ativada: boolean; painel_blocos: Bloco[] };

/** Uma leitura por requisição, mesmo chamada do layout e da página (React.cache, sem argumentos = mesma chave). */
export const carregarPreferencias = cache(async (): Promise<Preferencias> => {
  const supabase = await createClient();
  return lerPreferencias(supabase);
});

export async function lerPreferencias(supabase: SupabaseClient): Promise<Preferencias> {
  const { data } = await supabase.from("preferencias").select("ia_ativada,painel_blocos").maybeSingle();
  return {
    ia_ativada: !!data?.ia_ativada,
    painel_blocos: ((data?.painel_blocos as string[] | undefined) ?? BLOCOS_PADRAO).filter(ehBloco),
  };
}
