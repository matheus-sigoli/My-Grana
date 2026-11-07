/**
 * Detecção de gastos recorrentes (diferencial): procura no histórico lançamentos que se repetem todo mês
 * com descrição parecida e valor estável, e que ainda não viraram uma Recorrência. Só sugere — o usuário decide.
 */

export type LancHistorico = {
  tipo: "receita" | "despesa" | "transferencia";
  descricao: string;
  valor_centavos: number;
  data: string;
  conta_id: string | null;
  cartao_id: string | null;
  categoria_id: string | null;
  grupo_parcelas: string | null;
};

export type Sugestao = {
  chave: string;
  tipo: "receita" | "despesa";
  descricao: string;
  valorCentavos: number;
  dia: number;
  meses: number;
  conta_id: string | null;
  cartao_id: string | null;
  categoria_id: string | null;
};

/** Tira números (datas, parcelas, códigos), acentos e pontuação: "NETFLIX.COM 12/10" → "netflix com". */
export const chaveDescricao = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z ]+/g, " ").replace(/\s+/g, " ").trim();

const mediana = (xs: number[]) => {
  const o = [...xs].sort((a, b) => a - b);
  const m = Math.floor(o.length / 2);
  return o.length % 2 ? o[m] : Math.round((o[m - 1] + o[m]) / 2);
};

/**
 * Regra: mesma chave de descrição e tipo, em ≥ 3 meses diferentes dos últimos 6, com valor a até 15% da mediana
 * em todos eles, e o mês mais recente entre os 2 últimos (ainda está acontecendo). Parcelas não contam.
 */
export function detectarRecorrentes(lancs: LancHistorico[], descricoesComRegra: string[], hoje: string): Sugestao[] {
  const jaTem = new Set(descricoesComRegra.map(chaveDescricao));
  const [a, m] = hoje.split("-").map(Number);
  const mesesAtras = (n: number) => {
    const d = new Date(Date.UTC(a, m - 1 - n, 1));
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
  };
  const desde = mesesAtras(6);
  const recente = mesesAtras(1);

  const grupos = new Map<string, LancHistorico[]>();
  for (const l of lancs) {
    if (l.tipo === "transferencia" || l.grupo_parcelas || l.data.slice(0, 7) < desde) continue;
    const k = chaveDescricao(l.descricao);
    if (k.length < 3 || jaTem.has(k)) continue;
    const chave = `${l.tipo}|${k}`;
    grupos.set(chave, [...(grupos.get(chave) ?? []), l]);
  }

  const out: Sugestao[] = [];
  for (const [chave, ls] of grupos) {
    // um valor por mês (o maior, se houver dois no mesmo mês)
    const porMes = new Map<string, LancHistorico>();
    for (const l of ls) {
      const mes = l.data.slice(0, 7);
      const atual = porMes.get(mes);
      if (!atual || l.valor_centavos > atual.valor_centavos) porMes.set(mes, l);
    }
    if (porMes.size < 3) continue;
    const meses = [...porMes.keys()].sort();
    if (meses[meses.length - 1] < recente) continue;
    const valores = [...porMes.values()].map((l) => l.valor_centavos);
    const med = mediana(valores);
    if (!valores.every((v) => Math.abs(v - med) <= med * 0.15)) continue;
    const ultimo = porMes.get(meses[meses.length - 1])!;
    out.push({
      chave,
      tipo: ultimo.tipo as "receita" | "despesa",
      descricao: ultimo.descricao,
      valorCentavos: med,
      dia: mediana([...porMes.values()].map((l) => Number(l.data.slice(8, 10)))),
      meses: porMes.size,
      conta_id: ultimo.conta_id,
      cartao_id: ultimo.cartao_id,
      categoria_id: ultimo.categoria_id,
    });
  }
  return out.sort((x, y) => y.valorCentavos - x.valorCentavos).slice(0, 10);
}
