"use client";
import { useActionState } from "react";
import { salvarConta } from "@/app/(app)/contas/actions";
import { BotaoEnviar } from "@/components/botao-enviar";
import { Erro } from "@/components/erro";
import { paraInput } from "@/lib/dinheiro";
import { ESTADO_INICIAL, NOME_TIPO_CONTA, type Conta, type TipoConta } from "@/lib/tipos";

const CORES: [string, string][] = [["#0e4d3a", "Verde"], ["#7c3aed", "Roxo"], ["#ea580c", "Laranja"], ["#2563eb", "Azul"], ["#db2777", "Rosa"], ["#ca8a04", "Mostarda"], ["#0891b2", "Turquesa"], ["#475569", "Cinza"]];

export function FormConta({ conta }: { conta?: Conta }) {
  const [estado, acao] = useActionState(salvarConta, ESTADO_INICIAL);
  return (
    <form action={acao} className="space-y-4">
      {conta && <input type="hidden" name="id" value={conta.id} />}
      <div>
        <label className="rotulo" htmlFor="nome">Nome</label>
        <input id="nome" name="nome" defaultValue={conta?.nome} placeholder="Ex.: Nubank" required maxLength={60} autoComplete="off" className="campo" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="rotulo" htmlFor="tipo">Tipo</label>
          <select id="tipo" name="tipo" defaultValue={conta?.tipo ?? "corrente"} className="campo">
            {(Object.keys(NOME_TIPO_CONTA) as TipoConta[]).map((t) => (
              <option key={t} value={t}>{NOME_TIPO_CONTA[t]}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="rotulo" htmlFor="saldo_inicial">Saldo inicial (R$)</label>
          <input
            id="saldo_inicial"
            name="saldo_inicial"
            inputMode="decimal"
            autoComplete="off"
            defaultValue={conta ? paraInput(conta.saldo_inicial_centavos) : ""}
            placeholder="0,00"
            className="campo"
          />
        </div>
      </div>
      <fieldset>
        <legend className="rotulo">Cor</legend>
        <div className="flex flex-wrap gap-2">
          {CORES.map(([c, nome], i) => (
            <label key={c} className="cursor-pointer" title={nome}>
              <input type="radio" name="cor" value={c} aria-label={nome} defaultChecked={conta ? conta.cor === c || (i === 0 && !CORES.some(([x]) => x === conta.cor)) : i === 0} className="peer sr-only" />
              <span className="block size-9 rounded-full ring-offset-2 peer-checked:ring-2 peer-checked:ring-tinta peer-focus-visible:outline-2 peer-focus-visible:outline-offset-4 peer-focus-visible:outline-marca" style={{ background: c }} aria-hidden="true" />
            </label>
          ))}
        </div>
      </fieldset>
      <Erro msg={estado.erro} />
      <BotaoEnviar>{conta ? "Salvar alterações" : "Criar conta"}</BotaoEnviar>
    </form>
  );
}
