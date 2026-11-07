/**
 * ADR-0012: pagamento de fatura vindo do extrato da conta, e chave das regras de recebedor. Puro.
 */
import { datasDaFatura, type Cartao } from "./cartoes";

const semAcento = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

// "GASTOS CARTAO DE CREDITO" (Bradesco), "PAGTO FATURA", "PAGAMENTO DE FATURA", "FATURA CARTAO", "PAG CARTAO CREDITO"…
const RE_PAGAMENTO_FATURA = /(gastos? (com )?cartao de credito|pag(to|amento)?\.? (de |da )?fatura|fatura (do |de )?cartao|(pagto|pagamento|pag)\.? (do |de )?cartao)/;

export function ehPagamentoFatura(descricao: string, valorCentavos: number) {
  return valorCentavos < 0 && RE_PAGAMENTO_FATURA.test(semAcento(descricao).replace(/\s+/g, " "));
}

export type CandidataFatura = { cartaoId: string; cartao: string; fatura: string; vencimento: string; dias: number; restanteCentavos: number };

const ms = (iso: string) => Date.parse(`${iso}T00:00:00Z`);

/**
 * Faturas que esse pagamento provavelmente quita: cartões pagos pela conta (se nenhum, todos os ativos),
 * vencimento a até 10 dias da data. Ordem: mais perto da data; empate → saldo em aberto mais perto do valor.
 */
export function faturasCandidatas(
  p: { contaId: string | null; data: string; valorCentavos: number },
  cartoes: Pick<Cartao, "id" | "nome" | "dia_fechamento" | "dia_vencimento" | "conta_pagamento_id" | "arquivado">[],
  restante: (cartaoId: string, fatura: string) => number = () => 0,
): CandidataFatura[] {
  const ativos = cartoes.filter((c) => !c.arquivado);
  const daConta = ativos.filter((c) => c.conta_pagamento_id && c.conta_pagamento_id === p.contaId);
  const base = daConta.length ? daConta : ativos;
  const [a, m] = p.data.split("-").map(Number);
  const valor = Math.abs(p.valorCentavos);
  const out: CandidataFatura[] = [];
  for (const c of base) {
    for (const d of [-1, 0, 1]) {
      const dt = new Date(Date.UTC(a, m - 1 + d, 1));
      const fatura = dt.toISOString().slice(0, 10);
      const { vencimento } = datasDaFatura(c, fatura);
      const dias = Math.round(Math.abs(ms(vencimento) - ms(p.data)) / 86_400_000);
      if (dias <= 10) out.push({ cartaoId: c.id, cartao: c.nome, fatura, vencimento, dias, restanteCentavos: restante(c.id, fatura) });
    }
  }
  return out.sort((x, y) => x.dias - y.dias || Math.abs(x.restanteCentavos - valor) - Math.abs(y.restanteCentavos - valor));
}

/** Chave da regra de recebedor: sem acento, minúsculo, sem pontuação e sem CPF/CNPJ mascarado. */
export const chaveRecebedor = (nome: string) =>
  semAcento(nome).replace(/[*•]+/g, " ").replace(/\d{3}\.\d{3}\.\d{3}-\d{2}|\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}/g, " ").replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim().slice(0, 120);
