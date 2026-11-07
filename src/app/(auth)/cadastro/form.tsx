"use client";
import { useActionState } from "react";
import { cadastrar } from "../actions";
import { BotaoEnviar } from "@/components/botao-enviar";
import { Erro } from "@/components/erro";

export function FormCadastro() {
  const [estado, acao] = useActionState(cadastrar, { erro: null as string | null, ok: false as boolean | undefined });
  if (estado.ok) {
    return (
      <div role="status" className="mt-8 rounded-2xl bg-marca-clara p-5 text-[15px] text-marca">
        <p className="font-semibold">Quase lá!</p>
        <p className="mt-1">Se o e-mail ainda não tiver conta, enviamos um link de confirmação. Abra-o neste mesmo navegador para ativar.</p>
      </div>
    );
  }
  return (
    <form action={acao} className="mt-8 space-y-5">
      <div>
        <label className="rotulo" htmlFor="nome">Como podemos te chamar?</label>
        <input id="nome" name="nome" autoComplete="given-name" maxLength={60} className="campo" />
      </div>
      <div>
        <label className="rotulo" htmlFor="email">E-mail</label>
        <input id="email" name="email" type="email" autoComplete="email" inputMode="email" spellCheck={false} required maxLength={254} className="campo" />
      </div>
      <div>
        <label className="rotulo" htmlFor="senha">Senha (mínimo 8 caracteres)</label>
        <input id="senha" name="senha" type="password" autoComplete="new-password" minLength={8} maxLength={128} required aria-describedby="senha-dica" className="campo" />
        <p id="senha-dica" className="dica">Use uma frase ou combinação que você não usa em outro site.</p>
      </div>
      <Erro msg={estado.erro} />
      <BotaoEnviar className="btn w-full">Criar conta</BotaoEnviar>
    </form>
  );
}
