"use client";
import { useActionState } from "react";
import { entrar } from "../actions";
import { BotaoEnviar } from "@/components/botao-enviar";
import { Erro } from "@/components/erro";
import { ESTADO_INICIAL } from "@/lib/tipos";

export function FormEntrar() {
  const [estado, acao] = useActionState(entrar, ESTADO_INICIAL);
  return (
    <form action={acao} className="mt-8 space-y-5">
      <div>
        <label className="rotulo" htmlFor="email">E-mail</label>
        <input id="email" name="email" type="email" autoComplete="email" inputMode="email" spellCheck={false} required maxLength={254} className="campo" />
      </div>
      <div>
        <label className="rotulo" htmlFor="senha">Senha</label>
        <input id="senha" name="senha" type="password" autoComplete="current-password" required maxLength={128} className="campo" />
      </div>
      <Erro msg={estado.erro} />
      <BotaoEnviar className="btn w-full">Entrar</BotaoEnviar>
    </form>
  );
}
