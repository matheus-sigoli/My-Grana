"use client";
import { useState } from "react";
import type { Conta } from "@/lib/tipos";

/** Campos de uma operação. Renda variável: quantidade × preço; demais: valor. */
export function CamposOperacao({
  rv,
  contas,
  hoje,
  primeira = false,
  tipoInicial,
}: {
  rv: boolean;
  contas: Conta[];
  hoje: string;
  primeira?: boolean;
  tipoInicial?: string;
}) {
  const tipos = rv ? (["compra", "venda"] as const) : (["aplicacao", "resgate"] as const);
  const [tipo, setTipo] = useState<string>(tipoInicial ?? tipos[0]);
  const saida = tipo === "venda" || tipo === "resgate";
  const ordenadas = [...contas].filter((c) => !c.arquivada).sort((a, b) => Number(b.tipo === "corretora") - Number(a.tipo === "corretora"));

  return (
    <div className="space-y-4">
      {primeira ? (
        <input type="hidden" name="tipo_op" value={tipos[0]} />
      ) : (
        <div className="grid grid-cols-2 gap-1 rounded-full bg-fundo p-1" role="radiogroup" aria-label="Tipo de operação">
          {tipos.map((t) => (
            <label key={t} className={`flex min-h-10 cursor-pointer items-center justify-center rounded-full text-sm font-bold has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-marca ${tipo === t ? (t === "compra" || t === "aplicacao" ? "bg-tinta text-papel" : "bg-despesa text-white") : "text-suave"}`}>
              <input type="radio" name="tipo_op" value={t} checked={tipo === t} onChange={() => setTipo(t)} className="sr-only" />
              {{ compra: "Compra", venda: "Venda", aplicacao: "Aplicação", resgate: "Resgate" }[t]}
            </label>
          ))}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="rotulo" htmlFor="conta_id">{saida ? "Dinheiro cai em" : "Onde está"}</label>
          <select id="conta_id" name="conta_id" required className="campo" defaultValue={ordenadas[0]?.id}>
            {ordenadas.map((c) => <option key={c.id} value={c.id}>{c.nome}{c.tipo === "corretora" ? " (corretora)" : ""}</option>)}
          </select>
        </div>
        <div>
          <label className="rotulo" htmlFor="data">Data</label>
          <input id="data" name="data" type="date" required defaultValue={hoje} min="2000-01-01" max="2100-12-31" className="campo" />
        </div>
      </div>

      {rv ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="rotulo" htmlFor="quantidade">Quantidade</label>
            <input id="quantidade" name="quantidade" inputMode="decimal" autoComplete="off" required placeholder="100" className="campo" />
          </div>
          <div>
            <label className="rotulo" htmlFor="preco">Preço por unidade (R$)</label>
            <input id="preco" name="preco" inputMode="decimal" autoComplete="off" required placeholder="38,45" className="campo" />
          </div>
        </div>
      ) : (
        <div>
          <label className="rotulo" htmlFor="valor">{saida ? "Valor bruto resgatado (R$)" : "Valor aplicado (R$)"}</label>
          <input id="valor" name="valor" inputMode="decimal" autoComplete="off" required placeholder="1.000,00" className="campo font-display text-2xl font-bold" />
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="rotulo" htmlFor="taxas">Taxas e corretagem (R$)</label>
          <input id="taxas" name="taxas" inputMode="decimal" autoComplete="off" placeholder="0,00" className="campo" />
        </div>
        {saida && (
          <div>
            <label className="rotulo" htmlFor="ir">IR retido na fonte (R$)</label>
            <input id="ir" name="ir" inputMode="decimal" autoComplete="off" placeholder="0,00" className="campo" />
          </div>
        )}
      </div>

      {!saida && (
        <label className="flex cursor-pointer items-start gap-3 rounded-xl bg-fundo p-3 text-[15px]">
          <input type="checkbox" name="ja_tinha" value="1" defaultChecked={primeira} className="mt-1 size-4 accent-marca" />
          <span>
            <span className="font-semibold">Já tinha esse investimento</span>
            <span className="block text-[13px] text-suave">Registra a posição sem tirar dinheiro do saldo da conta.</span>
          </span>
        </label>
      )}
    </div>
  );
}
