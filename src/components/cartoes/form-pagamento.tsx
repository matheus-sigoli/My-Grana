"use client";
import { useActionState } from "react";
import { pagarFatura } from "@/app/(app)/cartoes/actions";
import { BotaoEnviar } from "@/components/botao-enviar";
import { Erro } from "@/components/erro";
import { paraInput } from "@/lib/dinheiro";
import { ESTADO_INICIAL, type Conta } from "@/lib/tipos";

export function FormPagamento({ cartaoId, fatura, restante, contas, contaPadrao, hoje }: {
  cartaoId: string; fatura: string; restante: number; contas: Conta[]; contaPadrao: string | null; hoje: string;
}) {
  const [estado, acao] = useActionState(pagarFatura, ESTADO_INICIAL);
  const ativas = contas.filter((c) => !c.arquivada);
  return (
    <form action={acao} className="space-y-4">
      <input type="hidden" name="cartao_id" value={cartaoId} />
      <input type="hidden" name="fatura" value={fatura} />
      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <label className="rotulo" htmlFor="pg-valor">Valor (R$)</label>
          <input id="pg-valor" name="valor" inputMode="decimal" required autoComplete="off" defaultValue={paraInput(restante)} className="campo font-bold" />
        </div>
        <div>
          <label className="rotulo" htmlFor="pg-conta">Sai de</label>
          <select id="pg-conta" name="conta_id" defaultValue={contaPadrao ?? ativas[0]?.id} className="campo">
            {ativas.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
          </select>
        </div>
        <div>
          <label className="rotulo" htmlFor="pg-data">Data</label>
          <input id="pg-data" name="data" type="date" required defaultValue={hoje} className="campo" />
        </div>
      </div>
      <p className="dica">O pagamento tira o dinheiro da conta, mas não conta como despesa — as compras já foram contadas.</p>
      <Erro msg={estado.erro} />
      <BotaoEnviar>Registrar pagamento</BotaoEnviar>
    </form>
  );
}
