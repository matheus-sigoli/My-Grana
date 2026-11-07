import { FormAlocacao } from "@/components/investimentos/form-alocacao";
import { brl, paraCentavos } from "@/lib/dinheiro";
import { GRUPOS, rebalancear, type Grupo } from "@/lib/investimentos/calculo";
import { carregarCarteira } from "@/lib/investimentos/carteira";
import { pct } from "@/lib/investimentos/formato";
import { NOME_GRUPO } from "@/lib/investimentos/rotulos";
import { requireUser } from "@/lib/supabase/server";

export const metadata = { title: "Alocação" };

export default async function AlocacaoPage({ searchParams }: { searchParams: Promise<{ aporte?: string; ok?: string }> }) {
  const sp = await searchParams;
  const { supabase } = await requireUser();
  const [{ carteira: c }, { data }] = await Promise.all([carregarCarteira(supabase), supabase.from("alocacao_alvo").select("grupo,percentual")]);
  const alvo = Object.fromEntries((data ?? []).map((a) => [a.grupo, Number(a.percentual)])) as Partial<Record<Grupo, number>>;
  const temAlvo = Object.values(alvo).some((v) => (v ?? 0) > 0);
  const aporte = paraCentavos((sp.aporte ?? "").slice(0, 20));
  const plano = temAlvo && aporte && aporte > 0 ? rebalancear(c.porGrupo, alvo, aporte) : null;
  const linhas = GRUPOS.filter((g) => c.porGrupo[g] > 0 || (alvo[g] ?? 0) > 0);

  return (
    <>
      <div className="mb-6">
        <h1 className="font-display text-[28px] font-bold leading-tight tracking-[-0.02em] sm:text-[34px]">Alocação</h1>
        <p className="mt-1.5 max-w-2xl text-[15px] text-suave">Defina quanto da carteira quer em cada grupo e veja onde colocar o próximo aporte para chegar lá.</p>
      </div>

      {sp.ok && <p role="status" className="mb-6 rounded-2xl bg-marca-clara px-4 py-3 font-semibold text-marca">Meta salva.</p>}

      <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
        <section aria-labelledby="t-comp" className="painel">
          <h2 id="t-comp" className="mb-4 font-display text-xl font-bold">Hoje × meta</h2>
          {linhas.length === 0 ? (
            <p className="text-[15px] text-suave">Cadastre investimentos ou defina uma meta para comparar.</p>
          ) : (
            <table className="w-full text-left text-[15px]">
              <thead className="text-[13px] text-suave">
                <tr>
                  <th className="py-1.5 font-medium">Grupo</th>
                  <th className="py-1.5 text-right font-medium">Hoje</th>
                  <th className="py-1.5 text-right font-medium">Meta</th>
                  <th className="py-1.5 text-right font-medium">Diferença</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-linha">
                {linhas.map((g) => {
                  const atual = c.totalCentavos ? c.porGrupo[g] / c.totalCentavos : 0;
                  const meta = (alvo[g] ?? 0) / 100;
                  const dif = meta * c.totalCentavos - c.porGrupo[g];
                  return (
                    <tr key={g}>
                      <td className="py-2.5 font-semibold">{NOME_GRUPO[g]}</td>
                      <td className="py-2.5 text-right">{pct(atual)}</td>
                      <td className="py-2.5 text-right">{temAlvo ? pct(meta, 0) : "—"}</td>
                      <td className={`py-2.5 text-right font-bold ${!temAlvo ? "" : dif > 0 ? "text-receita" : dif < 0 ? "text-despesa" : ""}`}>
                        {temAlvo ? `${dif > 0 ? "faltam " : dif < 0 ? "sobram " : ""}${brl(Math.abs(Math.round(dif)))}` : ""}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}

          {temAlvo && (
            <div className="mt-6 rounded-2xl bg-fundo p-4 sm:p-5">
              <h3 className="font-display text-lg font-bold">Onde colocar o próximo aporte</h3>
              <form className="mt-3 flex flex-wrap items-end gap-2" action="/investimentos/alocacao">
                <div className="flex-1">
                  <label className="rotulo" htmlFor="aporte">Vou aportar (R$)</label>
                  <input id="aporte" name="aporte" inputMode="decimal" autoComplete="off" defaultValue={sp.aporte} placeholder="2.000,00" maxLength={20} className="campo" />
                </div>
                <button className="btn">Calcular</button>
              </form>
              {plano && (
                <ul className="mt-4 space-y-2">
                  {GRUPOS.filter((g) => plano[g] > 0).map((g) => (
                    <li key={g} className="flex items-baseline justify-between gap-3 text-[15px]">
                      <span className="font-semibold">{NOME_GRUPO[g]}</span>
                      <span className="font-bold">{brl(plano[g])}</span>
                    </li>
                  ))}
                </ul>
              )}
              {aporte === null && sp.aporte && <p className="mt-3 text-[15px] text-despesa">Valor inválido. Use o formato 2.000,00.</p>}
            </div>
          )}
        </section>

        <section aria-labelledby="t-meta" className="painel">
          <h2 id="t-meta" className="mb-1 font-display text-xl font-bold">Sua meta</h2>
          <p className="mb-4 text-[13px] text-suave">Uma referência comum: reserva de emergência em RF pós, e o resto dividido conforme seu prazo e tolerância a risco.</p>
          <FormAlocacao inicial={alvo} />
        </section>
      </div>
    </>
  );
}
