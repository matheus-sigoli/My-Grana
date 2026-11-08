"use client";
import { useActionState, useId } from "react";
import { useFormStatus } from "react-dom";
import { apagarDados, excluirConta } from "@/app/(app)/configuracoes/actions";
import { Erro } from "@/components/erro";
import { ESTADO_INICIAL, type EstadoForm } from "@/lib/tipos";

function Botao({ texto, carregando, forte }: { texto: string; carregando: string; forte?: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      disabled={pending}
      className={`inline-flex min-h-11 items-center justify-center rounded-full px-5 text-[15px] font-bold disabled:opacity-60 ${forte ? "bg-despesa text-white" : "border border-despesa text-despesa hover:bg-despesa/10"}`}
    >
      {pending ? carregando : texto}
    </button>
  );
}

type Acao = (e: EstadoForm, fd: FormData) => Promise<EstadoForm>;

function FormConfirmacao({ acao, palavra, titulo, descricao, botao, carregando, forte }: {
  acao: Acao; palavra: string; titulo: string; descricao: string; botao: string; carregando: string; forte?: boolean;
}) {
  const [estado, enviar] = useActionState(acao, ESTADO_INICIAL);
  const id = useId();
  return (
    <form action={enviar} className="space-y-3">
      <h3 className="font-semibold text-despesa">{titulo}</h3>
      <p className="text-[15px] text-suave">{descricao}</p>
      <div>
        <label htmlFor={id} className="rotulo">Digite {palavra} para confirmar</label>
        <input id={id} name="confirmacao" autoComplete="off" required className="campo w-48" />
      </div>
      <Erro msg={estado.erro} />
      <Botao texto={botao} carregando={carregando} forte={forte} />
    </form>
  );
}

export function ExcluirConta() {
  return (
    <div className="space-y-6">
      <FormConfirmacao
        acao={apagarDados}
        palavra="APAGAR"
        titulo="Apagar minhas informações"
        descricao="Zera contas, lançamentos, cartões, faturas, investimentos, metas, contas fixas, importações e conexões com bancos. Sua conta e seu login continuam, e as categorias padrão voltam. Não dá para desfazer — exporte antes."
        botao="Apagar minhas informações"
        carregando="Apagando…"
      />
      <div className="border-t border-linha pt-5">
        <FormConfirmacao
          acao={excluirConta}
          palavra="EXCLUIR"
          titulo="Excluir conta"
          descricao="Apaga todas as informações e também o seu login. Para usar o MyGrana de novo, será preciso criar outra conta. Não dá para desfazer."
          botao="Excluir minha conta"
          carregando="Excluindo…"
          forte
        />
      </div>
    </div>
  );
}
