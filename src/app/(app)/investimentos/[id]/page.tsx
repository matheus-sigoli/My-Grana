import Link from "next/link";
import { notFound } from "next/navigation";
import { BotaoConfirmar } from "@/components/confirmar";
import { ExcluirItem, FormAvaliacao, FormEditarAtivo, FormOperacao, FormProvento } from "@/components/investimentos/formularios";
import { Lottie } from "@/components/lottie";
import { carregarContasECategorias } from "@/lib/dados";
import { brl } from "@/lib/dinheiro";
import { carregarCarteira } from "@/lib/investimentos/carteira";
import { dataCurta, pct, preco, qtd, sinal } from "@/lib/investimentos/formato";
import { NOME_CLASSE, NOME_GRUPO, NOME_OPERACAO, NOME_PROVENTO, NOME_TIPO_RF, descreverTaxa } from "@/lib/investimentos/rotulos";
import { ehUuid } from "@/lib/seguranca";
import { requireUser } from "@/lib/supabase/server";
import { alternarAtivoArquivado, excluirItem } from "../actions";

const OK: Record<string, string> = {
  operacao: "Operação registrada.",
  avaliacao: "Valor atualizado.",
  provento: "Provento registrado e lançado como receita.",
  ativo: "Dados salvos.",
};

export default async function AtivoPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ ok?: string }> }) {
  const { id } = await params;
  const { ok } = await searchParams;
  if (!ehUuid(id)) notFound();
  const { supabase } = await requireUser();
  const [dados, { contas }] = await Promise.all([carregarCarteira(supabase, { incluirArquivados: true }), carregarContasECategorias(supabase)]);
  const pos = dados.carteira.posicoes.find((p) => p.ativo.id === id);
  if (!pos) notFound();
  const a = pos.ativo;
  const nomeConta = new Map(contas.map((c) => [c.id, c.nome]));
  const ops = dados.operacoes.filter((o) => o.ativo_id === id).reverse();
  const avals = dados.avaliacoes.filter((v) => v.ativo_id === id).reverse();
  const provs = dados.proventos.filter((p) => p.ativo_id === id).reverse();
  const rent = pos.investidoCentavos > 0 ? pos.ganhoCentavos / pos.investidoCentavos : 0;
  const titulo = a.ticker ? `${a.ticker}${a.nome !== a.ticker ? ` · ${a.nome}` : ""}` : a.nome;
  const descricao =
    a.classe === "renda_fixa"
      ? `${a.tipo_rf ? NOME_TIPO_RF[a.tipo_rf] : ""} · ${descreverTaxa(a)}${a.vencimento ? ` · vence ${dataCurta(a.vencimento)}` : ""}${a.isento_ir ? " · isento de IR" : ""}`
      : `${NOME_CLASSE[a.classe]} · ${NOME_GRUPO[pos.grupo]}`;

  return (
    <>
      <Link href="/investimentos" className="text-sm text-suave hover:text-marca">‹ Carteira</Link>
      <div className="mb-6 mt-1">
        <h1 className="font-display text-[28px] font-bold leading-tight tracking-[-0.02em] sm:text-[34px]">{titulo}</h1>
        <p className="mt-1.5 text-[15px] text-suave">{descricao}{a.arquivado && " · arquivado"}</p>
      </div>

      {ok && OK[ok] && (
        <div role="status" className="mb-6 flex items-center gap-3 rounded-2xl bg-marca-clara px-4 py-3 text-marca">
          <Lottie src="/animacoes/sucesso.json" className="size-10 shrink-0" />
          <p className="font-semibold">{OK[ok]}</p>
        </div>
      )}

      <section aria-label="Resumo" className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Numero rotulo="Vale hoje" valor={brl(pos.valorCentavos)} nota={pos.fonte === "avaliacao" ? "pelo último valor informado" : pos.fonte === "custo" ? (a.classe === "fundo" || a.classe === "previdencia" ? "valor aplicado — informe o extrato" : "sem cotação: custo") : pos.fonte === "calculado" ? "calculado pela taxa" : undefined} forte />
        <Numero rotulo={a.classe === "renda_fixa" || a.classe === "fundo" || a.classe === "previdencia" ? "Aplicado (líquido)" : "Custo da posição"} valor={brl(pos.investidoCentavos)} />
        <Numero rotulo="Resultado" valor={`${sinal(pos.ganhoCentavos)}`} nota={pos.investidoCentavos > 0 ? pct(rent) : undefined} cor={pos.ganhoCentavos < 0 ? "text-despesa" : "text-receita"} />
        {pos.quantidade !== null ? (
          <Numero rotulo="Quantidade" valor={qtd(pos.quantidade)} nota={`PM ${pos.precoMedioCentavos !== null ? preco(pos.precoMedioCentavos / 100) : "—"}${pos.cotacao !== null ? ` · agora ${preco(pos.cotacao)}` : ""}`} />
        ) : (
          <Numero rotulo="IR se resgatar hoje" valor={pos.irEstimadoCentavos === null ? "—" : brl(pos.irEstimadoCentavos)} nota={pos.irEstimadoCentavos === null ? "depende do regime do plano" : "estimativa"} />
        )}
      </section>

      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        <div className="space-y-6">
          <Historico titulo="Operações" vazio="Nenhuma operação.">
            {ops.map((o) => (
              <li key={o.id} className="flex items-center gap-3 px-4 py-3 sm:px-5">
                <div className="min-w-0 flex-1">
                  <p className="text-[15px] font-semibold">
                    {NOME_OPERACAO[o.tipo]}{o.quantidade !== null && ` · ${qtd(o.quantidade)} × ${preco(o.valor_centavos / 100 / o.quantidade)}`}
                  </p>
                  <p className="truncate text-[13px] text-suave">
                    {dataCurta(o.data)} · {nomeConta.get(o.conta_id) ?? "conta"}
                    {o.taxas_centavos > 0 && ` · taxas ${brl(o.taxas_centavos)}`}
                    {o.ir_centavos > 0 && ` · IR ${brl(o.ir_centavos)}`}
                    {!o.afeta_caixa && " · posição que já tinha"}
                  </p>
                </div>
                <p className={`whitespace-nowrap text-[15px] font-bold ${o.tipo === "venda" || o.tipo === "resgate" ? "text-receita" : ""}`}>{brl(o.valor_centavos)}</p>
                <ExcluirItem tabela="operacoes_investimento" id={o.id} ativoId={a.id} rotulo={`Excluir ${NOME_OPERACAO[o.tipo].toLowerCase()} de ${dataCurta(o.data)}`} />
              </li>
            ))}
          </Historico>

          {provs.length > 0 && (
            <Historico titulo="Proventos" vazio="">
              {provs.map((p) => (
                <li key={p.id} className="flex items-center gap-3 px-4 py-3 sm:px-5">
                  <div className="min-w-0 flex-1">
                    <p className="text-[15px] font-semibold">{NOME_PROVENTO[p.tipo]}</p>
                    <p className="text-[13px] text-suave">{dataCurta(p.data)} · {nomeConta.get(p.conta_id) ?? "conta"}</p>
                  </div>
                  <p className="whitespace-nowrap text-[15px] font-bold text-receita">+{brl(p.valor_centavos)}</p>
                  <ExcluirItem tabela="proventos" id={p.id} ativoId={a.id} rotulo={`Excluir provento de ${dataCurta(p.data)}`} />
                </li>
              ))}
            </Historico>
          )}

          {avals.length > 0 && (
            <Historico titulo="Valores informados" vazio="">
              {avals.map((v) => (
                <li key={v.id ?? v.data} className="flex items-center gap-3 px-4 py-3 sm:px-5">
                  <p className="flex-1 text-[15px]">{dataCurta(v.data)}</p>
                  <p className="whitespace-nowrap text-[15px] font-bold">{brl(v.valor_centavos)}</p>
                  {v.id && <ExcluirItem tabela="avaliacoes" id={v.id} ativoId={a.id} rotulo={`Excluir valor de ${dataCurta(v.data)}`} />}
                </li>
              ))}
            </Historico>
          )}
        </div>

        <aside className="space-y-6">
          <section className="painel">
            <h2 className="mb-4 font-display text-xl font-bold">Nova operação</h2>
            <FormOperacao ativo={a} contas={contas} hoje={dados.hoje} />
            <Link href={`/recorrentes?tipo=aporte&ativo=${a.id}`} className="link mt-4 inline-block text-sm">Programar aporte recorrente</Link>
          </section>
          <section className="painel">
            <h2 className="mb-1 font-display text-xl font-bold">Atualizar pelo extrato</h2>
            <p className="mb-4 text-[13px] text-suave">
              {a.classe === "renda_fixa" ? "Corrige o cálculo: daqui pra frente ele parte desse valor." : a.classe === "fundo" || a.classe === "previdencia" ? "Fundos e previdência são atualizados assim." : "Usado só quando não houver cotação."}
            </p>
            <FormAvaliacao ativo={a} hoje={dados.hoje} />
          </section>
          {a.classe !== "previdencia" && (
            <section className="painel">
              <h2 className="mb-4 font-display text-xl font-bold">Provento</h2>
              <FormProvento ativo={a} contas={contas} hoje={dados.hoje} />
            </section>
          )}
          <details className="painel">
            <summary className="cursor-pointer font-display text-xl font-bold">Editar ou excluir</summary>
            <div className="mt-4 space-y-5">
              <FormEditarAtivo ativo={a} />
              <form action={alternarAtivoArquivado}>
                <input type="hidden" name="id" value={a.id} />
                <input type="hidden" name="arquivado" value={String(a.arquivado)} />
                <button className="btn-sec w-full">{a.arquivado ? "Voltar para a carteira" : "Arquivar (some da carteira)"}</button>
              </form>
              <form action={excluirItem}>
                <input type="hidden" name="tabela" value="ativos" />
                <input type="hidden" name="id" value={a.id} />
                <BotaoConfirmar confirmar="Excluir ativo e todo o histórico">Excluir ativo</BotaoConfirmar>
              </form>
              <p className="text-[13px] text-suave">Excluir apaga operações, valores e proventos (e as receitas geradas por eles).</p>
            </div>
          </details>
        </aside>
      </div>
    </>
  );
}

