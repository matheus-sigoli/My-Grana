"use client";
import { useActionState } from "react";
import { excluirConta } from "@/app/(app)/configuracoes/actions";
import { Erro } from "@/components/erro";
import { ESTADO_INICIAL } from "@/lib/tipos";
import { useFormStatus } from "react-dom";

function Botao() {
  const { pending } = useFormStatus();
  return <button className="inline-flex min-h-11 items-center justify-center rounded-full bg-despesa px-5 text-[15px] font-bold text-white disabled:opacity-60" disabled={pending}>{pending ? "Excluindo…" : "Excluir minha conta"}</button>;
}

export function ExcluirConta() {
  const [estado, acao] = useActionState(excluirConta, ESTADO_INICIAL);
  return (
    <form action={acao} className="space-y-3">
      <p className="text-[15px] text-suave">Apaga para sempre contas, lançamentos, cartões, investimentos, metas e conexões com bancos. Não dá para desfazer — exporte seus dados antes.</p>
      <div>
        <label htmlFor="confirmacao" className="rotulo">Digite EXCLUIR para confirmar</label>
        <input id="confirmacao" name="confirmacao" autoComplete="off" required className="campo w-48" />
      </div>
      <Erro msg={estado.erro} />
      <Botao />
    </form>
  );
}
