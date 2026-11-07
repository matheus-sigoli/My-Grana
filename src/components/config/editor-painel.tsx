"use client";
import { useState } from "react";
import { salvarPainel } from "@/app/(app)/configuracoes/actions";
import { BotaoEnviar } from "@/components/botao-enviar";
import { BLOCOS, BLOCOS_PADRAO, type Bloco } from "@/lib/blocos";

/** Mostrar/esconder e reordenar os blocos do painel. Só os visíveis, na ordem, vão para o servidor. */
export function EditorPainel({ atuais }: { atuais: Bloco[] }) {
  const [itens, setItens] = useState(() => [
    ...atuais.map((id) => ({ id, visivel: true })),
    ...BLOCOS_PADRAO.filter((b) => !atuais.includes(b)).map((id) => ({ id, visivel: false })),
  ]);
  const mover = (i: number, d: -1 | 1) =>
    setItens((xs) => {
      const j = i + d;
      if (j < 0 || j >= xs.length) return xs;
      const c = [...xs];
      [c[i], c[j]] = [c[j], c[i]];
      return c;
    });
  const alternar = (i: number) => setItens((xs) => xs.map((x, k) => (k === i ? { ...x, visivel: !x.visivel } : x)));

  return (
    <form action={salvarPainel} className="space-y-3">
      {itens.filter((x) => x.visivel).map((x) => <input key={x.id} type="hidden" name="bloco" value={x.id} />)}
      <p className="text-[13px] text-suave">O saldo fica sempre no topo. Escolha o que aparece abaixo dele e em que ordem.</p>
      <ul className="divide-y divide-linha rounded-xl border border-linha">
        {itens.map((x, i) => (
          <li key={x.id} className="flex items-center gap-2 px-3 py-2">
            <label className="flex min-h-10 flex-1 items-center gap-3 text-[15px]">
              <input type="checkbox" checked={x.visivel} onChange={() => alternar(i)} className="size-5 accent-marca" />
              <span className={x.visivel ? "font-semibold" : "text-suave"}>{BLOCOS[x.id]}</span>
            </label>
            <button type="button" onClick={() => mover(i, -1)} disabled={i === 0} aria-label={`Subir ${BLOCOS[x.id]}`} className="grid size-9 place-items-center rounded-full text-suave hover:bg-fundo disabled:opacity-30">↑</button>
            <button type="button" onClick={() => mover(i, 1)} disabled={i === itens.length - 1} aria-label={`Descer ${BLOCOS[x.id]}`} className="grid size-9 place-items-center rounded-full text-suave hover:bg-fundo disabled:opacity-30">↓</button>
          </li>
        ))}
      </ul>
      <div className="flex justify-end"><BotaoEnviar>Salvar painel</BotaoEnviar></div>
    </form>
  );
}
