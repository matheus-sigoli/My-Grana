import { brl } from "@/lib/dinheiro";

/** 0,1234 → "12,3%" */
export const pct = (fracao: number, casas = 1) =>
  `${(fracao * 100).toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas })}%`;

/** Quantidade com até 8 casas, sem zeros sobrando. */
export const qtd = (n: number) => n.toLocaleString("pt-BR", { maximumFractionDigits: 8 });

/** Preço em reais com até 8 casas (cripto) e no mínimo 2. */
export const preco = (reais: number) =>
  reais.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2, maximumFractionDigits: reais < 1 ? 8 : 2 });

export const sinal = (centavos: number) => `${centavos > 0 ? "+" : centavos < 0 ? "−" : ""}${brl(Math.abs(centavos))}`;

const DATA = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" });
export const dataCurta = (iso: string) => DATA.format(new Date(`${iso}T00:00:00Z`)).replace(/ de /g, " ").replace(".", "");
