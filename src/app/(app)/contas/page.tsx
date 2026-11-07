import Link from "next/link";
import { FormConta } from "@/components/form-conta";
import { Lottie } from "@/components/lottie";
import { Titulo } from "@/components/titulo";
import { brl } from "@/lib/dinheiro";
import { requireUser } from "@/lib/supabase/server";
import { NOME_TIPO_CONTA, type SaldoConta } from "@/lib/tipos";

export const metadata = { title: "Contas" };

export default async function ContasPage() {
  const { supabase } = await requireUser();
  const { data } = await supabase.from("saldos_contas").select("*").order("arquivada").order("nome");
  const contas = (data ?? []) as SaldoConta[];
  const ativas = contas.filter((c) => !c.arquivada);
  const arquivadas = contas.filter((c) => c.arquivada);
  const total = ativas.reduce((s, c) => s + Number(c.saldo_centavos), 0);

  return (
    <>
      <Titulo sub={<>Saldo somado das contas ativas: <strong className="text-tinta">{brl(total)}</strong></>}>Contas</Titulo>
      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <section className="space-y-3">
          {ativas.length === 0 && (
            <div className="painel flex flex-col items-center py-8 text-center"><Lottie src="/animacoes/vazio.json" className="h-32 w-40" /><p className="mt-2 font-semibold">Nenhuma conta ainda.</p><p className="mt-1 text-[15px] text-suave">Crie a primeira no formulário — por exemplo, a do seu banco e a carteira.</p></div>
          )}
          {ativas.map((c) => <LinhaConta key={c.conta_id} c={c} />)}
          {arquivadas.length > 0 && (
            <details className="pt-4">
              <summary className="cursor-pointer text-sm font-medium text-suave">Arquivadas ({arquivadas.length})</summary>
              <div className="mt-3 space-y-3 opacity-70">{arquivadas.map((c) => <LinhaConta key={c.conta_id} c={c} />)}</div>
            </details>
          )}
        </section>
        <aside className="painel h-fit">
          <h2 className="mb-5 font-display text-xl font-bold tracking-[-0.01em]">Nova conta</h2>
          <FormConta />
        </aside>
      </div>
    </>
  );
}

function LinhaConta({ c }: { c: SaldoConta }) {
  const saldo = Number(c.saldo_centavos);
  return (
    <Link href={`/contas/${c.conta_id}`} className="flex items-center gap-4 rounded-2xl border border-linha bg-papel p-4 transition-colors duration-150 hover:border-tinta/25 sm:p-5">
      <span className="size-10 shrink-0 rounded-full" style={{ background: c.cor }} aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold">{c.nome}</p>
        <p className="text-xs text-suave">{NOME_TIPO_CONTA[c.tipo]}</p>
      </div>
      <p className={`whitespace-nowrap font-display text-xl font-bold tracking-[-0.01em] ${saldo < 0 ? "text-despesa" : ""}`}>{brl(saldo)}</p>
    </Link>
  );
}
