"use client";
import { useActionState, useState } from "react";
import { salvarMeta } from "@/app/(app)/metas/actions";
import { BotaoEnviar } from "@/components/botao-enviar";
import { Erro } from "@/components/erro";
import { paraInput } from "@/lib/dinheiro";
import { NOME_TIPO_META, type Meta, type TipoMeta } from "@/lib/planejamento";
import { ESTADO_INICIAL, type Conta } from "@/lib/tipos";

const DICA: Record<TipoMeta, string> = {
  economia: "O progresso é o saldo da conta escolhida. Guardar para a meta = transferir para essa conta.",
  patrimonio: "O progresso é seu patrimônio líquido: contas + investimentos − cartões.",
  renda_passiva: "O progresso é a média mensal de proventos dos últimos 12 meses.",
};

export function FormMeta({ contas, meta }: { contas: Conta[]; meta?: Meta }) {
  const [estado, acao] = useActionState(salvarMeta, ESTADO_INICIAL);
  const [tipo, setTipo] = useState<TipoMeta>(meta?.tipo ?? "economia");
  const ativas = contas.filter((c) => !c.arquivada || c.id === meta?.conta_id);
  const sugerida = ativas.find((c) => c.tipo === "poupanca") ?? ativas[0];

  return (
    <form action={acao} className="space-y-4">
      {meta && <input type="hidden" name="id" value={meta.id} />}
      <div>
        <label className="rotulo" htmlFor="tipo">Tipo</label>
        <select id="tipo" name="tipo" value={tipo} onChange={(e) => setTipo(e.target.value as TipoMeta)} className="campo">
          {(Object.keys(NOME_TIPO_META) as TipoMeta[]).map((t) => <option key={t} value={t}>{NOME_TIPO_META[t]}</option>)}
        </select>
        <p className="dica">{DICA[tipo]}</p>
      </div>
      <div>
        <label className="rotulo" htmlFor="nome">Nome</label>
        <input id="nome" name="nome" required maxLength={80} defaultValue={meta?.nome} autoComplete="off" className="campo"
          placeholder={tipo === "economia" ? "Viagem para o Nordeste" : tipo === "patrimonio" ? "Primeiro R$ 100 mil" : "Viver de dividendos"} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="rotulo" htmlFor="alvo">{tipo === "renda_passiva" ? "Renda por mês (R$)" : "Valor-alvo (R$)"}</label>
          <input id="alvo" name="alvo" inputMode="decimal" required autoComplete="off" className="campo"
            defaultValue={meta ? paraInput(meta.valor_alvo_centavos) : ""} placeholder={tipo === "renda_passiva" ? "3.000,00" : "5.000,00"} />
        </div>
        <div>
          <label className="rotulo" htmlFor="prazo">Prazo (opcional)</label>
          <input id="prazo" name="prazo" type="date" defaultValue={meta?.prazo ?? ""} className="campo" />
        </div>
      </div>
      {tipo === "economia" && (
        <div>
          <label className="rotulo" htmlFor="conta_id">Conta da meta</label>
          <select id="conta_id" name="conta_id" required defaultValue={meta?.conta_id ?? sugerida?.id ?? ""} className="campo">
            {ativas.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
          </select>
          <p className="dica">Use uma caixinha ou poupança separada do dia a dia.</p>
        </div>
      )}
      <Erro msg={estado.erro} />
      <BotaoEnviar className="btn w-full">{meta ? "Salvar meta" : "Criar meta"}</BotaoEnviar>
    </form>
  );
}
