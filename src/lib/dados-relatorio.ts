import type { SupabaseClient } from "@supabase/supabase-js";
import type { Efeito, LancRelatorio } from "./relatorio";

/** Dados de um ano para o relatório: lançamentos por competência + movimentos que mexem no saldo das contas. */
export async function carregarAno(supabase: SupabaseClient, ano: number) {
  const de = `${ano}-01-01`, ate = `${ano + 1}-01-01`;
  const [{ data: lancs }, { data: saldos }, { data: movs }, { data: ops }, { data: pags }] = await Promise.all([
    supabase.from("lancamentos").select("tipo,valor_centavos,competencia,categoria_id").eq("status", "efetivado").in("tipo", ["receita", "despesa"]).gte("competencia", de).lt("competencia", ate),
    supabase.from("saldos_contas").select("saldo_centavos,arquivada"),
    // Para voltar do saldo de hoje até o fim de cada mês: tudo de janeiro do ano em diante.
    supabase.from("lancamentos").select("tipo,valor_centavos,data,conta_id").eq("status", "efetivado").in("tipo", ["receita", "despesa"]).not("conta_id", "is", null).gte("data", de),
    supabase.from("operacoes_investimento").select("tipo,valor_centavos,taxas_centavos,ir_centavos,data").eq("afeta_caixa", true).gte("data", de),
    supabase.from("pagamentos_fatura").select("valor_centavos,data").gte("data", de),
  ]);
  const efeitos: Efeito[] = [
    ...(movs ?? []).map((l) => ({ data: l.data as string, valor: (l.tipo === "receita" ? 1 : -1) * Number(l.valor_centavos) })),
    ...(ops ?? []).map((o) => ({
      data: o.data as string,
      valor: o.tipo === "compra" || o.tipo === "aplicacao"
        ? -(Number(o.valor_centavos) + Number(o.taxas_centavos))
        : Number(o.valor_centavos) - Number(o.taxas_centavos) - Number(o.ir_centavos),
    })),
    ...(pags ?? []).map((p) => ({ data: p.data as string, valor: -Number(p.valor_centavos) })),
  ];
  return {
    lancs: ((lancs ?? []) as LancRelatorio[]).map((l) => ({ ...l, valor_centavos: Number(l.valor_centavos) })),
    // Contas arquivadas entram: o saldo delas também existia nos meses passados.
    saldoAtual: (saldos ?? []).reduce((s, c) => s + Number(c.saldo_centavos), 0),
    efeitos,
  };
}
