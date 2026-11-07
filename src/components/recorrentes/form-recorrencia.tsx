"use client";
import { useActionState, useState } from "react";
import { salvarRecorrencia } from "@/app/(app)/recorrentes/actions";
import { BotaoEnviar } from "@/components/botao-enviar";
import { Erro } from "@/components/erro";
import { agrupar } from "@/lib/categorias";
import { paraInput } from "@/lib/dinheiro";
import type { Cartao } from "@/lib/cartoes";
import type { Recorrencia, TipoRecorrencia } from "@/lib/recorrencias";
import { ESTADO_INICIAL, type Categoria, type Conta } from "@/lib/tipos";

const ABAS: { t: TipoRecorrencia; rotulo: string; cor: string }[] = [
  { t: "despesa", rotulo: "Conta a pagar", cor: "bg-despesa" },
  { t: "receita", rotulo: "A receber", cor: "bg-receita" },
  { t: "transferencia", rotulo: "Transferência", cor: "bg-transf" },
  { t: "aporte", rotulo: "Aporte", cor: "bg-marca" },
];

export function FormRecorrencia({
  contas, categorias, ativos, hoje, regra, tipoInicial, ativoInicial, proxima, cartoes = [],
}: {
  contas: Conta[];
  categorias: Categoria[];
  ativos: { id: string; nome: string; ticker: string | null }[];
  hoje: string;
  regra?: Recorrencia;
  tipoInicial?: TipoRecorrencia;
  ativoInicial?: string;
  proxima?: string;
  cartoes?: Cartao[];
}) {
  const [estado, acao] = useActionState(salvarRecorrencia, ESTADO_INICIAL);
  const [tipo, setTipo] = useState<TipoRecorrencia>(regra?.tipo ?? tipoInicial ?? "despesa");
  const ativas = contas.filter((c) => !c.arquivada || c.id === regra?.conta_id);

  return (
    <form action={acao} className="space-y-4">
      {regra && <input type="hidden" name="id" value={regra.id} />}
      <input type="hidden" name="tipo" value={tipo} />
      {!regra && (
        <div className="grid grid-cols-2 gap-1 rounded-2xl bg-fundo p-1 sm:grid-cols-4" role="group" aria-label="Tipo">
          {ABAS.map((a) => (
            <button key={a.t} type="button" aria-pressed={tipo === a.t} onClick={() => setTipo(a.t)}
              className={`min-h-10 rounded-xl text-sm font-bold transition-colors ${tipo === a.t ? `${a.cor} text-white` : "text-suave hover:text-tinta"}`}>
              {a.rotulo}
            </button>
          ))}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-[1fr_160px]">
        <div>
          <label className="rotulo" htmlFor="descricao">Nome</label>
          <input id="descricao" name="descricao" required maxLength={120} defaultValue={regra?.descricao} autoComplete="off"
            placeholder={tipo === "aporte" ? "VGBL mensal" : tipo === "receita" ? "Salário" : tipo === "transferencia" ? "Guardar na caixinha" : "Aluguel"} className="campo" />
        </div>
        <div>
          <label className="rotulo" htmlFor="valor">Valor (R$)</label>
          <input id="valor" name="valor" inputMode="decimal" required autoComplete="off" defaultValue={regra ? paraInput(regra.valor_centavos) : ""} placeholder="1.500,00" className="campo" />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <label className="rotulo" htmlFor="frequencia">Repete</label>
          <select id="frequencia" name="frequencia" defaultValue={regra?.frequencia ?? "mensal"} className="campo">
            <option value="mensal">Todo mês</option>
            <option value="semanal">Toda semana</option>
            <option value="anual">Todo ano</option>
          </select>
        </div>
        <div>
          <label className="rotulo" htmlFor="data_inicio">Primeira vez</label>
          <input id="data_inicio" name="data_inicio" type="date" required defaultValue={regra?.data_inicio ?? hoje} className="campo" />
        </div>
        <div>
          <label className="rotulo" htmlFor="data_fim">Até (opcional)</label>
          <input id="data_fim" name="data_fim" type="date" defaultValue={regra?.data_fim ?? ""} className="campo" />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="rotulo" htmlFor="conta_id">{tipo === "receita" ? "Entra em" : "Sai de"}</label>
          {tipo === "despesa" ? (
            <select id="conta_id" name="origem" required defaultValue={regra?.cartao_id ? `cartao:${regra.cartao_id}` : `conta:${regra?.conta_id ?? ativas[0]?.id ?? ""}`} className="campo">
              <optgroup label="Contas">{ativas.map((c) => <option key={c.id} value={`conta:${c.id}`}>{c.nome}</option>)}</optgroup>
              {cartoes.filter((c) => !c.arquivado).length > 0 && (
                <optgroup label="Cartões de crédito">{cartoes.filter((c) => !c.arquivado).map((c) => <option key={c.id} value={`cartao:${c.id}`}>{c.nome}</option>)}</optgroup>
              )}
            </select>
          ) : (
            <select id="conta_id" name="conta_id" required defaultValue={regra?.conta_id ?? ativas[0]?.id} className="campo">
              {ativas.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
            </select>
          )}
        </div>
        {(tipo === "despesa" || tipo === "receita") && (
          <div>
            <label className="rotulo" htmlFor="categoria_id">Categoria</label>
            <select id="categoria_id" name="categoria_id" required key={tipo} defaultValue={regra?.tipo === tipo ? regra.categoria_id ?? "" : ""} className="campo">
              <option value="" disabled>Escolha…</option>
              {agrupar(categorias, tipo).map(({ mae, filhas }) =>
                filhas.length === 0 ? <option key={mae.id} value={mae.id}>{mae.nome}</option> : (
                  <optgroup key={mae.id} label={mae.nome}>
                    <option value={mae.id}>{mae.nome} (geral)</option>
                    {filhas.map((f) => <option key={f.id} value={f.id}>{f.nome}</option>)}
                  </optgroup>
                ),
              )}
            </select>
          </div>
        )}
        {tipo === "transferencia" && (
          <div>
            <label className="rotulo" htmlFor="conta_destino_id">Vai para</label>
            <select id="conta_destino_id" name="conta_destino_id" required defaultValue={regra?.conta_destino_id ?? ativas[1]?.id ?? ""} className="campo">
              <option value="" disabled>Escolha…</option>
              {ativas.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
            </select>
          </div>
        )}
        {tipo === "aporte" && (
          <div>
            <label className="rotulo" htmlFor="ativo_id">Investimento</label>
            {ativos.length === 0 ? (
              <p className="text-[15px] text-suave">Cadastre o investimento antes em <a className="link" href="/investimentos/novo">Investimentos</a>.</p>
            ) : (
              <select id="ativo_id" name="ativo_id" required defaultValue={regra?.ativo_id ?? ativoInicial ?? ""} className="campo">
                <option value="" disabled>Escolha…</option>
                {ativos.map((a) => <option key={a.id} value={a.id}>{a.ticker ? `${a.ticker} · ${a.nome}` : a.nome}</option>)}
              </select>
            )}
          </div>
        )}
      </div>

      {regra && (
        <div className="rounded-xl bg-fundo p-3">
          <label className="rotulo" htmlFor="a_partir_de">Mudanças valem a partir de</label>
          <input id="a_partir_de" name="a_partir_de" type="date" defaultValue={proxima ?? hoje} className="campo max-w-48" />
          <p className="dica">O que já foi confirmado antes dessa data não muda.</p>
        </div>
      )}

      <Erro msg={estado.erro} />
      <BotaoEnviar>{regra ? "Salvar alterações" : "Criar recorrência"}</BotaoEnviar>
    </form>
  );
}
