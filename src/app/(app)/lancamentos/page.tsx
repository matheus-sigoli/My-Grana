import Link from "next/link";
import { LinhaLancamento } from "@/components/linha-lancamento";
import { Lottie } from "@/components/lottie";
import { SeletorMes } from "@/components/seletor-mes";
import { Titulo } from "@/components/titulo";
import { carregarContasECategorias } from "@/lib/dados";
import { intervaloMes, mesOuAtual } from "@/lib/datas";
import { brl } from "@/lib/dinheiro";
import { ehUuid } from "@/lib/seguranca";
import { requireUser } from "@/lib/supabase/server";
import type { Lancamento } from "@/lib/tipos";

export const metadata = { title: "Lançamentos" };

const DIA = new Intl.DateTimeFormat("pt-BR", { weekday: "long", day: "2-digit", month: "long", timeZone: "UTC" });

export default async function LancamentosPage({
  searchParams,
}: {
  searchParams: Promise<{ mes?: string; conta?: string; cartao?: string; tipo?: string; q?: string }>;
}) {
  const sp = await searchParams;
  const mes = mesOuAtual(sp.mes);
  const { inicio, fim } = intervaloMes(mes);
  const { supabase } = await requireUser();

  // O mês segue a competência: compras no cartão aparecem no mês da fatura.
  let q = supabase.from("lancamentos").select("*").eq("competencia", inicio)
    .order("data", { ascending: false }).order("created_at", { ascending: false });
  if (ehUuid(sp.conta)) q = q.or(`conta_id.eq.${sp.conta},conta_destino_id.eq.${sp.conta}`);
  if (sp.tipo && ["receita", "despesa", "transferencia"].includes(sp.tipo)) q = q.eq("tipo", sp.tipo);
  const busca = (sp.q ?? "").slice(0, 60).replace(/[%_,()\\*]/g, "").trim();
  if (busca) q = q.ilike("descricao", `%${busca}%`);

  if (ehUuid(sp.cartao)) q = q.eq("cartao_id", sp.cartao);
  const [{ data }, { contas, categorias, cartoes }] = await Promise.all([q, carregarContasECategorias(supabase)]);
  const mapaCartoes = new Map(cartoes.map((c) => [c.id, c]));
  const lancs = (data ?? []) as Lancamento[];
  const mapaContas = new Map(contas.map((c) => [c.id, c]));
  const mapaCats = new Map(categorias.map((c) => [c.id, c]));

  const receitas = lancs.filter((l) => l.tipo === "receita").reduce((s, l) => s + l.valor_centavos, 0);
  const despesas = lancs.filter((l) => l.tipo === "despesa").reduce((s, l) => s + l.valor_centavos, 0);

  const porDia = new Map<string, Lancamento[]>();
  for (const l of lancs) porDia.set(l.data, [...(porDia.get(l.data) ?? []), l]);

  const filtros = new URLSearchParams();
  if (sp.conta) filtros.set("conta", sp.conta);
  if (sp.cartao) filtros.set("cartao", sp.cartao);
  if (sp.tipo) filtros.set("tipo", sp.tipo);
  if (sp.q) filtros.set("q", sp.q);
  const base = `/lancamentos${filtros.size ? `?${filtros}` : ""}`;

  return (
    <>
      <Titulo acao={<Link href="/lancamentos/novo" className="btn">Novo lançamento</Link>}>Lançamentos</Titulo>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <SeletorMes mes={mes} base={base} />
        <form className="flex flex-1 flex-wrap gap-2" action="/lancamentos" role="search">
          <input type="hidden" name="mes" value={mes} />
          <select name="conta" aria-label="Conta" defaultValue={sp.conta ?? ""} className="campo w-auto">
            <option value="">Todas as contas</option>
            {contas.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
          </select>
          <select name="tipo" aria-label="Tipo" defaultValue={sp.tipo ?? ""} className="campo w-auto">
            <option value="">Todos os tipos</option>
            <option value="despesa">Despesas</option>
            <option value="receita">Receitas</option>
            <option value="transferencia">Transferências</option>
          </select>
          <input name="q" type="search" aria-label="Buscar na descrição" defaultValue={sp.q} placeholder="Buscar descrição…" maxLength={60} className="campo w-40 flex-1" />
          <button className="btn-sec">Filtrar</button>
        </form>
      </div>

      <div className="mb-6 grid grid-cols-3 gap-3">
        <Resumo rotulo="Entrou" valor={receitas} cor="text-receita" />
        <Resumo rotulo="Saiu" valor={despesas} cor="text-despesa" />
        <Resumo rotulo="Sobrou" valor={receitas - despesas} cor={receitas - despesas < 0 ? "text-despesa" : "text-marca"} />
      </div>

      {lancs.length === 0 ? (
        <div className="painel flex flex-col items-center py-10 text-center">
          <Lottie src="/animacoes/vazio.json" className="h-36 w-44" />
          <p className="mt-3 font-display text-xl font-bold">{filtros.size ? "Nada encontrado com esses filtros." : "Nada lançado neste mês."}</p>
          <p className="mt-1 text-[15px] text-suave">{filtros.size ? "Tente outro mês ou limpe os filtros." : "Comece registrando um gasto ou uma receita."}</p>
          {filtros.size ? <Link href={`/lancamentos?mes=${mes}`} className="btn-sec mt-5">Limpar filtros</Link> : <Link href="/lancamentos/novo" className="btn mt-5">Novo lançamento</Link>}
        </div>
      ) : (
        <div className="space-y-4">
          {[...porDia.entries()].map(([dia, itens]) => (
            <section key={dia} className="overflow-hidden rounded-2xl border border-linha bg-papel">
              <h2 className="bg-fundo/70 px-4 py-2 text-[13px] font-semibold text-suave first-letter:uppercase sm:px-5">
                {DIA.format(new Date(`${dia}T00:00:00Z`))}
              </h2>
              <div className="divide-y divide-linha">
                {itens.map((l) => <LinhaLancamento key={l.id} l={l} contas={mapaContas} cats={mapaCats} cartoes={mapaCartoes} />)}
              </div>
            </section>
          ))}
        </div>
      )}
    </>
  );
}

function Resumo({ rotulo, valor, cor }: { rotulo: string; valor: number; cor: string }) {
  return (
    <div className="painel p-4">
      <p className="text-[13px] font-medium text-suave">{rotulo}</p>
      <p className={`mt-1 truncate font-display text-lg font-bold tracking-[-0.01em] sm:text-2xl ${cor}`}>{brl(valor)}</p>
    </div>
  );
}
