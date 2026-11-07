import type { SupabaseClient } from "@supabase/supabase-js";
import { montarAvisos } from "./avisos";
import { resumoDoCartao, type Cartao, type CompraCartao, type PagamentoFatura } from "./cartoes";
import { idMae } from "./categorias";
import { somaDias } from "./dados-recorrencias";
import { progressoMeta } from "./planejamento";
import { ocorrenciasPrevistas, type Recorrencia, type Tratada } from "./recorrencias";
import type { Categoria } from "./tipos";

/** Gasto do mês por categoria-mãe de despesa (despesas efetivadas e previstas, parcelas pelo mês da fatura). */
export async function gastoPorCategoriaMae(supabase: SupabaseClient, userId: string, inicioMes: string, categorias: Categoria[]) {
  const { data } = await supabase.from("lancamentos").select("valor_centavos,categoria_id")
    .eq("user_id", userId).eq("tipo", "despesa").eq("competencia", inicioMes);
  const mapa = new Map(categorias.map((c) => [c.id, c]));
  const porMae = new Map<string, number>();
  for (const l of data ?? []) {
    const m = idMae(mapa, l.categoria_id as string | null);
    if (m) porMae.set(m, (porMae.get(m) ?? 0) + Number(l.valor_centavos));
  }
  return porMae;
}

/**
 * Avisos do usuário. Filtra por user_id em toda consulta: funciona com o cliente do usuário (RLS)
 * e com o cliente de serviço do cron (que ignora RLS).
 */
export async function carregarAvisos(supabase: SupabaseClient, userId: string, hoje: string) {
  const inicioMes = `${hoje.slice(0, 7)}-01`;
  const [cartoesR, comprasR, pagR, regrasR, tratR, orcR, catsR, saldosR, metasR] = await Promise.all([
    supabase.from("cartoes").select("*").eq("user_id", userId).eq("arquivado", false),
    supabase.from("lancamentos").select("id,cartao_id,competencia,valor_centavos").eq("user_id", userId).not("cartao_id", "is", null),
    supabase.from("pagamentos_fatura").select("*").eq("user_id", userId),
    supabase.from("recorrencias").select("*").eq("user_id", userId).eq("ativa", true),
    supabase.from("ocorrencias_tratadas").select("recorrencia_id,data_ocorrencia,situacao").eq("user_id", userId).gte("data_ocorrencia", somaDias(hoje, -45)),
    supabase.from("orcamentos").select("categoria_id,valor_centavos").eq("user_id", userId),
    supabase.from("categorias").select("*").eq("user_id", userId),
    supabase.from("saldos_contas").select("conta_id,nome,saldo_centavos,arquivada").eq("user_id", userId),
    supabase.from("metas").select("id,nome,tipo,valor_alvo_centavos,prazo,conta_id").eq("user_id", userId),
  ]);

  const compras = ((comprasR.data ?? []) as CompraCartao[]).map((x) => ({ ...x, valor_centavos: Number(x.valor_centavos) }));
  const pagamentos = ((pagR.data ?? []) as PagamentoFatura[]).map((x) => ({ ...x, valor_centavos: Number(x.valor_centavos) }));
  const faturas = ((cartoesR.data ?? []) as Cartao[]).flatMap((c) => {
    const r = resumoDoCartao({ ...c, limite_centavos: Number(c.limite_centavos) }, compras, pagamentos, hoje);
    return r.faturas
      .filter((f) => f.status === "vencida" || f.status === "fechada" || f.status === "aberta")
      .map((f) => ({ cartaoId: c.id, cartao: c.nome, vencimento: f.vencimento, restanteCentavos: f.restanteCentavos, status: f.status }));
  });

  const regras = ((regrasR.data ?? []) as Recorrencia[]).map((r) => ({ ...r, valor_centavos: Number(r.valor_centavos) }));
  const previstas = ocorrenciasPrevistas(regras, (tratR.data ?? []) as Tratada[], somaDias(hoje, -45), somaDias(hoje, 3), hoje)
    .map((o) => ({ recorrenciaId: o.recorrencia.id, descricao: o.recorrencia.descricao, data: o.data, valorCentavos: o.recorrencia.valor_centavos, tipo: o.recorrencia.tipo }));

  const categorias = (catsR.data ?? []) as Categoria[];
  const orcs = orcR.data ?? [];
  const gastos = orcs.length ? await gastoPorCategoriaMae(supabase, userId, inicioMes, categorias) : new Map<string, number>();
  const nomeCat = new Map(categorias.map((c) => [c.id, c.nome]));
  const orcamentos = orcs.map((o) => ({
    categoria: nomeCat.get(o.categoria_id as string) ?? "Categoria",
    gastoCentavos: gastos.get(o.categoria_id as string) ?? 0,
    limiteCentavos: Number(o.valor_centavos),
  }));

  const saldos = (saldosR.data ?? []).filter((s) => !s.arquivada);
  const saldoConta = new Map(saldos.map((s) => [s.conta_id as string, Number(s.saldo_centavos)]));
  const contasNegativas = saldos
    .filter((s) => Number(s.saldo_centavos) < 0)
    .map((s) => ({ id: s.conta_id as string, nome: s.nome as string, saldoCentavos: Number(s.saldo_centavos) }));

  // Só metas de economia têm progresso barato de calcular aqui (saldo da conta); as demais dependem da carteira.
  const metas = (metasR.data ?? [])
    .filter((m) => m.tipo === "economia" && m.conta_id)
    .map((m) => ({
      id: m.id as string,
      nome: m.nome as string,
      prazo: m.prazo as string | null,
      pct: progressoMeta({ alvoCentavos: Number(m.valor_alvo_centavos), atualCentavos: saldoConta.get(m.conta_id as string) ?? 0, prazo: m.prazo as string | null }, hoje).pct,
    }));

  return montarAvisos({ hoje, faturas, previstas, orcamentos, contasNegativas, metas });
}
