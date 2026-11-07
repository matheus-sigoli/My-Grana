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
import { faturasDoCartao } from "@/lib/cartoes";
import { carregarComprasEPagamentos } from "@/lib/dados-cartoes";
import { chaveRecebedor, ehPagamentoFatura, faturasCandidatas } from "@/lib/fatura-importada";
import { nomeMes } from "@/lib/datas";
import { requireUser } from "@/lib/supabase/server";
import { sincronizarAntigas } from "../conexoes/actions";
import { pluggyConfigurado } from "@/lib/openfinance/pluggy";
import { processarCaixa } from "./actions";

export const metadata = { title: "Revisar importações" };

type Tx = {
  id: string; data: string; descricao: string; valor_centavos: number; categoria_externa: string | null;
  origem: "openfinance" | "arquivo"; conta_id: string | null; cartao_id: string | null; recebedor: string | null;
  contas_externas: { conta_id: string | null; nome: string } | null;
};

export default async function RevisarPage({ searchParams }: { searchParams: Promise<{ ok?: string; n?: string; p?: string; d?: string; c?: string; r?: string; f?: string; erro?: string }> }) {
  const sp = await searchParams;
  const { supabase } = await requireUser();
  if (pluggyConfigurado()) await sincronizarAntigas().catch(() => undefined);
  const hoje = hojeISO();

  const [{ data }, { contas, categorias, cartoes }, { previstas }, { data: historico }, { compras, pagamentos }, { data: regrasData }] = await Promise.all([
    supabase.from("transacoes_importadas").select("id,data,descricao,valor_centavos,categoria_externa,origem,conta_id,cartao_id,recebedor,contas_externas(conta_id,nome)").eq("situacao", "pendente").order("data", { ascending: false }).limit(200),
    carregarContasECategorias(supabase),
    carregarPrevistas(supabase, somaDias(hoje, -45), somaDias(hoje, 15), hoje),
    supabase.from("lancamentos").select("descricao,categoria_id,tipo").not("categoria_id", "is", null).order("created_at", { ascending: false }).limit(1000),
    carregarComprasEPagamentos(supabase),
    supabase.from("regras_recebedor").select("chave,nome,tipo,categoria_id,recorrencia_id"),
  ]);
  // Regras de recebedor (ADR-0012) e saldo em aberto de cada fatura (para escolher a fatura que o pagamento quita).
  const regras = new Map((regrasData ?? []).map((r) => [`${r.tipo}|${r.chave}`, r]));
  const restantes = new Map<string, number>();
  for (const c of cartoes) for (const f of faturasDoCartao(c, compras, pagamentos, hoje)) restantes.set(`${c.id}|${f.fatura}`, f.restanteCentavos);
  const restante = (cartaoId: string, fatura: string) => restantes.get(`${cartaoId}|${fatura}`) ?? 0;
  const mesCurto = (f: string) => nomeMes(f.slice(0, 7));
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
          {sp.r ? ` ${sp.r} ${sp.r === "1" ? "linha ganhou" : "linhas ganharam"} o nome do recebedor.` : ""}
        </p>
      )}

      {sp.ok === "importadas" && (
        <p role="status" className="mb-6 rounded-2xl bg-marca-clara px-4 py-3 font-semibold text-marca">
          {sp.n} {sp.n === "1" ? "lançamento criado" : "lançamentos criados"}.{sp.f && sp.f !== "0" ? ` ${sp.f} ${sp.f === "1" ? "pagamento de fatura registrado" : "pagamentos de fatura registrados"}.` : ""}{sp.p ? ` ${sp.p} ficaram para trás (sem conta vinculada ou categoria do tipo errado).` : ""}
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
              // 1) Pagamento de fatura reconhecido (só em extrato de conta)
              const fatura = !t.cartao_id && ehPagamentoFatura(t.descricao, t.valor_centavos)
                ? faturasCandidatas({ contaId, data: t.data, valorCentavos: t.valor_centavos }, cartoes, restante)
                : null;
              // 2) Regra de recebedor: categoria e/ou conta fixa
              const regra = t.recebedor ? regras.get(`${tipo}|${chaveRecebedor(t.recebedor)}`) : undefined;
              const prevDaRegra = regra?.recorrencia_id
                ? previstas.find((o) => o.recorrencia.id === regra.recorrencia_id && Math.abs(Date.parse(o.data) - Date.parse(t.data)) <= 7 * 86_400_000)
                : undefined;
              const casada = prevDaRegra ?? casarComPrevista({ conta_id: contaId, data: t.data, valor_centavos: t.valor_centavos }, previstas);
              const sugerida =
                (regra?.categoria_id as string | undefined) ??
                aprendido.get(`${tipo}|${normalizarDescricao(t.descricao)}`) ??
                porNome(tipo, sugerirNomeCategoria(t.categoria_externa, entrada)) ??
                porNome(tipo, entrada ? "Outras receitas" : "Outros gastos") ?? "";
              return (
                <li key={t.id} className="grid gap-3 px-4 py-4 sm:grid-cols-[auto_1fr_220px_auto] sm:items-center sm:px-5">
                  <input type="checkbox" name="sel" value={t.id} defaultChecked aria-label={`Marcar ${t.descricao}`} className="size-5 accent-marca" />
                  <div className="min-w-0">
                    <p className="truncate text-[15px] font-semibold">
                      {t.descricao}{t.recebedor && <span className="font-normal text-suave"> · {t.recebedor}</span>}
                    </p>
                    <p className="truncate text-[13px] text-suave">
                      {dataCurta(t.data)} · {destino ?? <span className="font-semibold text-despesa">conta não vinculada</span>}
                      {t.categoria_externa && ` · banco: ${t.categoria_externa}`}
                    </p>
                    {fatura && (
                      <p className="mt-1.5 text-[13px] font-semibold text-marca">Pagamento de fatura: não conta como gasto (as compras já estão no cartão).</p>
                    )}
                    {regra && !fatura && (
                      <p className="mt-1.5 text-[13px] font-semibold text-marca">Reconhecido: {regra.nome}</p>
                    )}
                    {casada && !fatura && (
                      <label className="mt-1.5 flex items-center gap-2 text-[13px] font-semibold text-marca">
                        <input type="checkbox" name={`prev_${t.id}`} value={`${casada.recorrencia.id}|${casada.data}`} defaultChecked className="size-4 accent-marca" />
                        Confirmar previsto “{casada.recorrencia.descricao}” de {dataCurta(casada.data)}
                      </label>
                    )}
                  </div>
                  <select name={`cat_${t.id}`} defaultValue={fatura?.length ? `fat:${fatura[0].cartaoId}|${fatura[0].fatura}` : sugerida} aria-label={`Destino de ${t.descricao}`} className="campo">
                    {fatura && (
                      <optgroup label="Pagar fatura">
                        {(fatura.length ? fatura : cartoes.filter((c) => !c.arquivado).map((c) => ({ cartaoId: c.id, cartao: c.nome, fatura: `${t.data.slice(0, 7)}-01` }))).map((f) => (
                          <option key={`${f.cartaoId}|${f.fatura}`} value={`fat:${f.cartaoId}|${f.fatura}`}>{f.cartao} · fatura de {mesCurto(f.fatura)}</option>
                        ))}
                      </optgroup>
                    )}
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
