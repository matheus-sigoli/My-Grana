import Link from "next/link";
import { Lottie } from "@/components/lottie";
import { Titulo } from "@/components/titulo";
import { carregarPrevistas, somaDias } from "@/lib/dados-recorrencias";
import { carregarContasECategorias } from "@/lib/dados";
import { hojeISO } from "@/lib/datas";
import { brl } from "@/lib/dinheiro";
import { agrupar } from "@/lib/categorias";
import { dataCurta } from "@/lib/investimentos/formato";
import { normalizarDescricao, sugerirNomeCategoria } from "@/lib/openfinance/categorias";
import { casarComPrevista } from "@/lib/recorrencias";
import { requireUser } from "@/lib/supabase/server";
import { sincronizarAntigas } from "../conexoes/actions";
import { pluggyConfigurado } from "@/lib/openfinance/pluggy";
import { processarCaixa } from "./actions";

export const metadata = { title: "Revisar importações" };

type Tx = {
  id: string; data: string; descricao: string; valor_centavos: number; categoria_externa: string | null;
  origem: "openfinance" | "arquivo"; conta_id: string | null; cartao_id: string | null;
  contas_externas: { conta_id: string | null; nome: string } | null;
};

export default async function RevisarPage({ searchParams }: { searchParams: Promise<{ ok?: string; n?: string; p?: string; d?: string; c?: string; erro?: string }> }) {
  const sp = await searchParams;
  const { supabase } = await requireUser();
  if (pluggyConfigurado()) await sincronizarAntigas().catch(() => undefined);
  const hoje = hojeISO();

  const [{ data }, { contas, categorias, cartoes }, { previstas }, { data: historico }] = await Promise.all([
    supabase.from("transacoes_importadas").select("id,data,descricao,valor_centavos,categoria_externa,origem,conta_id,cartao_id,contas_externas(conta_id,nome)").eq("situacao", "pendente").order("data", { ascending: false }).limit(200),
    carregarContasECategorias(supabase),
    carregarPrevistas(supabase, somaDias(hoje, -45), somaDias(hoje, 15), hoje),
    supabase.from("lancamentos").select("descricao,categoria_id,tipo").not("categoria_id", "is", null).order("created_at", { ascending: false }).limit(1000),
  ]);
  const txs = (data ?? []) as unknown as Tx[];
  const nomeConta = new Map(contas.map((c) => [c.id, c.nome]));
  const nomeCartao = new Map(cartoes.map((c) => [c.id, c.nome]));

  // Aprendizado simples: a última categoria usada para a mesma descrição.
  const aprendido = new Map<string, string>();
  for (const l of historico ?? []) {
    const k = `${l.tipo}|${normalizarDescricao(l.descricao)}`;
    if (!aprendido.has(k)) aprendido.set(k, l.categoria_id as string);
  }
  const porNome = (tipo: "receita" | "despesa", nome: string) => categorias.find((c) => c.tipo === tipo && c.nome === nome && !c.arquivada)?.id;

  return (
    <>
      <Titulo sub="Movimentações de extratos importados e do Open Finance. Confira a categoria e importe — só então viram lançamentos." acao={<Link href="/importar" className="btn-sec">Importar extrato</Link>}>Revisar importações</Titulo>

      {sp.ok === "arquivo" && (
        <p role="status" className="mb-6 rounded-2xl bg-marca-clara px-4 py-3 font-semibold text-marca">
          {sp.n === "0" ? "Nenhuma movimentação nova" : `${sp.n} ${sp.n === "1" ? "movimentação nova" : "movimentações novas"} para revisar`}.
          {sp.d && sp.d !== "0" ? ` ${sp.d} já tinham sido importadas.` : ""}
          {sp.c ? ` ${sp.c} créditos do cartão (pagamentos/estornos) ficaram de fora.` : ""}
        </p>
      )}

      {sp.ok === "importadas" && (
        <p role="status" className="mb-6 rounded-2xl bg-marca-clara px-4 py-3 font-semibold text-marca">
          {sp.n} {sp.n === "1" ? "lançamento criado" : "lançamentos criados"}.{sp.p ? ` ${sp.p} ficaram para trás (sem conta vinculada ou categoria do tipo errado).` : ""}
        </p>
      )}
      {sp.ok === "ignoradas" && <p role="status" className="mb-6 rounded-2xl bg-fundo px-4 py-3 font-semibold">{sp.n} ignoradas.</p>}
      {sp.erro === "nada" && <p role="alert" className="mb-6 rounded-2xl bg-despesa/10 px-4 py-3 font-semibold text-despesa">Marque ao menos uma transação.</p>}

      {txs.length === 0 ? (
        <div className="painel flex flex-col items-center py-10 text-center">
          <Lottie src="/animacoes/sucesso.json" className="size-20" />
          <p className="mt-3 font-display text-xl font-bold">Tudo revisado.</p>
          <p className="mt-1 text-[15px] text-suave">Importe um extrato OFX ou CSV para trazer as movimentações do banco.</p>
          <Link href="/importar" className="btn mt-5">Importar extrato</Link>
        </div>
      ) : (
        <form action={processarCaixa}>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <p className="text-[15px] text-suave">{txs.length} {txs.length === 1 ? "transação" : "transações"} · todas vêm marcadas</p>
            <div className="flex gap-2">
              <button name="acao" value="ignorar" className="btn-sec">Ignorar marcadas</button>
              <button name="acao" value="importar" className="btn">Importar marcadas</button>
            </div>
          </div>
          <ul className="divide-y divide-linha overflow-hidden rounded-2xl border border-linha bg-papel">
            {txs.map((t) => {
              const entrada = t.valor_centavos > 0;
              const tipo = entrada ? "receita" : "despesa";
              const contaId = t.conta_id ?? t.contas_externas?.conta_id ?? null;
              const destino = t.cartao_id ? `${nomeCartao.get(t.cartao_id) ?? "cartão"} (cartão)` : contaId ? nomeConta.get(contaId) : null;
              const casada = casarComPrevista({ conta_id: contaId, data: t.data, valor_centavos: t.valor_centavos }, previstas);
              const sugerida =
                aprendido.get(`${tipo}|${normalizarDescricao(t.descricao)}`) ??
                porNome(tipo, sugerirNomeCategoria(t.categoria_externa, entrada)) ??
                porNome(tipo, entrada ? "Outras receitas" : "Outros gastos") ?? "";
              return (
                <li key={t.id} className="grid gap-3 px-4 py-4 sm:grid-cols-[auto_1fr_220px_auto] sm:items-center sm:px-5">
                  <input type="checkbox" name="sel" value={t.id} defaultChecked aria-label={`Marcar ${t.descricao}`} className="size-5 accent-marca" />
                  <div className="min-w-0">
                    <p className="truncate text-[15px] font-semibold">{t.descricao}</p>
                    <p className="truncate text-[13px] text-suave">
                      {dataCurta(t.data)} · {destino ?? <span className="font-semibold text-despesa">conta não vinculada</span>}
                      {t.categoria_externa && ` · banco: ${t.categoria_externa}`}
                    </p>
                    {casada && (
                      <label className="mt-1.5 flex items-center gap-2 text-[13px] font-semibold text-marca">
                        <input type="checkbox" name={`prev_${t.id}`} value={`${casada.recorrencia.id}|${casada.data}`} defaultChecked className="size-4 accent-marca" />
                        Confirmar previsto “{casada.recorrencia.descricao}” de {dataCurta(casada.data)}
                      </label>
                    )}
                  </div>
                  <select name={`cat_${t.id}`} defaultValue={sugerida} aria-label={`Categoria de ${t.descricao}`} className="campo">
                    {agrupar(categorias, tipo).map(({ mae, filhas }) =>
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
                  <p className={`whitespace-nowrap text-right text-[15px] font-bold ${entrada ? "text-receita" : ""}`}>
                    {entrada ? "+" : "−"} {brl(Math.abs(t.valor_centavos))}
                  </p>
                </li>
              );
            })}
          </ul>
          <p className="mt-3 text-[13px] text-suave">Dica: transferências entre suas próprias contas aparecem nas duas pontas — importe uma como transferência manualmente e ignore as duas aqui.</p>
        </form>
      )}
    </>
  );
}
