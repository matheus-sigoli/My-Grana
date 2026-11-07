import Link from "next/link";
import { FormImportar } from "@/components/form-importar";
import { Titulo } from "@/components/titulo";
import { carregarContasECategorias } from "@/lib/dados";
import { requireUser } from "@/lib/supabase/server";

export const metadata = { title: "Importar extrato" };

export default async function ImportarPage() {
  const { supabase } = await requireUser();
  const { contas, cartoes } = await carregarContasECategorias(supabase);
  const ativas = contas.filter((c) => !c.arquivada).map((c) => ({ id: c.id, nome: c.nome }));
  const cards = cartoes.filter((c) => !c.arquivado).map((c) => ({ id: c.id, nome: c.nome }));

  return (
    <>
      <Titulo sub="Traga o extrato do banco em vez de digitar tudo. Nada é lançado sem você revisar.">Importar extrato</Titulo>
      <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
        <section className="painel">
          {ativas.length === 0 ? (
            <p className="text-[15px]">Cadastre uma <Link href="/contas" className="link">conta</Link> antes de importar.</p>
          ) : (
            <FormImportar contas={ativas} cartoes={cards} />
          )}
        </section>
        <section className="painel">
          <h2 className="font-display text-xl font-bold">Como funciona</h2>
          <ol className="mt-4 space-y-3 text-[15px]">
            {[
              ["Leitura", "Lemos data, descrição e valor de cada movimentação do PDF, OFX ou CSV. O arquivo não fica guardado."],
              ["Revisão", "As linhas vão para Revisar importações, com a categoria sugerida pelo seu histórico. No PDF, confira os valores: cada banco monta o arquivo de um jeito."],
              ["Sem duplicar", "Importou o mesmo extrato de novo? As linhas repetidas são ignoradas."],
              ["Fatura do cartão", "Compras viram despesas na fatura certa; pagamentos e estornos ficam de fora."],
            ].map(([t, d], i) => (
              <li key={t} className="flex gap-3">
                <span className="grid size-7 shrink-0 place-items-center rounded-full bg-marca-clara text-[13px] font-bold text-marca">{i + 1}</span>
                <span><strong>{t}.</strong> <span className="text-suave">{d}</span></span>
              </li>
            ))}
          </ol>
        </section>
      </div>
    </>
  );
}
