/** "MATHEUS SIGOLI" / "matheus" → "Matheus" (primeiro nome, capitalizado para exibição). */
export function primeiroNome(nome: string | null | undefined) {
  const p = (nome ?? "").trim().split(/\s+/)[0] ?? "";
  if (!p) return "";
  return p.charAt(0).toLocaleUpperCase("pt-BR") + p.slice(1).toLocaleLowerCase("pt-BR");
}
