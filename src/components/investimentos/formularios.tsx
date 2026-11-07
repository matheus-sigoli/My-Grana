"use client";
import { useActionState, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { editarAtivo, excluirItem, salvarAvaliacao, salvarOperacao, salvarProvento } from "@/app/(app)/investimentos/actions";
import { BotaoEnviar } from "@/components/botao-enviar";
import { Erro } from "@/components/erro";
import type { Ativo } from "@/lib/investimentos/calculo";
import { NOME_PROVENTO } from "@/lib/investimentos/rotulos";
import { ESTADO_INICIAL, type Conta } from "@/lib/tipos";
import { CamposOperacao } from "./campos-operacao";

export function FormOperacao({ ativo, contas, hoje }: { ativo: Ativo; contas: Conta[]; hoje: string }) {
  const [estado, acao] = useActionState(salvarOperacao, ESTADO_INICIAL);
  const rv = ["acao", "fii", "etf", "bdr", "cripto"].includes(ativo.classe);
  return (
    <form action={acao} className="space-y-4">
      <input type="hidden" name="ativo_id" value={ativo.id} />
      <CamposOperacao rv={rv} contas={contas} hoje={hoje} />
      <Erro msg={estado.erro} />
      <BotaoEnviar>Registrar operação</BotaoEnviar>
    </form>
  );
}

export function FormAvaliacao({ ativo, hoje }: { ativo: Ativo; hoje: string }) {
  const [estado, acao] = useActionState(salvarAvaliacao, ESTADO_INICIAL);
  return (
    <form action={acao} className="space-y-4">
      <input type="hidden" name="ativo_id" value={ativo.id} />
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="rotulo" htmlFor="av-valor">Valor no extrato (R$)</label>
          <input id="av-valor" name="valor" inputMode="decimal" autoComplete="off" required placeholder="10.532,18" className="campo" />
        </div>
        <div>
          <label className="rotulo" htmlFor="av-data">Na data</label>
          <input id="av-data" name="data" type="date" required defaultValue={hoje} min="2000-01-01" max="2100-12-31" className="campo" />
        </div>
      </div>
      <Erro msg={estado.erro} />
      <BotaoEnviar className="btn-sec">Atualizar valor</BotaoEnviar>
    </form>
  );
}

export function FormProvento({ ativo, contas, hoje }: { ativo: Ativo; contas: Conta[]; hoje: string }) {
  const [estado, acao] = useActionState(salvarProvento, ESTADO_INICIAL);
  const ordenadas = [...contas].filter((c) => !c.arquivada).sort((a, b) => Number(b.tipo === "corretora") - Number(a.tipo === "corretora"));
  const padrao = ativo.classe === "fii" ? "rendimento" : ativo.classe === "renda_fixa" ? "juros" : "dividendo";
  return (
    <form action={acao} className="space-y-4">
      <input type="hidden" name="ativo_id" value={ativo.id} />
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="rotulo" htmlFor="pv-tipo">Tipo</label>
          <select id="pv-tipo" name="tipo_provento" defaultValue={padrao} className="campo">
            {Object.entries(NOME_PROVENTO).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
        <div>
          <label className="rotulo" htmlFor="pv-valor">Valor líquido (R$)</label>
          <input id="pv-valor" name="valor" inputMode="decimal" autoComplete="off" required placeholder="42,10" className="campo" />
        </div>
        <div>
          <label className="rotulo" htmlFor="pv-conta">Caiu em</label>
          <select id="pv-conta" name="conta_id" defaultValue={ordenadas[0]?.id} className="campo">
            {ordenadas.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
          </select>
        </div>
        <div>
          <label className="rotulo" htmlFor="pv-data">Data</label>
          <input id="pv-data" name="data" type="date" required defaultValue={hoje} min="2000-01-01" max="2100-12-31" className="campo" />
        </div>
      </div>
      <p className="dica">Vira uma receita na categoria Investimentos e entra no saldo da conta.</p>
      <Erro msg={estado.erro} />
      <BotaoEnviar className="btn-sec">Registrar provento</BotaoEnviar>
    </form>
  );
}

export function FormEditarAtivo({ ativo }: { ativo: Ativo }) {
  const [estado, acao] = useActionState(editarAtivo, ESTADO_INICIAL);
  const rf = ativo.classe === "renda_fixa";
  return (
    <form action={acao} className="space-y-4">
      <input type="hidden" name="id" value={ativo.id} />
      <div>
        <label className="rotulo" htmlFor="ed-nome">Nome</label>
        <input id="ed-nome" name="nome" defaultValue={ativo.nome} required maxLength={80} className="campo" />
      </div>
      {rf && (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="rotulo" htmlFor="ed-taxa">Taxa</label>
              <input id="ed-taxa" name="taxa" inputMode="decimal" defaultValue={String(ativo.taxa ?? "").replace(".", ",")} className="campo" />
            </div>
            <div>
              <label className="rotulo" htmlFor="ed-venc">Vencimento</label>
              <input id="ed-venc" name="vencimento" type="date" defaultValue={ativo.vencimento ?? ""} className="campo" />
            </div>
          </div>
          <label className="flex cursor-pointer items-center gap-3 text-[15px]">
            <input type="checkbox" name="isento_ir" value="1" defaultChecked={ativo.isento_ir} className="size-4 accent-marca" />
            Isento de IR
          </label>
        </>
      )}
      <Erro msg={estado.erro} />
      <BotaoEnviar className="btn-sec">Salvar</BotaoEnviar>
    </form>
  );
}

/** Excluir item do histórico (operação, avaliação, provento) em dois cliques. */
export function ExcluirItem({ tabela, id, ativoId, rotulo }: { tabela: string; id: string; ativoId: string; rotulo: string }) {
  return (
    <form action={excluirItem}>
      <input type="hidden" name="tabela" value={tabela} />
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="ativo_id" value={ativoId} />
      <BotaoExcluirCurto rotulo={rotulo} />
    </form>
  );
}

function BotaoExcluirCurto({ rotulo }: { rotulo: string }) {
  const [armado, setArmado] = useState(false);
  const { pending } = useFormStatus();
  useEffect(() => {
    if (!armado) return;
    const t = setTimeout(() => setArmado(false), 4000);
    return () => clearTimeout(t);
  }, [armado]);
  return armado ? (
    <button type="submit" disabled={pending} className="min-h-9 rounded-full bg-despesa px-3 text-[13px] font-bold text-white">
      {pending ? "Excluindo…" : "Confirmar"}
    </button>
  ) : (
    <button type="button" onClick={() => setArmado(true)} aria-label={rotulo} className="min-h-9 rounded-full px-3 text-[13px] font-semibold text-suave hover:bg-despesa/10 hover:text-despesa">
      Excluir
    </button>
  );
}
