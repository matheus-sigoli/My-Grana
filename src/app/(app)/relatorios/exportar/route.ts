import { NextResponse, type NextRequest } from "next/server";
import { carregarContasECategorias } from "@/lib/dados";
import { carregarAno } from "@/lib/dados-relatorio";
import { hojeISO } from "@/lib/datas";
import { balancoAnual, celulaCsv } from "@/lib/relatorio";
import { createClient } from "@/lib/supabase/server";

const MESES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

/** CSV do ano para Excel (pt-BR: ";" e vírgula decimal, com BOM para acentos). Só leitura, só dados do usuário (RLS). */
export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new NextResponse("Não autorizado", { status: 401 });
  const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (aal?.nextLevel === "aal2" && aal.currentLevel !== "aal2") return new NextResponse("Confirme o código do autenticador", { status: 401 });

  const anoAtual = Number(hojeISO().slice(0, 4));
  const pedido = Number(req.nextUrl.searchParams.get("ano"));
  const ano = Number.isInteger(pedido) && pedido >= 2000 && pedido <= anoAtual + 1 ? pedido : anoAtual;
  const inicio = `${ano}-01-01`, fim = `${ano + 1}-01-01`;

  const [{ contas, categorias, cartoes }, dados, { data: lancs }] = await Promise.all([
    carregarContasECategorias(supabase),
    carregarAno(supabase, ano),
    supabase.from("lancamentos").select("data,competencia,tipo,status,descricao,valor_centavos,categoria_id,conta_id,cartao_id,conta_destino_id,parcela,total_parcelas")
      .gte("competencia", inicio).lt("competencia", fim).order("data").limit(20000),
  ]);
  const b = balancoAnual(dados.lancs, ano, categorias);
  const nomeCat = new Map(categorias.map((c) => [c.id, c.nome]));
  const nomeConta = new Map([...contas.map((c) => [c.id, c.nome] as const), ...cartoes.map((c) => [c.id, `${c.nome} (cartão)`] as const)]);
  const linha = (...cs: (string | number)[]) => cs.map(celulaCsv).join(";");

  const out = [
    linha(`MyGrana — relatório de ${ano}`),
    "",
    linha("Mês", "Receitas", "Despesas", "Resultado"),
    ...b.meses.map((m, i) => linha(MESES[i], m.receitas, m.despesas, m.resultado)),
    linha("Total", b.receitas, b.despesas, b.resultado),
    "",
    linha("Categoria", "Tipo", "Total"),
    ...b.categorias.map((c) => linha(c.nome, c.tipo === "receita" ? "Receita" : "Despesa", c.total)),
    "",
    linha("Data", "Mês da fatura/competência", "Tipo", "Situação", "Descrição", "Categoria", "Conta ou cartão", "Destino", "Parcela", "Valor"),
    ...(lancs ?? []).map((l) => linha(
      String(l.data).split("-").reverse().join("/"),
      String(l.competencia).slice(0, 7),
      l.tipo === "receita" ? "Receita" : l.tipo === "despesa" ? "Despesa" : "Transferência",
      l.status === "efetivado" ? "Efetivado" : "Previsto",
      String(l.descricao),
      nomeCat.get(l.categoria_id as string) ?? "",
      nomeConta.get((l.cartao_id ?? l.conta_id) as string) ?? "",
      nomeConta.get(l.conta_destino_id as string) ?? "",
      l.parcela ? `${l.parcela}/${l.total_parcelas}` : "",
      (l.tipo === "despesa" ? -1 : 1) * Number(l.valor_centavos),
    )),
  ].join("\r\n");

  return new NextResponse(`﻿${out}`, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="mygrana-${ano}.csv"`,
      "cache-control": "no-store",
    },
  });
}
