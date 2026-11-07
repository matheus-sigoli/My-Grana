import Link from "next/link";
import { FormAtivo } from "@/components/investimentos/form-ativo";
import { Titulo } from "@/components/titulo";
import { hojeISO } from "@/lib/datas";
import { requireUser } from "@/lib/supabase/server";
import type { Conta } from "@/lib/tipos";

export const metadata = { title: "Novo investimento" };

export default async function NovoInvestimentoPage() {
  const { supabase } = await requireUser();
  const { data } = await supabase.from("contas").select("*").order("nome");
  return (
    <div className="mx-auto max-w-2xl">
      <Link href="/investimentos" className="text-sm text-suave hover:text-marca">‹ Carteira</Link>
      <Titulo sub="Cada aplicação de renda fixa é um título próprio, com taxa e vencimento.">Novo investimento</Titulo>
      <section className="painel">
        <FormAtivo contas={(data ?? []) as Conta[]} hoje={hojeISO()} />
      </section>
    </div>
  );
}
