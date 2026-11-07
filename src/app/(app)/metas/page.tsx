import { FormMeta } from "@/components/form-meta";
import { Lottie } from "@/components/lottie";
import { CartaoMeta } from "@/components/painel/cartao-meta";
import { Titulo } from "@/components/titulo";
import { carregarContasECategorias } from "@/lib/dados";
import { carregarMetas } from "@/lib/dados-metas";
import { hojeISO } from "@/lib/datas";
import { brl } from "@/lib/dinheiro";
import { requireUser } from "@/lib/supabase/server";

export const metadata = { title: "Metas" };

export default async function MetasPage({ searchParams }: { searchParams: Promise<{ ok?: string }> }) {
  const sp = await searchParams;
  const { supabase } = await requireUser();
  const hoje = hojeISO();
  const [{ contas }, dados] = await Promise.all([carregarContasECategorias(supabase), carregarMetas(supabase, hoje)]);
  const nomeConta = new Map(contas.map((c) => [c.id, c.nome]));

  return (
    <>
      <Titulo sub="Objetivos com valor e prazo. O progresso vem dos seus saldos reais, não de dinheiro separado de mentira.">Metas</Titulo>
      {sp.ok === "salva" && <p role="status" className="mb-6 rounded-2xl bg-marca-clara px-4 py-3 font-semibold text-marca">Meta salva.</p>}
      {sp.ok === "excluida" && <p role="status" className="mb-6 rounded-2xl bg-fundo px-4 py-3 font-semibold">Meta excluída.</p>}

      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        <div className="space-y-6">
          <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="painel">
              <dt className="text-[13px] font-semibold text-suave">Patrimônio líquido</dt>
              <dd className="mt-1 font-display text-2xl font-bold">{brl(dados.patrimonioCentavos)}</dd>
            </div>
            <div className="painel">
              <dt className="text-[13px] font-semibold text-suave">Renda passiva (média 12 meses)</dt>
              <dd className="mt-1 font-display text-2xl font-bold">{brl(dados.rendaPassivaCentavos)}<span className="text-[15px] font-semibold text-suave">/mês</span></dd>
            </div>
          </dl>

          {dados.metas.length === 0 ? (
            <div className="painel flex flex-col items-center py-10 text-center">
              <Lottie src="/animacoes/vazio.json" className="h-32 w-40" />
              <p className="mt-2 font-display text-xl font-bold">Nenhuma meta ainda.</p>
              <p className="mt-1 max-w-sm text-[15px] text-suave">Comece por uma reserva de emergência: 6 meses do seu gasto mensal numa conta separada.</p>
            </div>
          ) : (
            <ul className="grid gap-3 sm:grid-cols-2">
              {dados.metas.map((m) => (
                <li key={m.meta.id}>
                  <CartaoMeta {...m} contaNome={m.meta.conta_id ? nomeConta.get(m.meta.conta_id) : undefined} editar />
                </li>
              ))}
            </ul>
          )}
        </div>

        <aside className="painel h-fit">
          <h2 className="mb-4 font-display text-xl font-bold">Nova meta</h2>
          <FormMeta contas={contas} />
        </aside>
      </div>
    </>
  );
}
