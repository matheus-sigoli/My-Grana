import type { SupabaseClient } from "@supabase/supabase-js";
import { resumoDoCartao } from "./cartoes";
import { carregarComprasEPagamentos } from "./dados-cartoes";
import { carregarCarteira } from "./investimentos/carteira";
import { atualDaMeta, progressoMeta, rendaPassivaMensal, type Meta } from "./planejamento";
import type { Cartao } from "./cartoes";

/** Metas do usuário com o valor atual e o progresso de cada uma. */
export async function carregarMetas(supabase: SupabaseClient, hoje: string) {
  const [{ data: metas }, { data: saldos }, { data: cartoes }, cp] = await Promise.all([
    supabase.from("metas").select("*").order("created_at"),
    supabase.from("saldos_contas").select("conta_id,saldo_centavos,arquivada"),
    supabase.from("cartoes").select("*").eq("arquivado", false),
    carregarComprasEPagamentos(supabase),
  ]);
  const lista = ((metas ?? []) as Meta[]).map((m) => ({ ...m, valor_alvo_centavos: Number(m.valor_alvo_centavos) }));
  const saldoConta = new Map((saldos ?? []).map((s) => [s.conta_id as string, Number(s.saldo_centavos)]));
  const totalContas = (saldos ?? []).filter((s) => !s.arquivada).reduce((s, c) => s + Number(c.saldo_centavos), 0);
  const divida = ((cartoes ?? []) as Cartao[]).reduce(
    (s, c) => s + resumoDoCartao({ ...c, limite_centavos: Number(c.limite_centavos) }, cp.compras, cp.pagamentos, hoje).usadoCentavos, 0);

  // A carteira (cotações) só é necessária para metas de patrimônio e renda passiva.
  let investido = 0, renda = 0;
  if (lista.some((m) => m.tipo !== "economia")) {
    try {
      const { carteira } = await carregarCarteira(supabase);
      investido = carteira.totalCentavos;
      renda = rendaPassivaMensal(carteira.proventosPorMes, hoje);
    } catch { /* sem cotações: segue com zero */ }
  }
  const ctx = { saldoConta, patrimonioCentavos: totalContas + investido - divida, rendaPassivaCentavos: renda };
  return {
    metas: lista.map((m) => {
      const atual = atualDaMeta(m, ctx);
      return { meta: m, atual, ...progressoMeta({ alvoCentavos: m.valor_alvo_centavos, atualCentavos: atual, prazo: m.prazo }, hoje) };
    }),
    ...ctx,
  };
}
