"use client";
import { useActionState } from "react";
import { salvarCartao } from "@/app/(app)/cartoes/actions";
import { BotaoEnviar } from "@/components/botao-enviar";
import { Erro } from "@/components/erro";
import type { Cartao } from "@/lib/cartoes";
import { paraInput } from "@/lib/dinheiro";
import { ESTADO_INICIAL, type Conta } from "@/lib/tipos";

const CORES: [string, string][] = [["#820ad1", "Roxo"], ["#ec7000", "Laranja"], ["#cc092f", "Vermelho"], ["#0f1b17", "Preto"], ["#0e4d3a", "Verde"], ["#2563eb", "Azul"], ["#ca8a04", "Dourado"], ["#64748b", "Cinza"]];

export function FormCartao({ cartao, contas }: { cartao?: Cartao; contas: Conta[] }) {
  const [estado, acao] = useActionState(salvarCartao, ESTADO_INICIAL);
  const ativas = contas.filter((c) => !c.arquivada || c.id === cartao?.conta_pagamento_id);
  return (
    <form action={acao} className="space-y-4">
      {cartao && <input type="hidden" name="id" value={cartao.id} />}
      <div className="grid gap-4">
        <div>
          <label className="rotulo" htmlFor="nome">Nome</label>
          <input id="nome" name="nome" required maxLength={60} defaultValue={cartao?.nome} autoComplete="off" placeholder="Nubank" className="campo" />
        </div>
        <div>
          <label className="rotulo" htmlFor="limite">Limite (R$)</label>
          <input id="limite" name="limite" inputMode="decimal" autoComplete="off" defaultValue={cartao ? paraInput(cartao.limite_centavos) : ""} placeholder="5.000,00" className="campo" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="rotulo" htmlFor="dia_fechamento">Fecha no dia</label>
          <input id="dia_fechamento" name="dia_fechamento" type="number" min={1} max={31} required defaultValue={cartao?.dia_fechamento} placeholder="25" className="campo" />
        </div>
        <div>
          <label className="rotulo" htmlFor="dia_vencimento">Vence no dia</label>
          <input id="dia_vencimento" name="dia_vencimento" type="number" min={1} max={31} required defaultValue={cartao?.dia_vencimento} placeholder="5" className="campo" />
        </div>
        <div className="col-span-2">
          <label className="rotulo" htmlFor="conta_pagamento_id">Fatura paga com</label>
          <select id="conta_pagamento_id" name="conta_pagamento_id" defaultValue={cartao?.conta_pagamento_id ?? ativas[0]?.id ?? ""} className="campo">
            <option value="">Escolher na hora</option>
            {ativas.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
          </select>
        </div>
      </div>
      <p className="dica">Compras feitas a partir do dia do fechamento entram na fatura seguinte.</p>
      <fieldset>
        <legend className="rotulo">Cor</legend>
        <div className="flex flex-wrap gap-2">
          {CORES.map(([c, nome], i) => (
            <label key={c} className="cursor-pointer" title={nome}>
              <input type="radio" name="cor" value={c} aria-label={nome} defaultChecked={cartao ? cartao.cor === c || (i === 0 && !CORES.some(([x]) => x === cartao.cor)) : i === 0} className="peer sr-only" />
              <span className="block size-9 rounded-full ring-offset-2 peer-checked:ring-2 peer-checked:ring-tinta peer-focus-visible:outline-2 peer-focus-visible:outline-offset-4 peer-focus-visible:outline-marca" style={{ background: c }} aria-hidden="true" />
            </label>
          ))}
        </div>
      </fieldset>
      <Erro msg={estado.erro} />
      <BotaoEnviar>{cartao ? "Salvar" : "Adicionar cartão"}</BotaoEnviar>
    </form>
  );
}
