import Link from "next/link";
import { FormRecorrencia } from "@/components/recorrentes/form-recorrencia";
import { LinhaOcorrencia } from "@/components/recorrentes/ocorrencia";
import { Titulo } from "@/components/titulo";
import { carregarContasECategorias } from "@/lib/dados";
import { carregarPrevistas, somaDias } from "@/lib/dados-recorrencias";
import { hojeISO } from "@/lib/datas";
import { brl } from "@/lib/dinheiro";
import { datasEntre, type TipoRecorrencia } from "@/lib/recorrencias";
import { requireUser } from "@/lib/supabase/server";
import { detectarRecorrentes, type LancHistorico } from "@/lib/deteccao";
import { criarDaSugestao } from "./actions";

export const metadata = { title: "Recorrentes" };

const MSG: Record<string, string> = {
  salva: "Recorrência salva.", "erro-sugestao": "Não foi possível criar a partir da sugestão. Cadastre ao lado.", confirmada: "Confirmado e lançado.", pulada: "Ocorrência pulada.", encerrada: "Recorrência encerrada.", excluida: "Recorrência excluída.",
};
const GRUPOS: { t: TipoRecorrencia; titulo: string }[] = [
  { t: "despesa", titulo: "Contas a pagar" },
  { t: "receita", titulo: "A receber" },
  { t: "aporte", titulo: "Aportes em investimentos" },
  { t: "transferencia", titulo: "Transferências" },
];
const FREQ = { mensal: "todo mês", semanal: "toda semana", anual: "todo ano" } as const;

