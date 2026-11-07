import { Simuladores } from "@/components/simuladores";
import { Titulo } from "@/components/titulo";
import { deslocaMes, hojeISO } from "@/lib/datas";
import { requireUser } from "@/lib/supabase/server";

export const metadata = { title: "Simuladores" };

export default async function SimuladoresPage() {
  const { supabase } = await requireUser();
  const mes = hojeISO().slice(0, 7);
  const de = `${deslocaMes(mes, -6)}-01`;
  // Sugestões para preencher a independência financeira: saldo das contas e gasto médio dos últimos 6 meses completos.
  const [{ data: saldos }, { data: desp }] = await Promise.all([
    supabase.from("saldos_contas").select("saldo_centavos").eq("arquivada", false),
    supabase.from("lancamentos").select("valor_centavos,competencia").eq("tipo", "despesa").eq("status", "efetivado").gte("competencia", de).lt("competencia", `${mes}-01`),
  ]);
  const patrimonio = (saldos ?? []).reduce((s, c) => s + Number(c.saldo_centavos), 0);
  const meses = new Set((desp ?? []).map((d) => String(d.competencia).slice(0, 7))).size;
  const gastoMedio = meses ? Math.round((desp ?? []).reduce((s, d) => s + Number(d.valor_centavos), 0) / meses) : 0;

  return (
    <>
      <Titulo sub="Faça as contas antes de decidir. Nada aqui é salvo — mexa à vontade.">Simuladores</Titulo>
      <Simuladores patrimonioAtual={patrimonio} gastoMedio={gastoMedio} />
    </>
  );
}
