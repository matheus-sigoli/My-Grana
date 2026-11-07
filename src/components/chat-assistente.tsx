"use client";
import { useActionState, useState } from "react";
import { perguntar, type EstadoIa } from "@/app/(app)/assistente/actions";
import { BotaoEnviar } from "@/components/botao-enviar";
import { Erro } from "@/components/erro";

const INICIAL: EstadoIa = { pergunta: null, resposta: null, erro: null, restantes: null };
const SUGESTOES = [
  "Onde estou gastando mais do que deveria?",
  "Quanto consigo guardar por mês no ritmo atual?",
  "Meu orçamento deste mês vai fechar no azul?",
  "Como está a diversificação dos meus investimentos?",
];

export function ChatAssistente({ restantesIniciais }: { restantesIniciais: number }) {
  const [estado, acao] = useActionState(perguntar, INICIAL);
  const [texto, setTexto] = useState("");
  const restantes = estado.restantes ?? restantesIniciais;

  return (
    <div className="space-y-4">
      <form action={acao} className="space-y-3">
        <label htmlFor="pergunta" className="rotulo">Sua pergunta</label>
        <textarea id="pergunta" name="pergunta" required minLength={3} maxLength={500} rows={3} value={texto} onChange={(e) => setTexto(e.target.value)}
          placeholder="Ex.: dá para eu tirar férias de R$ 4.000 em julho?" className="campo min-h-24 resize-y py-3" />
        <div className="flex flex-wrap gap-2">
          {SUGESTOES.map((s) => (
            <button key={s} type="button" onClick={() => setTexto(s)} className="rounded-full bg-fundo px-3 py-1.5 text-[13px] font-semibold text-suave hover:text-tinta">{s}</button>
          ))}
        </div>
        <div className="flex items-center justify-between gap-3">
          <span className="text-[13px] text-suave">{restantes} {restantes === 1 ? "pergunta restante" : "perguntas restantes"} hoje</span>
          <BotaoEnviar enviando="Pensando…">Perguntar</BotaoEnviar>
        </div>
      </form>
      <Erro msg={estado.erro} />
      {estado.resposta && (
        <article aria-live="polite" className="rounded-2xl bg-fundo p-5">
          <p className="mb-2 text-[13px] font-semibold text-suave">Você perguntou: {estado.pergunta}</p>
          {/* Texto puro (sem HTML): a resposta nunca é interpretada como código. */}
          <div className="whitespace-pre-wrap text-[15px] leading-relaxed">{estado.resposta}</div>
          <p className="mt-4 text-[12px] text-suave">Resposta gerada por IA a partir dos seus dados. Pode conter erros; confira os números antes de decidir.</p>
        </article>
      )}
    </div>
  );
}