function Numero({ rotulo, valor, nota, cor = "", forte = false }: { rotulo: string; valor: string; nota?: string; cor?: string; forte?: boolean }) {
  return (
    <div className={`rounded-2xl p-5 ${forte ? "bg-destaque text-white" : "border border-linha bg-papel"}`}>
      <p className={`text-[13px] font-medium ${forte ? "text-white/70" : "text-suave"}`}>{rotulo}</p>
      <p className={`mt-1 truncate font-display text-2xl font-bold tracking-[-0.01em] ${cor}`}>{valor}</p>
      {nota && <p className={`mt-0.5 truncate text-[13px] ${forte ? "text-white/60" : "text-suave"}`}>{nota}</p>}
    </div>
  );
}

function Historico({ titulo, vazio, children }: { titulo: string; vazio: string; children: React.ReactNode }) {
  const itens = Array.isArray(children) ? children : [children];
  return (
    <section className="overflow-hidden rounded-2xl border border-linha bg-papel">
      <h2 className="px-4 pb-2 pt-4 font-display text-xl font-bold sm:px-5">{titulo}</h2>
      {itens.length === 0 ? <p className="px-5 pb-5 text-[15px] text-suave">{vazio}</p> : <ul className="divide-y divide-linha">{children}</ul>}
    </section>
  );
}