export default async function RecorrentesPage({ searchParams }: { searchParams: Promise<{ ok?: string; tipo?: string; ativo?: string }> }) {
  const sp = await searchParams;
  const { supabase } = await requireUser();
  const hoje = hojeISO();
  const [{ contas, categorias, cartoes }, { regras, previstas }, { data: ativosData }, { data: historico }, { data: todasRegras }] = await Promise.all([
    carregarContasECategorias(supabase),
    carregarPrevistas(supabase, somaDias(hoje, -60), somaDias(hoje, 45), hoje),
    supabase.from("ativos").select("id,nome,ticker,classe").eq("arquivado", false).order("nome"),
    supabase.from("lancamentos").select("tipo,descricao,valor_centavos,data,conta_id,cartao_id,categoria_id,grupo_parcelas")
      .in("tipo", ["receita", "despesa"]).gte("data", somaDias(hoje, -200)).limit(3000),
    supabase.from("recorrencias").select("descricao"),
  ]);
  const sugestoes = detectarRecorrentes(
    ((historico ?? []) as LancHistorico[]).map((l) => ({ ...l, valor_centavos: Number(l.valor_centavos) })),
    (todasRegras ?? []).map((r) => r.descricao as string),
    hoje,
  );
  const ativos = ativosData ?? [];
  const classe = new Map(ativos.map((a) => [a.id as string, a.classe as string]));
  const nomeConta = new Map<string, string>([...contas.map((c) => [c.id, c.nome] as [string, string]), ...cartoes.map((c) => [c.id, `${c.nome} (cartão)`] as [string, string])]);
  const origem = (r: { conta_id: string | null; cartao_id?: string | null }) => nomeConta.get(r.cartao_id ?? r.conta_id ?? "") ?? "conta";
  const atrasadas = previstas.filter((o) => o.atrasada);
  const proximas = previstas.filter((o) => !o.atrasada);
  const tipoInicial = (["despesa", "receita", "transferencia", "aporte"].includes(sp.tipo ?? "") ? sp.tipo : undefined) as TipoRecorrencia | undefined;

  return (
    <>
      <Titulo sub="Contas fixas, salário e aportes que se repetem. Ficam previstos até você confirmar.">Recorrentes</Titulo>
      {sp.ok && MSG[sp.ok] && <p role="status" className="mb-6 rounded-2xl bg-marca-clara px-4 py-3 font-semibold text-marca">{MSG[sp.ok]}</p>}

      <div className="grid gap-6 lg:grid-cols-[1fr_400px]">
        <div className="space-y-6">
          <section aria-labelledby="t-prox" className="overflow-hidden rounded-2xl border border-linha bg-papel">
            <h2 id="t-prox" className="px-5 pb-2 pt-5 font-display text-xl font-bold">
              Próximos 45 dias
              {atrasadas.length > 0 && <span className="ml-2 rounded-full bg-despesa px-2.5 py-0.5 align-middle text-[13px] text-white">{atrasadas.length} atrasado{atrasadas.length > 1 ? "s" : ""}</span>}
            </h2>
            {previstas.length === 0 ? (
              <p className="px-5 pb-5 text-[15px] text-suave">Nada previsto. Cadastre uma recorrência ao lado.</p>
            ) : (
              <ul className="divide-y divide-linha">
                {[...atrasadas, ...proximas].map((o) => (
                  <LinhaOcorrencia key={`${o.recorrencia.id}-${o.data}`} recorrenciaId={o.recorrencia.id} data={o.data} descricao={o.recorrencia.descricao}
                    valor={o.recorrencia.valor_centavos} tipo={o.recorrencia.tipo} atrasada={o.atrasada} contaNome={origem(o.recorrencia)}
                    hoje={hoje} rv={o.recorrencia.ativo_id ? ["acao", "fii", "etf", "bdr", "cripto"].includes(classe.get(o.recorrencia.ativo_id) ?? "") : false} />
                ))}
              </ul>
            )}
          </section>

          {sugestoes.length > 0 && (
            <section aria-labelledby="t-sug" className="overflow-hidden rounded-2xl border border-acento/60 bg-papel">
              <div className="px-5 pb-2 pt-5">
                <h2 id="t-sug" className="font-display text-xl font-bold">Parece que se repete</h2>
                <p className="mt-1 text-[15px] text-suave">Encontramos lançamentos que aparecem todo mês com valor parecido. Vire recorrência para prever o saldo.</p>
              </div>
              <ul className="divide-y divide-linha">
                {sugestoes.map((s) => (
                  <li key={s.chave} className="flex flex-wrap items-center gap-3 px-5 py-3">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[15px] font-semibold">{s.descricao}</span>
                      <span className="block truncate text-[13px] text-suave">
                        em {s.meses} dos últimos 6 meses · por volta do dia {s.dia} · {nomeConta.get(s.cartao_id ?? s.conta_id ?? "") ?? "conta"}
                      </span>
                    </span>
                    <span className={`whitespace-nowrap text-[15px] font-bold ${s.tipo === "receita" ? "text-receita" : ""}`}>{brl(s.valorCentavos)}</span>
                    <form action={criarDaSugestao}>
                      <input type="hidden" name="tipo" value={s.tipo} />
                      <input type="hidden" name="descricao" value={s.descricao.slice(0, 120)} />
                      <input type="hidden" name="valor" value={s.valorCentavos} />
                      <input type="hidden" name="dia" value={s.dia} />
                      <input type="hidden" name="conta_id" value={s.conta_id ?? ""} />
                      <input type="hidden" name="cartao_id" value={s.cartao_id ?? ""} />
                      <input type="hidden" name="categoria_id" value={s.categoria_id ?? ""} />
                      <button className="btn-sec min-h-10 px-4 text-sm">Tornar recorrente</button>
                    </form>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {GRUPOS.map(({ t, titulo }) => {
            const rs = regras.filter((r) => r.tipo === t);
            if (rs.length === 0) return null;
            const totalMes = rs.filter((r) => r.frequencia === "mensal").reduce((s, r) => s + r.valor_centavos, 0);
            return (
              <section key={t} className="overflow-hidden rounded-2xl border border-linha bg-papel">
                <h2 className="flex items-baseline justify-between gap-3 px-5 pb-2 pt-5 font-display text-xl font-bold">
                  {titulo}
                  {totalMes > 0 && <span className="text-[13px] font-semibold text-suave">{brl(totalMes)} por mês</span>}
                </h2>
                <ul className="divide-y divide-linha">
                  {rs.map((r) => {
                    const prox = datasEntre(r, hoje, somaDias(hoje, 400))[0];
                    return (
                      <li key={r.id}>
                        <Link href={`/recorrentes/${r.id}`} className="flex min-h-14 items-center gap-3 px-5 py-3 hover:bg-fundo">
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-[15px] font-semibold">{r.descricao}</span>
                            <span className="block truncate text-[13px] text-suave">
                              {FREQ[r.frequencia]} · {origem(r)}{prox ? ` · próxima ${prox.split("-").reverse().join("/")}` : " · encerrada"}
                            </span>
                          </span>
                          <span className="whitespace-nowrap text-[15px] font-bold">{brl(r.valor_centavos)}</span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </section>
            );
          })}
        </div>

        <aside className="painel h-fit">
          <h2 className="mb-4 font-display text-xl font-bold">Nova recorrência</h2>
          <FormRecorrencia cartoes={cartoes} contas={contas} categorias={categorias} ativos={ativos} hoje={hoje} tipoInicial={tipoInicial} ativoInicial={sp.ativo} />
        </aside>
      </div>
    </>
  );
}
