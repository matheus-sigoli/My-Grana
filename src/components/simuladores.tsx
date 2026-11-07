"use client";
import { useState } from "react";
import { brl } from "@/lib/dinheiro";
import { financiamento, independencia, jurosCompostos, quantoGuardar } from "@/lib/simuladores";

const r = (reais: number) => brl(Math.round(reais * 100));

/** Número digitado em pt-BR: "1.000" = mil, "1.000,50", "10,5", "10.5" (decimal se não parecer milhar). */
function num(s: string, padrao = 0) {
  let t = s.replace(/\s|%|R\$/g, "");
  if (t.includes(",")) t = t.replace(/\./g, "").replace(",", ".");
  else if (/^\d{1,3}(\.\d{3})+$/.test(t)) t = t.replace(/\./g, "");
  const v = Number(t);
  return t !== "" && Number.isFinite(v) && v >= 0 ? v : padrao;
}

function Campo({ id, rotulo, valor, onChange, sufixo, dica }: { id: string; rotulo: string; valor: string; onChange: (v: string) => void; sufixo?: string; dica?: string }) {
  return (
    <div>
      <label htmlFor={id} className="rotulo">{rotulo}</label>
      <div className="relative">
        <input id={id} inputMode="decimal" autoComplete="off" value={valor} onChange={(e) => onChange(e.target.value)} className={`campo ${sufixo ? "pr-14" : ""}`} />
        {sufixo && <span className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-[13px] font-semibold text-suave">{sufixo}</span>}
      </div>
      {dica && <p className="dica">{dica}</p>}
    </div>
  );
}

function Resultado({ itens }: { itens: { rotulo: string; valor: string; forte?: boolean }[] }) {
  return (
    <dl className="grid gap-3 rounded-2xl bg-destaque p-5 text-white sm:grid-cols-3" aria-live="polite">
      {itens.map((i) => (
        <div key={i.rotulo}>
          <dt className="text-[13px] text-white/70">{i.rotulo}</dt>
          <dd className={`mt-1 font-display font-bold ${i.forte ? "text-2xl text-acento" : "text-xl"}`}>{i.valor}</dd>
        </div>
      ))}
    </dl>
  );
}

function Juros() {
  const [v, setV] = useState({ inicial: "1.000", mensal: "500", taxa: "10", anos: "10" });
  const s = (k: keyof typeof v) => (x: string) => setV((o) => ({ ...o, [k]: x }));
  const res = jurosCompostos({ inicial: num(v.inicial), mensal: num(v.mensal), taxaAnual: num(v.taxa), anos: Math.min(60, num(v.anos, 1)) });
  const max = Math.max(1, ...res.serie.map((p) => p.saldo));
  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-4">
        <Campo id="j-ini" rotulo="Valor inicial" valor={v.inicial} onChange={s("inicial")} sufixo="R$" />
        <Campo id="j-men" rotulo="Aporte por mês" valor={v.mensal} onChange={s("mensal")} sufixo="R$" />
        <Campo id="j-tx" rotulo="Rentabilidade" valor={v.taxa} onChange={s("taxa")} sufixo="% a.a." />
        <Campo id="j-anos" rotulo="Prazo" valor={v.anos} onChange={s("anos")} sufixo="anos" />
      </div>
      <Resultado itens={[
        { rotulo: "Você terá", valor: r(res.final), forte: true },
        { rotulo: "Você investiu", valor: r(res.investido) },
        { rotulo: "Juros ganhos", valor: r(res.juros) },
      ]} />
      <div>
        <p className="mb-2 text-[13px] font-semibold text-suave">Evolução por ano · <span className="text-marca">■</span> juros <span className="text-tinta/40">■</span> investido</p>
        <div className="flex h-40 items-end gap-1" role="img" aria-label={`Saldo cresce de ${r(res.serie[0].saldo)} para ${r(res.final)}`}>
          {res.serie.slice(1).map((p) => (
            <div key={p.ano} className="flex h-full flex-1 flex-col justify-end" title={`Ano ${p.ano}: ${r(p.saldo)}`}>
              <div className="rounded-t bg-marca" style={{ height: `${((p.saldo - p.investido) / max) * 100}%` }} />
              <div className="bg-tinta/20" style={{ height: `${(p.investido / max) * 100}%` }} />
            </div>
          ))}
        </div>
      </div>
      <p className="text-[13px] text-suave">Sem impostos e taxas. Para comparar com a inflação, use a rentabilidade real (descontada a inflação).</p>
    </div>
  );
}

