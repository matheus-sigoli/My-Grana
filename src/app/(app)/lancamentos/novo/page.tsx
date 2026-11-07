import Link from "next/link";
import { FormLancamento } from "@/components/form-lancamento";
import { Lottie } from "@/components/lottie";
import { Titulo } from "@/components/titulo";
import { carregarContasECategorias } from "@/lib/dados";
import { hojeISO } from "@/lib/datas";
import { requireUser } from "@/lib/supabase/server";
import type { TipoLancamento } from "@/lib/tipos";

export const metadata = { title: "Novo lançamento" };

export default async function NovoLancamentoPage({ searchParams }: { searchParams: Promise<{ tipo?: string; ok?: string }> }) {
  const sp = await searchParams;
  const { supabase } = await requireUser();
  const { contas, categorias, cartoes } = await carregarContasECategorias(supabase);
  const tipo = (["receita", "despesa", "transferencia"].includes(sp.tipo ?? "") ? sp.tipo : "despesa") as TipoLancamento;

  return (
    <div className="mx-auto max-w-xl">
      <Link href="/lancamentos" className="text-sm text-suave hover:text-marca">‹ Lançamentos</Link>
      <Titulo>Novo lançamento</Titulo>
      {sp.ok && (
        <div role="status" className="mb-4 flex items-center gap-3 rounded-2xl bg-marca-clara px-4 py-3 text-marca">
          <Lottie src="/animacoes/sucesso.json" className="size-10 shrink-0" />
          <p className="font-semibold">Lançamento salvo. Pode lançar o próximo.</p>
        </div>
      )}
      <section className="painel">
        <FormLancamento key={sp.ok ? Date.now() : "novo"} contas={contas} categorias={categorias} cartoes={cartoes} tipoInicial={tipo} hoje={hojeISO()} />
      </section>
    </div>
  );
}
