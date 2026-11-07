/**
 * Recorrências (ADR-0002): a regra gera ocorrências calculadas; só as tratadas (confirmadas/puladas) viram linha.
 * Módulo puro, sem banco.
 */

export type Frequencia = "semanal" | "mensal" | "anual";
export type TipoRecorrencia = "receita" | "despesa" | "transferencia" | "aporte";

export type Recorrencia = {
  id: string;
  tipo: TipoRecorrencia;
  descricao: string;
  valor_centavos: number;
  frequencia: Frequencia;
  data_inicio: string;
  data_fim: string | null;
  conta_id: string | null;
  cartao_id?: string | null;
  conta_destino_id: string | null;
  categoria_id: string | null;
  ativo_id: string | null;
  ativa: boolean;
};

export type Tratada = { recorrencia_id: string; data_ocorrencia: string; situacao: "confirmada" | "pulada" };

export type Ocorrencia = { recorrencia: Recorrencia; data: string; atrasada: boolean };

const ms = (iso: string) => Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10));
const iso = (t: number) => new Date(t).toISOString().slice(0, 10);
const ultimoDia = (ano: number, mes0: number) => new Date(Date.UTC(ano, mes0 + 1, 0)).getUTCDate();

/** Data da n-ésima ocorrência (n = 0 é a data de início). Meses curtos usam o último dia; 29/02 vira 28/02. */
export function enesima(r: Pick<Recorrencia, "frequencia" | "data_inicio">, n: number) {
  const ano = +r.data_inicio.slice(0, 4);
  const mes0 = +r.data_inicio.slice(5, 7) - 1;
  const dia = +r.data_inicio.slice(8, 10);
  if (r.frequencia === "semanal") return iso(ms(r.data_inicio) + n * 7 * 86_400_000);
  const totalMeses = r.frequencia === "mensal" ? mes0 + n : mes0 + 12 * n;
  const a = ano + Math.floor(totalMeses / 12);
  const m = ((totalMeses % 12) + 12) % 12;
  return iso(Date.UTC(a, m, Math.min(dia, ultimoDia(a, m))));
}

/** Datas da regra dentro de [de, ate] (inclusive). */
export function datasEntre(r: Recorrencia, de: string, ate: string) {
  const fim = r.data_fim && r.data_fim < ate ? r.data_fim : ate;
  const datas: string[] = [];
  for (let n = 0; n < 5000; n++) {
    const d = enesima(r, n);
    if (d > fim) break;
    if (d >= de) datas.push(d);
  }
  return datas;
}

/**
 * Ocorrências ainda previstas (não confirmadas nem puladas) entre `de` e `ate`.
 * As anteriores a `hoje` voltam marcadas como atrasadas.
 */
export function ocorrenciasPrevistas(regras: Recorrencia[], tratadas: Tratada[], de: string, ate: string, hoje: string): Ocorrencia[] {
  const feitas = new Set(tratadas.map((t) => `${t.recorrencia_id}|${t.data_ocorrencia}`));
  const out: Ocorrencia[] = [];
  for (const r of regras) {
    if (!r.ativa) continue;
    for (const d of datasEntre(r, de, ate)) {
      if (!feitas.has(`${r.id}|${d}`)) out.push({ recorrencia: r, data: d, atrasada: d < hoje });
    }
  }
  return out.sort((a, b) => a.data.localeCompare(b.data) || a.recorrencia.descricao.localeCompare(b.recorrencia.descricao));
}

/**
 * Efeito das ocorrências previstas no saldo das contas (centavos, por conta).
 * Receita +; despesa −; aporte − na conta de origem; transferência − origem / + destino.
 */
export function efeitoNoSaldo(ocs: Ocorrencia[]) {
  const porConta = new Map<string, number>();
  const soma = (id: string, v: number) => porConta.set(id, (porConta.get(id) ?? 0) + v);
  for (const { recorrencia: r } of ocs) {
    if (!r.conta_id) continue; // no cartão: entra na fatura, não no saldo agora
    if (r.tipo === "receita") soma(r.conta_id, r.valor_centavos);
    else if (r.tipo === "despesa" || r.tipo === "aporte") soma(r.conta_id, -r.valor_centavos);
    else if (r.tipo === "transferencia" && r.conta_destino_id) {
      soma(r.conta_id, -r.valor_centavos);
      soma(r.conta_destino_id, r.valor_centavos);
    }
  }
  return porConta;
}

/** Data para encerrar a regra antiga quando o usuário edita "esta e as próximas" a partir de `data`. */
export const diaAnterior = (data: string) => iso(ms(data) - 86_400_000);

/**
 * Sugere qual ocorrência prevista corresponde a uma transação do banco:
 * mesma conta, mesmo sentido, valor até 10% diferente e data a até 7 dias. Escolhe a mais próxima.
 */
export function casarComPrevista(
  tx: { conta_id: string | null; data: string; valor_centavos: number },
  ocs: Ocorrencia[],
): Ocorrencia | null {
  if (!tx.conta_id) return null;
  let melhor: { oc: Ocorrencia; nota: number } | null = null;
  for (const oc of ocs) {
    const r = oc.recorrencia;
    if (r.conta_id !== tx.conta_id) continue;
    const sentido = r.tipo === "receita" ? 1 : -1;
    if (Math.sign(tx.valor_centavos) !== sentido) continue;
    const dif = Math.abs(Math.abs(tx.valor_centavos) - r.valor_centavos) / r.valor_centavos;
    const dias = Math.abs(ms(tx.data) - ms(oc.data)) / 86_400_000;
    if (dif > 0.1 || dias > 7) continue;
    const nota = dif * 10 + dias / 7;
    if (!melhor || nota < melhor.nota) melhor = { oc, nota };
  }
  return melhor?.oc ?? null;
}
