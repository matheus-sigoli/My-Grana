import type { SupabaseClient } from "@supabase/supabase-js";
import { hojeISO } from "@/lib/datas";
import { montarCarteira, type Ativo, type Avaliacao, type Carteira, type Cotacoes, type Operacao, type Provento } from "./calculo";
import { carregarIndices, cotacaoB3, cotacaoCripto, temTokenBrapi } from "./fontes";
import { ehCotadoB3 } from "./rotulos";

export type DadosCarteira = {
  carteira: Carteira;
  ativos: Ativo[];
  operacoes: Operacao[];
  avaliacoes: Avaliacao[];
  proventos: (Provento & { id: string; conta_id: string })[];
  hoje: string;
  avisos: { indices: boolean; semToken: boolean; semCotacao: string[] };
};

const num = (v: unknown) => (v === null || v === undefined ? null : Number(v));

/** Carrega tudo do usuário logado (RLS), busca índices e cotações em paralelo e monta a carteira. */
export async function carregarCarteira(supabase: SupabaseClient, opcoes: { incluirArquivados?: boolean } = {}): Promise<DadosCarteira> {
  const hoje = hojeISO();
  const [a, o, v, p] = await Promise.all([
    supabase.from("ativos").select("*").order("nome"),
    supabase.from("operacoes_investimento").select("*").order("data").order("created_at"),
    supabase.from("avaliacoes").select("*").order("data"),
    supabase.from("proventos").select("*").order("data"),
  ]);

  const todos = (a.data ?? []).map((x) => ({ ...x, taxa: num(x.taxa) })) as Ativo[];
  const ativos = opcoes.incluirArquivados ? todos : todos.filter((x) => !x.arquivado);
  const ids = new Set(ativos.map((x) => x.id));
  const operacoes = ((o.data ?? []) as Operacao[])
    .filter((x) => ids.has(x.ativo_id))
    .map((x) => ({ ...x, quantidade: num(x.quantidade), valor_centavos: Number(x.valor_centavos), taxas_centavos: Number(x.taxas_centavos), ir_centavos: Number(x.ir_centavos) }));
  const avaliacoes = ((v.data ?? []) as Avaliacao[]).filter((x) => ids.has(x.ativo_id)).map((x) => ({ ...x, valor_centavos: Number(x.valor_centavos) }));
  const proventos = ((p.data ?? []) as (Provento & { id: string; conta_id: string })[])
    .filter((x) => ids.has(x.ativo_id))
    .map((x) => ({ ...x, valor_centavos: Number(x.valor_centavos) }));

  const desde = operacoes[0]?.data ?? hoje;
  const precisaIndices = ativos.some((x) => x.classe === "renda_fixa");
  const tickersB3 = [...new Set(ativos.filter((x) => ehCotadoB3(x.classe) && x.ticker).map((x) => x.ticker!))];
  const criptos = [...new Set(ativos.filter((x) => x.classe === "cripto" && x.ticker).map((x) => x.ticker!))];

  const [ind, precosB3, precosCripto] = await Promise.all([
    precisaIndices ? carregarIndices(desde, hoje) : Promise.resolve({ indices: { cdi: new Map(), selic: new Map(), ipca: new Map() }, ok: true }),
    Promise.all(tickersB3.map(async (t) => [t, await cotacaoB3(t)] as const)),
    Promise.all(criptos.map(async (t) => [t, await cotacaoCripto(t)] as const)),
  ]);

  // Benchmark (CDI/inflação) também precisa dos índices quando só há renda variável.
  const indices = precisaIndices || operacoes.length === 0 ? ind : await carregarIndices(desde, hoje);

  const cotacoes: Cotacoes = new Map();
  const semCotacao: string[] = [];
  for (const [t, preco] of [...precosB3, ...precosCripto]) {
    if (preco === null) semCotacao.push(t);
    else cotacoes.set(t, preco);
  }

  const carteira = montarCarteira({ ativos, operacoes, avaliacoes, proventos, cotacoes, indices: indices.indices, hoje });
  return {
    carteira, ativos, operacoes, avaliacoes, proventos, hoje,
    avisos: { indices: !indices.ok, semToken: tickersB3.length > 0 && !temTokenBrapi(), semCotacao },
  };
}
