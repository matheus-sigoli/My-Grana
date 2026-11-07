/** Relatórios (M6): balanço anual por mês e por categoria, e o saldo das contas no fim de cada mês. Puro. */
import { idMae } from "./categorias";
import type { Categoria } from "./tipos";

export type LancRelatorio = { tipo: string; valor_centavos: number; competencia: string; categoria_id: string | null };

export function balancoAnual(lancs: LancRelatorio[], ano: number, categorias: Categoria[]) {
  const mapa = new Map(categorias.map((c) => [c.id, c]));
  const meses = Array.from({ length: 12 }, () => ({ receitas: 0, despesas: 0 }));
  const porCat = new Map<string, { tipo: string; total: number; porMes: number[] }>();
  for (const l of lancs) {
    if (Number(l.competencia.slice(0, 4)) !== ano || (l.tipo !== "receita" && l.tipo !== "despesa")) continue;
    const i = Number(l.competencia.slice(5, 7)) - 1;
    if (l.tipo === "receita") meses[i].receitas += l.valor_centavos;
    else meses[i].despesas += l.valor_centavos;
    const mae = idMae(mapa, l.categoria_id) ?? "sem";
    const k = `${l.tipo}|${mae}`;
    const atual = porCat.get(k) ?? { tipo: l.tipo, total: 0, porMes: Array(12).fill(0) };
    atual.total += l.valor_centavos;
    atual.porMes[i] += l.valor_centavos;
    porCat.set(k, atual);
  }
  const receitas = meses.reduce((s, m) => s + m.receitas, 0);
  const despesas = meses.reduce((s, m) => s + m.despesas, 0);
  const categoriasOrdenadas = [...porCat.entries()]
    .map(([k, v]) => {
      const id = k.split("|")[1];
      const c = mapa.get(id);
      return { id, nome: c?.nome ?? "Sem categoria", cor: c?.cor ?? "#94a3b8", ...v };
    })
    .sort((a, b) => b.total - a.total);
  return {
    meses: meses.map((m) => ({ ...m, resultado: m.receitas - m.despesas })),
    receitas,
    despesas,
    resultado: receitas - despesas,
    taxaPoupanca: receitas > 0 ? Math.round(((receitas - despesas) / receitas) * 100) : null,
    categorias: categoriasOrdenadas,
  };
}

/** Efeito de um movimento no total das contas (centavos, com sinal) em uma data. */
export type Efeito = { data: string; valor: number };

/**
 * Saldo total das contas no fim de cada mês do ano, voltando a partir do saldo de hoje:
 * saldo(fim do mês) = saldo atual − efeitos depois dessa data. Meses futuros ficam null.
 */
export function saldosFimDoMes(saldoAtual: number, efeitos: Efeito[], ano: number, hoje: string) {
  const ordenados = [...efeitos].sort((a, b) => (a.data < b.data ? 1 : -1)); // mais recentes primeiro
  return Array.from({ length: 12 }, (_, i) => {
    const fim = new Date(Date.UTC(ano, i + 1, 0)).toISOString().slice(0, 10);
    if (`${ano}-${String(i + 1).padStart(2, "0")}-01` > hoje) return null;
    let s = saldoAtual;
    for (const e of ordenados) {
      if (e.data <= fim) break;
      s -= e.valor;
    }
    return s;
  });
}

/** Célula de CSV para Excel pt-BR: separador ";", aspas escapadas e proteção contra fórmulas (CSV injection). */
export function celulaCsv(v: string | number) {
  if (typeof v === "number") return (v / 100).toFixed(2).replace(".", ",");
  let s = String(v).replace(/\r?\n/g, " ");
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[";]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
