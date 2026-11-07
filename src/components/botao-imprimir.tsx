"use client";

/** Abre a impressão do navegador; "Salvar como PDF" gera o arquivo (o layout de impressão esconde menus). */
export function BotaoImprimir({ children = "Imprimir / PDF" }: { children?: React.ReactNode }) {
  return (
    <button type="button" onClick={() => window.print()} className="btn-sec no-print">
      {children}
    </button>
  );
}