function Independencia({ patrimonioAtual, gastoMedio }: { patrimonioAtual: number; gastoMedio: number }) {
  const [v, setV] = useState({
    gasto: gastoMedio > 0 ? String(Math.round(gastoMedio / 100)) : "5.000",
    retirada: "4",
    patrimonio: String(Math.max(0, Math.round(patrimonioAtual / 100))),
    aporte: "1.500",
    real: "4",
  });
  const s = (k: keyof typeof v) => (x: string) => setV((o) => ({ ...o, [k]: x }));
  const res = independencia({ gastoMensal: num(v.gasto), taxaRetirada: num(v.retirada, 4), patrimonio: num(v.patrimonio), aporteMensal: num(v.aporte), rentabilidadeReal: num(v.real) });
  const tempo = res.meses === null ? "mais de 100 anos" : res.meses === 0 ? "já chegou" : `${Math.floor(res.meses / 12)} anos e ${res.meses % 12} meses`;
  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-3">
        <Campo id="i-gasto" rotulo="Gasto mensal desejado" valor={v.gasto} onChange={s("gasto")} sufixo="R$" dica={gastoMedio > 0 ? "Preenchido com sua média de gastos." : undefined} />
        <Campo id="i-pat" rotulo="Patrimônio atual" valor={v.patrimonio} onChange={s("patrimonio")} sufixo="R$" />
        <Campo id="i-ap" rotulo="Aporte por mês" valor={v.aporte} onChange={s("aporte")} sufixo="R$" />
        <Campo id="i-real" rotulo="Rentabilidade real" valor={v.real} onChange={s("real")} sufixo="% a.a." dica="Acima da inflação." />
        <Campo id="i-ret" rotulo="Taxa de retirada" valor={v.retirada} onChange={s("retirada")} sufixo="% a.a." dica="A regra dos 4% é a referência clássica." />
      </div>
      <Resultado itens={[
        { rotulo: "Patrimônio necessário", valor: Number.isFinite(res.alvo) ? r(res.alvo) : "—", forte: true },
        { rotulo: "Tempo até lá", valor: tempo },
        { rotulo: "Falta juntar", valor: Number.isFinite(res.alvo) ? r(Math.max(0, res.alvo - num(v.patrimonio))) : "—" },
      ]} />
      <p className="text-[13px] text-suave">Valores em dinheiro de hoje. É uma estimativa: rentabilidade passada não garante a futura.</p>
    </div>
  );
}

