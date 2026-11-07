"use client";
import { useActionState } from "react";
import { importarArquivo } from "@/app/(app)/importar/actions";
import { BotaoEnviar } from "@/components/botao-enviar";
import { Erro } from "@/components/erro";
import { ESTADO_INICIAL } from "@/lib/tipos";

export function FormImportar({ contas, cartoes }: { contas: { id: string; nome: string }[]; cartoes: { id: string; nome: string }[] }) {
  const [estado, acao] = useActionState(importarArquivo, ESTADO_INICIAL);
  return (
    <form action={acao} className="space-y-4">
      <div>
        <label className="rotulo" htmlFor="destino">De qual conta ou cartão é o extrato?</label>
        <select id="destino" name="destino" required defaultValue="" className="campo">
          <option value="" disabled>Escolha…</option>
          <optgroup label="Contas">{contas.map((c) => <option key={c.id} value={`conta:${c.id}`}>{c.nome}</option>)}</optgroup>
          {cartoes.length > 0 && <optgroup label="Faturas de cartão">{cartoes.map((c) => <option key={c.id} value={`cartao:${c.id}`}>{c.nome}</option>)}</optgroup>}
        </select>
      </div>
      <div>
        <label className="rotulo" htmlFor="arquivo">Arquivo (.ofx ou .csv, até 2 MB)</label>
        <input id="arquivo" name="arquivo" type="file" required accept=".ofx,.qfx,.csv,.txt,text/csv,application/x-ofx"
          className="campo py-2.5 file:mr-3 file:rounded-full file:border-0 file:bg-fundo file:px-3 file:py-1.5 file:font-semibold file:text-tinta" />
        <p className="dica">No app do banco, procure “Exportar extrato” e escolha OFX (melhor) ou CSV.</p>
      </div>
      <Erro msg={estado.erro} />
      <BotaoEnviar className="btn w-full" enviando="Lendo o extrato…">Ler extrato</BotaoEnviar>
    </form>
  );
}
