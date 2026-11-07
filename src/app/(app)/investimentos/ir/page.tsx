import Link from "next/link";
import { brl } from "@/lib/dinheiro";
import { nomeMes } from "@/lib/datas";
import { carregarCarteira } from "@/lib/investimentos/carteira";
import { NOME_TIPO_RF, descreverTaxa } from "@/lib/investimentos/rotulos";
import { requireUser } from "@/lib/supabase/server";

export const metadata = { title: "Imposto de renda" };

const GRUPO_IR = { acoes: "Ações", fii: "Fundos imobiliários", etf_bdr: "ETFs e BDRs", cripto: "Cripto" } as const;

/** Último dia útil (seg–sex) do mês seguinte ao da apuração: prazo do DARF. */
function prazoDarf(mes: string) {
  const d = new Date(Date.UTC(+mes.slice(0, 4), +mes.slice(5, 7) + 1, 0));
  while (d.getUTCDay() === 0 || d.getUTCDay() === 6) d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10).split("-").reverse().join("/");
}

export default async function IrPage() {
  const { supabase } = await requireUser();
  const { carteira: c } = await carregarCarteira(supabase);
  const meses = [...c.apuracaoRV].reverse();
  const rf = c.posicoes.filter((p) => p.irEstimadoCentavos !== null && p.valorCentavos > 0 && p.ativo.classe !== "previdencia");

  return (
    <>
      <div className="mb-6">
        <h1 className="font-display text-[28px] font-bold leading-tight tracking-[-0.02em] sm:text-[34px]">Imposto de renda</h1>
        <p className="mt-1.5 max-w-2xl text-[15px] text-suave">
          Estimativas para você se planejar. Não consideram day trade, IOF, compensação de prejuízo entre meses nem mudanças recentes na lei — confirme com um contador antes de pagar.
        </p>
      </div>

      <section aria-labelledby="t-rv" className="mb-6">
        <h2 id="t-rv" className="mb-4 font-display text-2xl font-bold tracking-[-0.02em]">Vendas de renda variável e cripto</h2>
        {meses.length === 0 ? (
          <p className="painel text-[15px] text-suave">Nenhuma venda registrada.</p>
        ) : (
          <div className="space-y-4">
            {meses.map((m) => (
              <div key={m.mes} className="painel">
                <div className="mb-3 flex flex-wrap items-baseline justify-between gap-3">
                  <h3 className="font-display text-lg font-bold first-letter:uppercase">{nomeMes(m.mes)}</h3>
                  <p className={`text-[15px] font-bold ${m.darfCentavos > 0 ? "text-despesa" : "text-receita"}`}>
                    {m.darfCentavos > 0 ? `DARF estimado ${brl(m.darfCentavos)} · pagar até ${prazoDarf(m.mes)}` : "Nada a pagar"}
                  </p>
                </div>
                <table className="w-full text-left text-[15px]">
                  <thead className="text-[13px] text-suave">
                    <tr>
                      <th className="py-1.5 font-medium">Grupo</th>
                      <th className="py-1.5 text-right font-medium">Vendas</th>
                      <th className="py-1.5 text-right font-medium">Ganho</th>
                      <th className="py-1.5 text-right font-medium">Imposto</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-linha">
                    {m.linhas.map((l) => (
                      <tr key={l.grupo}>
                        <td className="py-2 font-semibold">{GRUPO_IR[l.grupo]}</td>
                        <td className="py-2 text-right">{brl(l.vendasCentavos)}</td>
                        <td className={`py-2 text-right ${l.ganhoCentavos < 0 ? "text-despesa" : ""}`}>{brl(l.ganhoCentavos)}</td>
                        <td className="py-2 text-right font-bold">
                          {l.isento ? <span className="font-semibold text-receita">isento</span> : `${brl(l.impostoCentavos)} (${l.aliquota}%)`}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
          </div>
        )}
        <p className="mt-3 text-[13px] text-suave">
          Regras usadas: ações isentas com vendas até R$ 20 mil no mês (senão 15%); FIIs 20%; ETFs e BDRs 15%; cripto isento com vendas até R$ 35 mil no mês (senão 15%).
        </p>
      </section>

      <section aria-labelledby="t-rf">
        <h2 id="t-rf" className="mb-4 font-display text-2xl font-bold tracking-[-0.02em]">Se resgatasse tudo hoje</h2>
        <div className="overflow-hidden rounded-2xl border border-linha bg-papel">
          {rf.length === 0 ? (
            <p className="p-5 text-[15px] text-suave">Nenhuma renda fixa ou fundo na carteira.</p>
          ) : (
            <ul className="divide-y divide-linha">
              {rf.map((p) => (
                <li key={p.ativo.id}>
                  <Link href={`/investimentos/${p.ativo.id}`} className="flex min-h-14 items-center gap-3 px-5 py-3 hover:bg-fundo">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[15px] font-semibold">{p.ativo.nome}</span>
                      <span className="block truncate text-[13px] text-suave">
                        {p.ativo.tipo_rf ? `${NOME_TIPO_RF[p.ativo.tipo_rf]} · ${descreverTaxa(p.ativo)}` : "Fundo · 15% sobre o ganho (aprox.)"}
                      </span>
                    </span>
                    <span className="whitespace-nowrap text-[15px] font-bold">{p.irEstimadoCentavos === 0 ? <span className="text-receita">isento</span> : brl(p.irEstimadoCentavos ?? 0)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
        <p className="mt-3 text-[15px]">
          Total estimado: <strong>{brl(c.irRendaFixaCentavos)}</strong>
          <span className="text-suave"> — tabela regressiva: 22,5% até 180 dias, 20% até 360, 17,5% até 720 e 15% depois.</span>
        </p>
      </section>
    </>
  );
}
