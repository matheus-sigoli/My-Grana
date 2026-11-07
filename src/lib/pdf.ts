import "server-only";

/**
 * Texto de um PDF de extrato, linha por linha, na ordem em que aparece na página.
 * Usa o unpdf (PDF.js para servidor), carregado só quando alguém importa um PDF.
 * Segurança: sem eval de fontes, sem fontes do sistema, limite de páginas e de tempo.
 */
export class PdfComSenha extends Error {}
export class PdfSemTexto extends Error {}

const MAX_PAGINAS = 40;
const LIMITE_MS = 15_000;

type Item = { str?: string; transform?: number[]; width?: number };

export async function linhasDoPdf(bytes: Uint8Array): Promise<string[]> {
  const { getDocumentProxy } = await import("unpdf");
  const tarefa = (async () => {
    let pdf;
    try {
      pdf = await getDocumentProxy(bytes, { isEvalSupported: false, useSystemFonts: false, disableFontFace: true, stopAtErrors: false });
    } catch (e) {
      if ((e as { name?: string })?.name === "PasswordException") throw new PdfComSenha();
      throw e;
    }
    const linhas: string[] = [];
    const paginas = Math.min(pdf.numPages, MAX_PAGINAS);
    for (let n = 1; n <= paginas; n++) {
      const pagina = await pdf.getPage(n);
      const conteudo = await pagina.getTextContent();
      // Agrupa os pedaços de texto pela altura (y) e ordena por x: reconstrói as linhas da tabela.
      const porLinha = new Map<number, { x: number; fim: number; s: string }[]>();
      for (const it of conteudo.items as unknown as Item[]) {
        if (!it.str || !it.transform) continue;
        const x = it.transform[4], y = it.transform[5];
        const chave = [...porLinha.keys()].find((k) => Math.abs(k - y) <= 2.5) ?? y;
        porLinha.set(chave, [...(porLinha.get(chave) ?? []), { x, fim: x + (it.width ?? 0), s: it.str }]);
      }
      for (const y of [...porLinha.keys()].sort((a, b) => b - a)) {
        const partes = porLinha.get(y)!.sort((a, b) => a.x - b.x);
        let texto = "", fimAnterior = -Infinity;
        for (const p of partes) {
          texto += (texto && p.x - fimAnterior > 1.5 ? " " : "") + p.s;
          fimAnterior = p.fim;
        }
        if (texto.trim()) linhas.push(texto.trim());
      }
    }
    await pdf.destroy?.();
    if (linhas.join("").replace(/\s/g, "").length < 20) throw new PdfSemTexto();
    return linhas;
  })();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const tempo = new Promise<never>((_, rej) => { timer = setTimeout(() => rej(new Error("tempo")), LIMITE_MS); });
  try {
    return await Promise.race([tarefa, tempo]);
  } finally {
    clearTimeout(timer);
  }
}
