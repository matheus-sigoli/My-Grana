"use client";
import { useActionState, useState } from "react";
import { salvarLancamento } from "@/app/(app)/lancamentos/actions";
import { BotaoEnviar } from "@/components/botao-enviar";
import { Erro } from "@/components/erro";
import type { Cartao } from "@/lib/cartoes";
import { agrupar } from "@/lib/categorias";
import { paraInput } from "@/lib/dinheiro";
import { ESTADO_INICIAL, type Categoria, type Conta, type Lancamento, type TipoLancamento } from "@/lib/tipos";

const ABAS: { tipo: TipoLancamento; rotulo: string; cor: string }[] = [
  { tipo: "despesa", rotulo: "Despesa", cor: "bg-despesa" },
  { tipo: "receita", rotulo: "Receita", cor: "bg-receita" },
  { tipo: "transferencia", rotulo: "Transferência", cor: "bg-transf" },
];

export function FormLancamento({
  contas,
  categorias,
  lancamento,
  tipoInicial = "despesa",
  hoje,
  cartoes = [],
  totalGrupo,
}: {
  contas: Conta[];
  categorias: Categoria[];
  lancamento?: Lancamento;
  tipoInicial?: TipoLancamento;
  hoje: string;
  cartoes?: Cartao[];
  /** Ao editar uma compra parcelada: valor total de todas as parcelas. */
  totalGrupo?: number;
}) {
  const [estado, acao] = useActionState(salvarLancamento, ESTADO_INICIAL);
  const [tipo, setTipo] = useState<TipoLancamento>(lancamento?.tipo ?? tipoInicial);
  const transf = tipo === "transferencia";
  // Ao editar, mostra também conta/categoria arquivadas que o lançamento já usa.
  const contasVisiveis = contas.filter((c) => !c.arquivada || c.id === lancamento?.conta_id || c.id === lancamento?.conta_destino_id);
  const catsVisiveis = categorias.filter((c) => !c.arquivada || c.id === lancamento?.categoria_id);
  const grupos = transf ? [] : agrupar(catsVisiveis, tipo, true);
  const cartoesVisiveis = cartoes.filter((c) => !c.arquivado || c.id === lancamento?.cartao_id);
  const origemInicial = lancamento?.cartao_id ? `cartao:${lancamento.cartao_id}` : `conta:${lancamento?.conta_id ?? contasVisiveis[0]?.id ?? ""}`;
  const [origem, setOrigem] = useState(origemInicial);
  const noCartao = tipo === "despesa" && origem.startsWith("cartao:");

  if (contas.length === 0) {
    return <p className="text-[15px] text-suave">Para lançar, crie sua primeira conta em <a className="link" href="/contas">Contas</a>.</p>;
  }

  return (
    <form action={acao} className="space-y-4">
      {lancamento && <input type="hidden" name="id" value={lancamento.id} />}
      <input type="hidden" name="tipo" value={tipo} />
      <div className="grid grid-cols-3 gap-1 rounded-full bg-fundo p-1" role="group" aria-label="Tipo de lançamento">
        {ABAS.map((a) => (
          <button
            key={a.tipo}
            type="button"
            onClick={() => setTipo(a.tipo)}
            aria-pressed={tipo === a.tipo}
            className={`min-h-10 rounded-full text-sm font-bold transition-colors duration-150 ${tipo === a.tipo ? `${a.cor} text-white` : "text-suave hover:text-tinta"}`}
          >
            {a.rotulo}
          </button>
        ))}
      </div>

      <div className="grid gap-4 sm:grid-cols-[1fr_160px]">
        <div>
          <label className="rotulo" htmlFor="valor">{noCartao ? "Valor total (R$)" : "Valor (R$)"}</label>
          <input
            id="valor"
            name="valor"
            inputMode="decimal"
            autoComplete="off"
            autoFocus={!lancamento}
            required
            defaultValue={lancamento ? paraInput(totalGrupo ?? lancamento.valor_centavos) : ""}
            placeholder="0,00"
            className="campo font-display text-[28px] font-bold tracking-[-0.02em]"
          />
        </div>
        <div>
          <label className="rotulo" htmlFor="data">Data</label>
          <input id="data" name="data" type="date" required min="2000-01-01" max="2100-12-31" defaultValue={lancamento?.data ?? hoje} className="campo" />
        </div>
      </div>

      <div>
        <label className="rotulo" htmlFor="descricao">Descrição</label>
        <input
          id="descricao"
          name="descricao"
          maxLength={120}
          required={!transf}
          defaultValue={lancamento?.descricao}
          placeholder={transf ? "Transferência" : tipo === "despesa" ? "Ex.: Mercado do mês" : "Ex.: Salário"}
          className="campo"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="rotulo" htmlFor="conta_id">{transf ? "Sai de" : tipo === "receita" ? "Entra em" : "Pago com"}</label>
          {tipo === "despesa" ? (
            <select id="conta_id" name="origem" required value={origem} onChange={(e) => setOrigem(e.target.value)} className="campo">
              <optgroup label="Contas">
                {contasVisiveis.map((c) => <option key={c.id} value={`conta:${c.id}`}>{c.nome}</option>)}
              </optgroup>
              {cartoesVisiveis.length > 0 && (
                <optgroup label="Cartões de crédito">
                  {cartoesVisiveis.map((c) => <option key={c.id} value={`cartao:${c.id}`}>{c.nome}</option>)}
                </optgroup>
              )}
            </select>
          ) : (
            <select id="conta_id" name="conta_id" required defaultValue={lancamento?.conta_id ?? contasVisiveis[0]?.id} className="campo">
              {contasVisiveis.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
            </select>
          )}
        </div>
        {transf ? (
          <div>
            <label className="rotulo" htmlFor="conta_destino_id">Vai para</label>
            <select id="conta_destino_id" name="conta_destino_id" required defaultValue={lancamento?.conta_destino_id ?? contasVisiveis[1]?.id ?? ""} className="campo">
              <option value="" disabled>Escolha…</option>
              {contasVisiveis.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
            </select>
          </div>
        ) : (
          <div>
            <label className="rotulo" htmlFor="categoria_id">Categoria</label>
            <select
              id="categoria_id"
              name="categoria_id"
              required
              key={tipo}
              defaultValue={lancamento?.tipo === tipo ? lancamento.categoria_id ?? "" : ""}
              className="campo"
            >
              <option value="" disabled>Escolha…</option>
              {grupos.map(({ mae, filhas }) =>
                filhas.length === 0 ? (
                  <option key={mae.id} value={mae.id}>{mae.nome}</option>
                ) : (
                  <optgroup key={mae.id} label={mae.nome}>
                    <option value={mae.id}>{mae.nome} (geral)</option>
                    {filhas.map((f) => <option key={f.id} value={f.id}>{f.nome}</option>)}
                  </optgroup>
                ),
              )}
            </select>
          </div>
        )}
      </div>

      {noCartao && (
        <div className="grid items-end gap-4 sm:grid-cols-[160px_1fr]">
          <div>
            <label className="rotulo" htmlFor="parcelas">Parcelas</label>
            <select id="parcelas" name="parcelas" defaultValue={String(lancamento?.total_parcelas ?? 1)} className="campo">
              {Array.from({ length: 24 }, (_, i) => i + 1).map((n) => <option key={n} value={n}>{n === 1 ? "À vista" : `${n}x`}</option>)}
            </select>
          </div>
          <p className="pb-2 text-[13px] text-suave">
            {lancamento?.grupo_parcelas
              ? "Alterar aqui vale para todas as parcelas desta compra."
              : "Cada parcela entra na fatura do seu mês. O saldo da conta só muda quando você paga a fatura."}
          </p>
        </div>
      )}

      {transf && (
        <p className="rounded-xl bg-fundo px-3 py-2.5 text-[13px] text-suave">
          Transferência só move dinheiro entre suas contas — não conta como gasto nem como receita.
        </p>
      )}

      <div>
        <label className="rotulo" htmlFor="observacao">Observação (opcional)</label>
        <textarea id="observacao" name="observacao" rows={2} maxLength={500} defaultValue={lancamento?.observacao ?? ""} className="campo" />
      </div>

      <Erro msg={estado.erro} />
      <div className="flex flex-wrap gap-2">
        <BotaoEnviar>{lancamento ? "Salvar alterações" : "Salvar"}</BotaoEnviar>
        {!lancamento && (
          <button type="submit" name="continuar" value="1" className="btn-sec">Salvar e lançar outro</button>
        )}
      </div>
    </form>
  );
}
