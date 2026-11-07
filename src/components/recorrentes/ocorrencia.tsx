"use client";
import { useActionState, useState } from "react";
import { confirmarOcorrencia, pularOcorrencia } from "@/app/(app)/recorrentes/actions";
import { BotaoEnviar } from "@/components/botao-enviar";
import { Erro } from "@/components/erro";
import { brl, paraInput } from "@/lib/dinheiro";
import { ESTADO_INICIAL } from "@/lib/tipos";

const DATA = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", timeZone: "UTC" });

export function LinhaOcorrencia({
  recorrenciaId, data, descricao, valor, tipo, atrasada, contaNome, hoje, rv = false, voltar,
}: {
  recorrenciaId: string; data: string; descricao: string; valor: number; tipo: string; atrasada: boolean;
  contaNome: string; hoje: string; rv?: boolean; voltar?: "painel";
}) {
  const [aberto, setAberto] = useState(false);
  const [estado, acao] = useActionState(confirmarOcorrencia, ESTADO_INICIAL);
  const sinal = tipo === "receita" ? "+" : tipo === "transferencia" ? "" : "−";
  const rotuloTipo = { despesa: "a pagar", receita: "a receber", transferencia: "transferência", aporte: "aporte" }[tipo] ?? tipo;

  return (
    <li className="px-4 py-3 sm:px-5">
      <div className="flex items-center gap-3">
        <span className={`w-14 shrink-0 text-center text-[13px] font-bold ${atrasada ? "text-despesa" : "text-suave"}`}>
          {DATA.format(new Date(`${data}T00:00:00Z`)).replace(".", "")}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-semibold">{descricao}</p>
          <p className="truncate text-[13px] text-suave">{atrasada ? <strong className="text-despesa">atrasado · </strong> : null}{rotuloTipo} · {contaNome}</p>
        </div>
        <p className={`whitespace-nowrap text-[15px] font-bold ${tipo === "receita" ? "text-receita" : ""}`}>{sinal} {brl(valor)}</p>
        <button type="button" onClick={() => setAberto((a) => !a)} aria-expanded={aberto} className="btn-sec min-h-9 px-3 text-sm">
          {aberto ? "Fechar" : "Confirmar"}
        </button>
      </div>
      {aberto && (
        <div className="mt-3 rounded-xl bg-fundo p-3">
          <form action={acao} className="grid items-end gap-3 sm:grid-cols-[1fr_1fr_auto]">
            <input type="hidden" name="recorrencia_id" value={recorrenciaId} />
            <input type="hidden" name="data_ocorrencia" value={data} />
            {voltar && <input type="hidden" name="voltar" value={voltar} />}
            {rv ? (
              <>
                <div>
                  <label className="rotulo" htmlFor={`q-${recorrenciaId}-${data}`}>Quantidade</label>
                  <input id={`q-${recorrenciaId}-${data}`} name="quantidade" inputMode="decimal" required autoComplete="off" className="campo" />
                </div>
                <div>
                  <label className="rotulo" htmlFor={`p-${recorrenciaId}-${data}`}>Preço (R$)</label>
                  <input id={`p-${recorrenciaId}-${data}`} name="preco" inputMode="decimal" required autoComplete="off" className="campo" />
                  <input type="hidden" name="valor" value={paraInput(valor)} />
                </div>
              </>
            ) : (
              <div>
                <label className="rotulo" htmlFor={`v-${recorrenciaId}-${data}`}>Valor (R$)</label>
                <input id={`v-${recorrenciaId}-${data}`} name="valor" inputMode="decimal" required autoComplete="off" defaultValue={paraInput(valor)} className="campo" />
              </div>
            )}
            <div>
              <label className="rotulo" htmlFor={`d-${recorrenciaId}-${data}`}>Data</label>
              <input id={`d-${recorrenciaId}-${data}`} name="data" type="date" required defaultValue={data > hoje ? hoje : data} className="campo" />
            </div>
            <BotaoEnviar>Confirmar</BotaoEnviar>
          </form>
          <Erro msg={estado.erro} />
          <form action={pularOcorrencia} className="mt-2">
            <input type="hidden" name="recorrencia_id" value={recorrenciaId} />
            <input type="hidden" name="data_ocorrencia" value={data} />
            {voltar && <input type="hidden" name="voltar" value={voltar} />}
            <button className="text-[13px] font-semibold text-suave underline-offset-4 hover:underline">Pular esta (não aconteceu)</button>
          </form>
        </div>
      )}
    </li>
  );
}
