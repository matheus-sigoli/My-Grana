"use client";
import { useActionState, useState } from "react";
import { criarAtivo } from "@/app/(app)/investimentos/actions";
import { BotaoEnviar } from "@/components/botao-enviar";
import { Erro } from "@/components/erro";
import type { Classe, Indexador, TipoRF } from "@/lib/investimentos/calculo";
import { INDEXADOR_PADRAO, NOME_INDEXADOR, NOME_TIPO_RF } from "@/lib/investimentos/rotulos";
import { ESTADO_INICIAL, type Conta } from "@/lib/tipos";
import { CamposOperacao } from "./campos-operacao";

const CLASSES: { c: Classe; rotulo: string; dica: string }[] = [
  { c: "renda_fixa", rotulo: "Renda fixa", dica: "CDB, Tesouro, LCI/LCA…" },
  { c: "acao", rotulo: "Ações", dica: "PETR4, ITUB4…" },
  { c: "fii", rotulo: "FIIs", dica: "HGLG11, MXRF11…" },
  { c: "etf", rotulo: "ETFs", dica: "BOVA11, IVVB11…" },
  { c: "bdr", rotulo: "BDRs", dica: "AAPL34, MSFT34…" },
  { c: "cripto", rotulo: "Cripto", dica: "BTC, ETH…" },
  { c: "fundo", rotulo: "Fundos", dica: "multimercado, RF…" },
  { c: "previdencia", rotulo: "Previdência", dica: "PGBL, VGBL" },
];
const ISENTOS: TipoRF[] = ["lci", "lca", "cri", "cra", "poupanca"];

export function FormAtivo({ contas, hoje }: { contas: Conta[]; hoje: string }) {
  const [estado, acao] = useActionState(criarAtivo, ESTADO_INICIAL);
  const [classe, setClasse] = useState<Classe>("renda_fixa");
  const [tipoRf, setTipoRf] = useState<TipoRF>("cdb");
  const [indexador, setIndexador] = useState<Indexador>("pos_cdi");
  const rv = ["acao", "fii", "etf", "bdr", "cripto"].includes(classe);

  if (contas.filter((c) => !c.arquivada).length === 0) {
    return <p className="text-[15px] text-suave">Crie antes uma conta em <a className="link" href="/contas">Contas</a> — de preferência do tipo Corretora.</p>;
  }

  return (
    <form action={acao} className="space-y-8">
      <fieldset>
        <legend className="mb-3 font-display text-xl font-bold">O que é?</legend>
        <input type="hidden" name="classe" value={classe} />
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {CLASSES.map(({ c, rotulo, dica }) => (
            <button
              key={c}
              type="button"
              aria-pressed={classe === c}
              onClick={() => setClasse(c)}
              className={`rounded-2xl border px-3 py-3 text-left transition-colors duration-150 ${classe === c ? "border-tinta bg-tinta text-papel" : "border-linha bg-papel hover:border-tinta/30"}`}
            >
              <span className="block text-[15px] font-bold">{rotulo}</span>
              <span className={`block text-[13px] ${classe === c ? "text-papel/70" : "text-suave"}`}>{dica}</span>
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset className="space-y-4" key={classe}>
        <legend className="mb-3 font-display text-xl font-bold">Detalhes</legend>
        {rv && (
          <div className="grid gap-4 sm:grid-cols-[180px_1fr]">
            <div>
              <label className="rotulo" htmlFor="ticker">{classe === "cripto" ? "Símbolo" : "Código"}</label>
              <input id="ticker" name="ticker" required maxLength={12} autoComplete="off" autoCapitalize="characters" spellCheck={false} placeholder={classe === "cripto" ? "BTC" : classe === "fii" ? "HGLG11" : "PETR4"} className="campo font-bold uppercase" />
            </div>
            <div>
              <label className="rotulo" htmlFor="nome">Nome (opcional)</label>
              <input id="nome" name="nome" maxLength={80} autoComplete="off" placeholder={classe === "cripto" ? "Bitcoin" : "Petrobras PN"} className="campo" />
            </div>
          </div>
        )}

        {classe === "renda_fixa" && (
          <>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="rotulo" htmlFor="tipo_rf">Tipo do título</label>
                <select
                  id="tipo_rf"
                  name="tipo_rf"
                  value={tipoRf}
                  onChange={(e) => {
                    const t = e.target.value as TipoRF;
                    setTipoRf(t);
                    if (INDEXADOR_PADRAO[t]) setIndexador(INDEXADOR_PADRAO[t]!);
                  }}
                  className="campo"
                >
                  {(Object.keys(NOME_TIPO_RF) as TipoRF[]).map((t) => <option key={t} value={t}>{NOME_TIPO_RF[t]}</option>)}
                </select>
              </div>
              <div>
                <label className="rotulo" htmlFor="nome">Nome</label>
                <input id="nome" name="nome" required maxLength={80} autoComplete="off" placeholder={tipoRf.startsWith("tesouro") ? "Tesouro IPCA+ 2035" : "CDB Banco Inter"} className="campo" />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <label className="rotulo" htmlFor="indexador">Rende</label>
                <select id="indexador" name="indexador" value={indexador} onChange={(e) => setIndexador(e.target.value as Indexador)} className="campo">
                  {(Object.keys(NOME_INDEXADOR) as Indexador[]).map((i) => <option key={i} value={i}>{NOME_INDEXADOR[i]}</option>)}
                </select>
              </div>
              <div>
                <label className="rotulo" htmlFor="taxa">
                  {indexador === "pos_cdi" ? "% do CDI" : indexador === "pre" ? "Taxa (% ao ano)" : indexador === "ipca" ? "IPCA + (% ao ano)" : "Selic + (% ao ano)"}
                </label>
                <input id="taxa" name="taxa" inputMode="decimal" autoComplete="off" required={indexador !== "selic"} placeholder={indexador === "pos_cdi" ? "110" : indexador === "pre" ? "12,5" : indexador === "ipca" ? "6,2" : "0,1"} className="campo" />
              </div>
              <div>
                <label className="rotulo" htmlFor="vencimento">Vencimento</label>
                <input id="vencimento" name="vencimento" type="date" min="2000-01-01" max="2200-12-31" className="campo" />
              </div>
            </div>
            <label className="flex cursor-pointer items-start gap-3 text-[15px]">
              <input type="checkbox" name="isento_ir" value="1" key={tipoRf} defaultChecked={ISENTOS.includes(tipoRf)} className="mt-1 size-4 accent-marca" />
              <span>
                <span className="font-semibold">Isento de IR</span>
                <span className="block text-[13px] text-suave">LCI, LCA, CRI, CRA, poupança e debêntures incentivadas.</span>
              </span>
            </label>
          </>
        )}

        {(classe === "fundo" || classe === "previdencia") && (
          <div>
            <label className="rotulo" htmlFor="nome">Nome</label>
            <input id="nome" name="nome" required maxLength={80} autoComplete="off" placeholder={classe === "fundo" ? "Fundo XP Multimercado" : "VGBL Brasilprev"} className="campo" />
            <p className="dica">O valor é atualizado quando você informa o saldo do extrato.</p>
          </div>
        )}
      </fieldset>

      <fieldset>
        <legend className="mb-3 font-display text-xl font-bold">{rv ? "Primeira compra" : "Primeira aplicação"}</legend>
        <CamposOperacao key={`op-${rv}`} rv={rv} contas={contas} hoje={hoje} primeira />
      </fieldset>

      <Erro msg={estado.erro} />
      <BotaoEnviar>Adicionar à carteira</BotaoEnviar>
    </form>
  );
}
