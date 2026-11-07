/**
 * Avisos (M8): calculados na hora a partir dos dados — não há tabela de notificações.
 * O mesmo cálculo alimenta a central no app e o resumo diário por push.
 */

export type Aviso = {
  id: string;
  nivel: "alerta" | "info";
  titulo: string;
  texto: string;
  href: string;
};

const dias = (de: string, ate: string) => Math.round((Date.parse(`${ate}T00:00:00Z`) - Date.parse(`${de}T00:00:00Z`)) / 86_400_000);
const ddmm = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
const real = (c: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(c / 100);
const quando = (d: number) => (d === 0 ? "hoje" : d === 1 ? "amanhã" : `em ${d} dias`);

export function montarAvisos(e: {
  hoje: string;
  faturas: { cartaoId: string; cartao: string; vencimento: string; restanteCentavos: number; status: string }[];
  previstas: { recorrenciaId: string; descricao: string; data: string; valorCentavos: number; tipo: string }[];
  orcamentos: { categoria: string; gastoCentavos: number; limiteCentavos: number }[];
  contasNegativas: { id: string; nome: string; saldoCentavos: number }[];
  metas: { id: string; nome: string; prazo: string | null; pct: number }[];
}): Aviso[] {
  const out: Aviso[] = [];

  for (const f of e.faturas) {
    if (f.restanteCentavos <= 0) continue;
    const d = dias(e.hoje, f.vencimento);
    if (f.status === "vencida" || d < 0) {
      out.push({ id: `fatura-${f.cartaoId}-${f.vencimento}`, nivel: "alerta", titulo: `Fatura ${f.cartao} vencida`, texto: `${real(f.restanteCentavos)} venceu em ${ddmm(f.vencimento)}.`, href: `/cartoes/${f.cartaoId}` });
    } else if (d <= 5) {
      out.push({ id: `fatura-${f.cartaoId}-${f.vencimento}`, nivel: d <= 1 ? "alerta" : "info", titulo: `Fatura ${f.cartao} vence ${quando(d)}`, texto: `${real(f.restanteCentavos)} até ${ddmm(f.vencimento)}.`, href: `/cartoes/${f.cartaoId}` });
    }
  }

  const atrasadas = e.previstas.filter((p) => p.data < e.hoje);
  if (atrasadas.length === 1) {
    const p = atrasadas[0];
    out.push({ id: `prev-${p.recorrenciaId}-${p.data}`, nivel: "alerta", titulo: `${p.descricao} está atrasado`, texto: `${real(p.valorCentavos)} previsto para ${ddmm(p.data)}. Confirme ou pule.`, href: "/recorrentes" });
  } else if (atrasadas.length > 1) {
    out.push({ id: `prev-atrasadas-${atrasadas.length}`, nivel: "alerta", titulo: `${atrasadas.length} contas atrasadas`, texto: atrasadas.slice(0, 3).map((p) => p.descricao).join(", ") + (atrasadas.length > 3 ? "…" : ""), href: "/recorrentes" });
  }
  for (const p of e.previstas) {
    const d = dias(e.hoje, p.data);
    if (d < 0 || d > 2 || p.tipo !== "despesa") continue;
    out.push({ id: `prev-${p.recorrenciaId}-${p.data}`, nivel: "info", titulo: `${p.descricao} vence ${quando(d)}`, texto: `${real(p.valorCentavos)} em ${ddmm(p.data)}.`, href: "/recorrentes" });
  }

  for (const o of e.orcamentos) {
    if (o.limiteCentavos <= 0) continue;
    const pct = Math.round((o.gastoCentavos / o.limiteCentavos) * 100);
    if (pct >= 100) out.push({ id: `orc-${o.categoria}-100`, nivel: "alerta", titulo: `Orçamento de ${o.categoria} estourado`, texto: `${real(o.gastoCentavos)} de ${real(o.limiteCentavos)} (${pct}%).`, href: "/planejamento" });
    else if (pct >= 80) out.push({ id: `orc-${o.categoria}-80`, nivel: "info", titulo: `${o.categoria}: ${pct}% do orçamento`, texto: `Restam ${real(o.limiteCentavos - o.gastoCentavos)} neste mês.`, href: "/planejamento" });
  }

  for (const c of e.contasNegativas) {
    out.push({ id: `neg-${c.id}`, nivel: "alerta", titulo: `${c.nome} está negativa`, texto: `Saldo de ${real(c.saldoCentavos)}.`, href: `/lancamentos?conta=${c.id}` });
  }

  for (const m of e.metas) {
    if (!m.prazo || m.pct >= 100) continue;
    const d = dias(e.hoje, m.prazo);
    if (d >= 0 && d <= 30) out.push({ id: `meta-${m.id}`, nivel: "info", titulo: `Meta ${m.nome} termina ${quando(d)}`, texto: `Você está em ${m.pct}% do valor.`, href: "/metas" });
  }

  return out.sort((a, b) => (a.nivel === b.nivel ? 0 : a.nivel === "alerta" ? -1 : 1));
}
