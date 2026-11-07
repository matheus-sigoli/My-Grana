import type { SupabaseClient } from "@supabase/supabase-js";
import type { CompraCartao, PagamentoFatura } from "./cartoes";

/** Todas as compras no cartão (só o necessário para faturas e limite) e todos os pagamentos de fatura. */
export async function carregarComprasEPagamentos(supabase: SupabaseClient) {
  const [{ data: compras }, { data: pagamentos }] = await Promise.all([
    supabase.from("lancamentos").select("id,cartao_id,competencia,valor_centavos").not("cartao_id", "is", null),
    supabase.from("pagamentos_fatura").select("*").order("data"),
  ]);
  return {
    compras: ((compras ?? []) as CompraCartao[]).map((x) => ({ ...x, valor_centavos: Number(x.valor_centavos) })),
    pagamentos: ((pagamentos ?? []) as PagamentoFatura[]).map((x) => ({ ...x, valor_centavos: Number(x.valor_centavos) })),
  };
}
