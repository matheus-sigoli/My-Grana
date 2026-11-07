"use client";
import { useActionState, useState } from "react";
import { salvarAlocacao } from "@/app/(app)/investimentos/actions";
import { BotaoEnviar } from "@/components/botao-enviar";
import { Erro } from "@/components/erro";
import { paraNumero } from "@/lib/dinheiro";
import { GRUPOS, type Grupo } from "@/lib/investimentos/calculo";
import { NOME_GRUPO } from "@/lib/investimentos/rotulos";
import { ESTADO_INICIAL } from "@/lib/tipos";

export function FormAlocacao({ inicial }: { inicial: Partial<Record<Grupo, number>> }) {
  const [estado, acao] = useActionState(salvarAlocacao, ESTADO_INICIAL);
  const [valores, setValores] = useState<Record<Grupo, string>>(
    Object.fromEntries(GRUPOS.map((g) => [g, inicial[g] ? String(inicial[g]).replace(".", ",") : ""])) as Record<Grupo, string>,
  );
  const soma = GRUPOS.reduce((s, g) => s + (paraNumero(valores[g] || "0", 2) ?? 0), 0);
  const fechou = Math.abs(soma - 100) < 0.01;

  return (
    <form action={acao} className="space-y-4">
      <div className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
        {GRUPOS.map((g) => (
          <div key={g} className="flex items-center justify-between gap-3">
            <label htmlFor={`alvo_${g}`} className="text-[15px] font-semibold">{NOME_GRUPO[g]}</label>
            <div className="relative w-24 shrink-0">
              <input
                id={`alvo_${g}`}
                name={`alvo_${g}`}
                inputMode="decimal"
                autoComplete="off"
                value={valores[g]}
                onChange={(e) => setValores((v) => ({ ...v, [g]: e.target.value }))}
                placeholder="0"
                className="campo pr-7 text-right"
              />
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-suave" aria-hidden="true">%</span>
            </div>
          </div>
        ))}
      </div>
      <p aria-live="polite" className={`text-[15px] font-bold ${fechou ? "text-receita" : "text-despesa"}`}>
        Total: {soma.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%{fechou ? "" : " — precisa fechar 100%"}
      </p>
      <Erro msg={estado.erro} />
      <BotaoEnviar>Salvar meta</BotaoEnviar>
    </form>
  );
}
