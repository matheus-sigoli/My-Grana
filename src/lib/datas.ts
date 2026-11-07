const MESES = ["janeiro","fevereiro","março","abril","maio","junho","julho","agosto","setembro","outubro","novembro","dezembro"];

/** Hoje em America/Sao_Paulo no formato YYYY-MM-DD */
export function hojeISO() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
}

/** Valida/normaliza "YYYY-MM"; cai no mês atual se inválido. */
export function mesOuAtual(mes?: string | null) {
  if (mes && /^\d{4}-(0[1-9]|1[0-2])$/.test(mes)) return mes;
  return hojeISO().slice(0, 7);
}

export function deslocaMes(mes: string, delta: number) {
  const [a, m] = mes.split("-").map(Number);
  const d = new Date(Date.UTC(a, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** Intervalo [inicio, fim) do mês em datas ISO */
export function intervaloMes(mes: string) {
  return { inicio: `${mes}-01`, fim: `${deslocaMes(mes, 1)}-01` };
}

export function nomeMes(mes: string) {
  const [a, m] = mes.split("-").map(Number);
  return `${MESES[m - 1]} de ${a}`;
}

/** "2026-11-04" → "04/11" */
export function diaMes(iso: string) {
  const [, m, d] = iso.split("-");
  return `${d}/${m}`;
}