function Financiamento() {
  const [v, setV] = useState({ valor: "200.000", taxa: "11", meses: "360" });
  const [ver, setVer] = useState(false);
  const s = (k: keyof typeof v) => (x: string) => setV((o) => ({ ...o, [k]: x }));
  const base = { valor: num(v.valor), taxaAnual: num(v.taxa), meses: Math.min(600, Math.max(1, num(v.meses, 1))) };
  const price = financiamento({ ...base, sistema: "price" });
  const sac = financiamento({ ...base, sistema: "sac" });
  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-3">
        <Campo id="f-v" rotulo="Valor financiado" valor={v.valor} onChange={s("valor")} sufixo="R$" />
        <Campo id="f-t" rotulo="Juros" valor={v.taxa} onChange={s("taxa")} sufixo="% a.a." dica="Use o CET para incluir seguros e tarifas." />
        <Campo id="f-m" rotulo="Prazo" valor={v.meses} onChange={s("meses")} sufixo="meses" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {[{ nome: "Price (parcelas iguais)", f: price }, { nome: "SAC (parcelas que caem)", f: sac }].map(({ nome, f }) => (
          <div key={nome} className="rounded-2xl border border-linha p-4">
            <p className="font-semibold">{nome}</p>
            <dl className="mt-3 grid grid-cols-2 gap-3 text-[15px]">
              <div><dt className="text-[13px] text-suave">1ª parcela</dt><dd className="font-bold">{r(f.parcelas[0]?.parcela ?? 0)}</dd></div>
              <div><dt className="text-[13px] text-suave">Última</dt><dd className="font-bold">{r(f.parcelas[f.parcelas.length - 1]?.parcela ?? 0)}</dd></div>
              <div><dt className="text-[13px] text-suave">Total pago</dt><dd className="font-bold">{r(f.totalPago)}</dd></div>
              <div><dt className="text-[13px] text-suave">Juros</dt><dd className="font-bold text-despesa">{r(f.totalJuros)}</dd></div>
            </dl>
          </div>
        ))}
      </div>
      <p className="text-[15px]">No SAC você paga <strong>{r(price.totalJuros - sac.totalJuros)}</strong> a menos de juros, mas a 1ª parcela é {r(sac.parcelas[0].parcela - price.parcelas[0].parcela)} maior.</p>
      <button type="button" className="link text-sm" onClick={() => setVer((x) => !x)} aria-expanded={ver}>{ver ? "Esconder" : "Ver"} as primeiras 12 parcelas</button>
      {ver && (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[480px] text-[13px]">
            <thead className="text-left text-suave"><tr><th className="py-1">Nº</th><th className="text-right">Price</th><th className="text-right">SAC</th><th className="text-right">Saldo SAC</th></tr></thead>
            <tbody className="divide-y divide-linha">
              {sac.parcelas.slice(0, 12).map((p, i) => (
                <tr key={p.n}><td className="py-1">{p.n}</td><td className="text-right">{r(price.parcelas[i].parcela)}</td><td className="text-right">{r(p.parcela)}</td><td className="text-right">{r(p.saldo)}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Guardar() {
  const [v, setV] = useState({ alvo: "10.000", atual: "0", meses: "12", taxa: "10" });
  const s = (k: keyof typeof v) => (x: string) => setV((o) => ({ ...o, [k]: x }));
  const meses = Math.min(600, Math.max(1, num(v.meses, 1)));
  const pmt = quantoGuardar({ alvo: num(v.alvo), atual: num(v.atual), meses, taxaAnual: num(v.taxa) });
  const semJuros = Math.max(0, (num(v.alvo) - num(v.atual)) / meses);
  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-4">
        <Campo id="g-a" rotulo="Quero juntar" valor={v.alvo} onChange={s("alvo")} sufixo="R$" />
        <Campo id="g-j" rotulo="Já tenho" valor={v.atual} onChange={s("atual")} sufixo="R$" />
        <Campo id="g-m" rotulo="Em" valor={v.meses} onChange={s("meses")} sufixo="meses" />
        <Campo id="g-t" rotulo="Rendendo" valor={v.taxa} onChange={s("taxa")} sufixo="% a.a." />
      </div>
      <Resultado itens={[
        { rotulo: "Guarde por mês", valor: r(pmt), forte: true },
        { rotulo: "Sem render nada seria", valor: r(semJuros) },
        { rotulo: "Os juros pagam", valor: r(Math.max(0, num(v.alvo) - num(v.atual) - pmt * meses)) },
      ]} />
      <p className="text-[13px] text-suave">Quer acompanhar de verdade? Crie uma <a href="/metas" className="link">meta</a> ligada a uma conta.</p>
    </div>
  );
}

const ABAS = [
  { id: "juros", rotulo: "Juros compostos" },
  { id: "guardar", rotulo: "Quanto guardar" },
  { id: "independencia", rotulo: "Independência financeira" },
  { id: "financiamento", rotulo: "Financiamento" },
] as const;

export function Simuladores({ patrimonioAtual, gastoMedio }: { patrimonioAtual: number; gastoMedio: number }) {
  const [aba, setAba] = useState<(typeof ABAS)[number]["id"]>("juros");
  return (
    <div className="painel">
      <div role="tablist" aria-label="Simulador" className="-mx-1 mb-6 flex gap-1 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {ABAS.map((a) => (
          <button key={a.id} role="tab" id={`aba-${a.id}`} aria-selected={aba === a.id} aria-controls="painel-sim" type="button" onClick={() => setAba(a.id)}
            className={`min-h-10 shrink-0 rounded-full px-4 text-sm font-semibold transition-colors ${aba === a.id ? "bg-tinta text-papel" : "bg-fundo text-suave hover:text-tinta"}`}>
            {a.rotulo}
          </button>
        ))}
      </div>
      <div id="painel-sim" role="tabpanel" aria-labelledby={`aba-${aba}`}>
        {aba === "juros" ? <Juros /> : aba === "guardar" ? <Guardar /> : aba === "independencia" ? <Independencia patrimonioAtual={patrimonioAtual} gastoMedio={gastoMedio} /> : <Financiamento />}
      </div>
    </div>
  );
}
