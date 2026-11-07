const fmt = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

/** 123456 → "R$ 1.234,56" */
export function brl(centavos: number) {
  return fmt.format(centavos / 100);
}

/** "1.234,56" | "1234,56" | "1234.56" | "R$ 50" → centavos (inteiro) ou null se inválido. */
export function paraCentavos(texto: string | null | undefined): number | null {
  if (!texto) return null;
  let s = String(texto).replace(/R\$|\s/g, "").trim();
  if (!s) return null;
  const negativo = s.startsWith("-");
  s = s.replace(/^-/, "");
  if (s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
  if (!/^\d+(\.\d{1,2})?$/.test(s)) return null;
  const v = Math.round(parseFloat(s) * 100);
  return negativo ? -v : v;
}

/** centavos → "1234,56" (para preencher input) */
export function paraInput(centavos: number) {
  return (centavos / 100).toFixed(2).replace(".", ",");
}

/** "1.234,5678" | "0,00012" | "10" → número (até `casas` decimais) ou null. Para quantidades e taxas. */
export function paraNumero(texto: string | null | undefined, casas = 8): number | null {
  if (!texto) return null;
  let s = String(texto).replace(/\s|%/g, "").trim();
  if (!s) return null;
  if (s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
  if (!new RegExp(`^-?\\d+(\\.\\d{1,${casas}})?$`).test(s)) return null;
  const v = Number(s);
  return Number.isFinite(v) ? v : null;
}
