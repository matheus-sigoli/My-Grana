import Link from "next/link";
import { Acento } from "@/components/acento";
import { Lottie } from "@/components/lottie";
import { brl } from "@/lib/dinheiro";
import { GRUPOS, type Grupo, type Posicao } from "@/lib/investimentos/calculo";
import { carregarCarteira } from "@/lib/investimentos/carteira";
import { dataCurta, pct, preco, qtd, sinal } from "@/lib/investimentos/formato";
import { NOME_CLASSE, NOME_GRUPO, NOME_TIPO_RF, descreverTaxa } from "@/lib/investimentos/rotulos";
import { requireUser } from "@/lib/supabase/server";

export const metadata = { title: "Investimentos" };

const FONTE: Record<Posicao["fonte"], string | null> = {
  cotacao: null,
  calculado: null,
  avaliacao: "pelo último valor informado",
  custo: "sem cotação — mostrando o custo",
};

export default async function InvestimentosPage() {
  const { supabase } = await requireUser();
  const [{ carteira: c, avisos, hoje }, { data: alvoData }] = await Promise.all([
    carregarCarteira(supabase),
    supabase.from("alocacao_alvo").select("grupo,percentual"),
  ]);

  if (c.posicoes.length === 0) return <Vazio />;

  const alvo = new Map((alvoData ?? []).map((a) => [a.grupo as Grupo, Number(a.percentual)]));
  const temAlvo = alvo.size > 0;
  const rent = c.aportesCentavos > 0 ? c.ganhoCentavos / c.aportesCentavos : 0;
  const difCdi = c.totalCentavos - c.equivalenteCdiCentavos;
  const grupos = GRUPOS.filter((g) => c.porGrupo[g] > 0 || (alvo.get(g) ?? 0) > 0);
  const vivos = c.posicoes.filter((p) => p.valorCentavos > 0 || (p.quantidade ?? 0) > 0);
  const encerrados = c.posicoes.filter((p) => !vivos.includes(p));
  const proximos = c.vencimentos.filter((v) => v.dias >= -30).slice(0, 4);
  const proventos12m = c.posicoes.reduce((s, p) => s + p.proventos12mCentavos, 0);

  return (
    <>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-[28px] font-bold leading-tight tracking-[-0.02em] sm:text-[34px]">Investimentos</h1>
          <p className="mt-1.5 text-[15px] text-suave">Carteira em {dataCurta(hoje)}</p>
        </div>
        <Link href="/investimentos/novo" className="btn">Novo investimento</Link>
      </div>

      <Avisos avisos={avisos} />

      <section aria-labelledby="t-total" className="mb-6 grid gap-8 rounded-3xl bg-destaque p-6 text-white sm:p-8 lg:grid-cols-[1.1fr_1fr] lg:p-10">
        <div>
          <h2 id="t-total" className="text-[15px] text-white/80">Sua carteira vale</h2>
          <p className="mt-3 font-display text-[clamp(40px,6.5vw,68px)] font-extrabold leading-none tracking-[-0.03em]">{brl(c.totalCentavos)}</p>
          <div className="mt-4 flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <p className={`flex items-center gap-1.5 text-xl font-bold ${c.ganhoCentavos < 0 ? "text-[#ff9a6b]" : "text-acento"}`}>
              <Acento positivo={c.ganhoCentavos >= 0} />
              {sinal(c.ganhoCentavos)}
              <span className="rounded-full bg-white/10 px-2 py-0.5 text-[13px]">{pct(rent)}</span>
            </p>
            <p className="text-[15px] text-white/75">sobre o que você aportou</p>
          </div>
        </div>
        <dl className="grid content-end gap-4 text-[15px] sm:grid-cols-2">
          <div>
            <dt className="text-white/70">Aportado</dt>
            <dd className="mt-1 text-xl font-bold">{brl(c.aportesCentavos)}</dd>
          </div>
          <div>
            <dt className="text-white/70">Retirado + proventos</dt>
            <dd className="mt-1 text-xl font-bold">{brl(c.retiradasCentavos + c.proventosCentavos)}</dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="sr-only">Comparação com o CDI e a inflação</dt>
            <dd className="text-white/85">
              O mesmo dinheiro, nas mesmas datas, a 100% do CDI valeria <strong className="text-white">{brl(c.equivalenteCdiCentavos)}</strong>
              {" — "}
              {difCdi >= 0 ? `você está ${brl(difCdi)} acima.` : `você está ${brl(-difCdi)} abaixo.`} Só corrigido pela inflação seria{" "}
              <strong className="text-white">{brl(c.equivalenteInflacaoCentavos)}</strong>.
            </dd>
          </div>
        </dl>
      </section>

      <div className="grid gap-6 lg:grid-cols-[1.35fr_1fr]">
        <section aria-labelledby="t-aloc" className="painel">
          <div className="mb-5 flex items-baseline justify-between gap-3">
            <h2 id="t-aloc" className="font-display text-xl font-bold tracking-[-0.01em]">Alocação</h2>
            <Link href="/investimentos/alocacao" className="link text-sm">{temAlvo ? "Rebalancear" : "Definir meta"}</Link>
          </div>
          <ul className="space-y-4">
            {grupos.map((g) => {
              const atual = c.totalCentavos ? c.porGrupo[g] / c.totalCentavos : 0;
              const meta = (alvo.get(g) ?? 0) / 100;
              return (
                <li key={g}>
                  <div className="mb-1.5 flex items-baseline justify-between gap-3 text-[15px]">
                    <span className="font-semibold">{NOME_GRUPO[g]}</span>
                    <span className="whitespace-nowrap font-bold">
                      {pct(atual)}
                      {temAlvo && <span className="ml-1.5 text-[13px] font-medium text-suave">meta {pct(meta, 0)}</span>}
                    </span>
                  </div>
                  <div className="relative h-2.5 rounded-full bg-fundo" aria-hidden="true">
                    <div className="h-full rounded-full bg-marca" style={{ width: `${Math.max(1, atual * 100)}%` }} />
                    {temAlvo && <span className="absolute -top-1 h-4.5 w-1 -translate-x-1/2 rounded-full bg-tinta" style={{ left: `${Math.min(100, meta * 100)}%` }} />}
                  </div>
                </li>
              );
            })}
          </ul>
          {temAlvo && <p className="mt-4 text-[13px] text-suave">A marca escura mostra a meta de cada grupo.</p>}
        </section>

        <div className="grid content-start gap-6">
          <section aria-labelledby="t-venc" className="painel">
            <div className="mb-4 flex items-baseline justify-between gap-3">
              <h2 id="t-venc" className="font-display text-xl font-bold tracking-[-0.01em]">Próximos vencimentos</h2>
            </div>
            {proximos.length === 0 ? (
              <p className="text-[15px] text-suave">Nenhum título com vencimento.</p>
            ) : (
              <ul className="space-y-3">
                {proximos.map((v) => (
                  <li key={v.ativo.id} className="flex items-baseline justify-between gap-3 text-[15px]">
                    <Link href={`/investimentos/${v.ativo.id}`} className="min-w-0 truncate font-semibold hover:text-marca">{v.ativo.nome}</Link>
                    <span className={`whitespace-nowrap text-[13px] ${v.dias < 0 ? "font-bold text-despesa" : v.dias <= 30 ? "font-bold text-tinta" : "text-suave"}`}>
                      {v.dias < 0 ? "venceu — registre o resgate" : v.dias === 0 ? "vence hoje" : `${dataCurta(v.vencimento)} · ${v.dias} dias`}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
          <section aria-labelledby="t-prov" className="painel">
            <div className="mb-2 flex items-baseline justify-between gap-3">
              <h2 id="t-prov" className="font-display text-xl font-bold tracking-[-0.01em]">Proventos em 12 meses</h2>
              <Link href="/investimentos/proventos" className="link text-sm">Ver todos</Link>
            </div>
            <p className="font-display text-3xl font-bold tracking-[-0.02em] text-receita">{brl(proventos12m)}</p>
            <p className="mt-1 text-[15px] text-suave">
              {c.totalCentavos > 0 && proventos12m > 0 ? `${pct(proventos12m / c.totalCentavos)} do valor atual da carteira.` : "Registre dividendos e rendimentos na página de cada ativo."}
            </p>
          </section>
        </div>
      </div>

      <section aria-labelledby="t-pos" className="mt-8">
        <h2 id="t-pos" className="mb-4 font-display text-2xl font-bold tracking-[-0.02em]">Ativos</h2>
        <div className="space-y-6">
          {GRUPOS.filter((g) => vivos.some((p) => p.grupo === g)).map((g) => {
            const ps = vivos.filter((p) => p.grupo === g).sort((a, b) => b.valorCentavos - a.valorCentavos);
            return (
              <div key={g} className="overflow-hidden rounded-2xl border border-linha bg-papel">
                <h3 className="flex items-baseline justify-between gap-3 bg-fundo/70 px-4 py-2.5 text-[15px] font-bold sm:px-5">
                  {NOME_GRUPO[g]}
                  <span className="text-[13px] font-semibold text-suave">{brl(c.porGrupo[g])}</span>
                </h3>
                <ul className="divide-y divide-linha">
                  {ps.map((p) => <LinhaPosicao key={p.ativo.id} p={p} />)}
                </ul>
              </div>
            );
          })}
        </div>
        {encerrados.length > 0 && (
          <details className="mt-6">
            <summary className="cursor-pointer text-[15px] font-semibold text-suave">Posições zeradas ({encerrados.length})</summary>
            <ul className="mt-3 divide-y divide-linha overflow-hidden rounded-2xl border border-linha bg-papel">
              {encerrados.map((p) => <LinhaPosicao key={p.ativo.id} p={p} />)}
            </ul>
          </details>
        )}
      </section>
    </>
  );
}

function LinhaPosicao({ p }: { p: Posicao }) {
  const a = p.ativo;
  const rent = p.investidoCentavos > 0 ? p.ganhoCentavos / p.investidoCentavos : 0;
  const detalhe =
    a.classe === "renda_fixa"
      ? `${a.tipo_rf ? NOME_TIPO_RF[a.tipo_rf] : ""} · ${descreverTaxa(a)}${a.vencimento ? ` · vence ${dataCurta(a.vencimento)}` : ""}`
      : p.quantidade !== null
        ? `${qtd(p.quantidade)} × PM ${p.precoMedioCentavos !== null ? preco(p.precoMedioCentavos / 100) : "—"}${p.cotacao !== null ? ` · agora ${preco(p.cotacao)}` : ""}`
        : NOME_CLASSE[a.classe];
  const semExtrato = p.fonte === "custo" && (a.classe === "fundo" || a.classe === "previdencia");
  const aviso = p.vencido && p.valorCentavos > 0 ? "venceu — registre o resgate" : semExtrato ? "valor aplicado — atualize pelo extrato" : FONTE[p.fonte];
  return (
    <li>
      <Link href={`/investimentos/${a.id}`} className="flex min-h-16 items-center gap-3 px-4 py-3 transition-colors duration-150 hover:bg-fundo sm:px-5">
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-semibold">
            {a.ticker && <span className="mr-1.5 font-bold">{a.ticker}</span>}
            {a.ticker && a.nome !== a.ticker ? <span className="font-normal text-suave">{a.nome}</span> : !a.ticker && a.nome}
          </p>
          <p className="truncate text-[13px] text-suave">
            {detalhe}
            {aviso && <span className="ml-1 font-semibold text-despesa">· {aviso}</span>}
          </p>
        </div>
        <div className="text-right">
          <p className="whitespace-nowrap text-[15px] font-bold">{brl(p.valorCentavos)}</p>
          {p.investidoCentavos > 0 && (
            <p className={`whitespace-nowrap text-[13px] font-semibold ${p.ganhoCentavos < 0 ? "text-despesa" : "text-receita"}`}>
              {sinal(p.ganhoCentavos)} · {pct(rent)}
            </p>
          )}
        </div>
      </Link>
    </li>
  );
}

function Avisos({ avisos }: { avisos: { indices: boolean; semToken: boolean; semCotacao: string[] } }) {
  const msgs: string[] = [];
  if (avisos.semToken) msgs.push("Cotações da bolsa indisponíveis no momento. Ações, FIIs, ETFs e BDRs aparecem pelo valor investido.");
  else if (avisos.semCotacao.length) msgs.push(`Sem cotação agora para ${avisos.semCotacao.join(", ")}. Usando o último valor informado ou o custo.`);
  if (avisos.indices) msgs.push("Não deu para buscar CDI/Selic/IPCA no Banco Central agora; a renda fixa pode estar desatualizada.");
  if (!msgs.length) return null;
  return (
    <div role="status" className="mb-6 space-y-1 rounded-2xl bg-acento/25 px-4 py-3 text-[15px] text-[#0f1b17]">
      {msgs.map((m) => <p key={m}>{m}</p>)}
    </div>
  );
}

function Vazio() {
  return (
    <div className="mx-auto max-w-xl py-6 text-center sm:py-10">
      <Lottie src="/animacoes/vazio.json" className="mx-auto h-40 w-52" />
      <h1 className="mt-4 font-display text-[34px] font-bold leading-tight tracking-[-0.02em]">Monte sua carteira</h1>
      <p className="mx-auto mt-2 max-w-md text-[15px] text-suave">
        Cadastre o que você já tem — CDB, Tesouro, ações, FIIs, fundos, cripto — e acompanhe quanto vale, quanto rendeu e se está batendo o CDI.
      </p>
      <Link href="/investimentos/novo" className="btn mt-6">Cadastrar primeiro investimento</Link>
      <p className="mt-6 text-[13px] text-suave">
        Dica: crie uma conta do tipo <Link href="/contas" className="link">Corretora</Link> para o dinheiro que fica parado nela.
      </p>
    </div>
  );
}
