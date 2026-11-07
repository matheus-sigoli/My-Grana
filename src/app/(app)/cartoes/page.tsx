import Link from "next/link";
import { FormCartao } from "@/components/cartoes/form-cartao";
import { Lottie } from "@/components/lottie";
import { Titulo } from "@/components/titulo";
import { resumoDoCartao, type StatusFatura } from "@/lib/cartoes";
import { carregarContasECategorias } from "@/lib/dados";
import { carregarComprasEPagamentos } from "@/lib/dados-cartoes";
import { hojeISO } from "@/lib/datas";
import { brl } from "@/lib/dinheiro";
import { requireUser } from "@/lib/supabase/server";

export const metadata = { title: "Cartões" };

const ROTULO_STATUS: Record<StatusFatura, string> = {
  aberta: "aberta", futura: "futura", fechada: "fechada", paga: "paga", vencida: "vencida", vazia: "sem compras",
};
const ddmm = (iso: string) => iso.split("-").reverse().slice(0, 2).join("/");

export default async function CartoesPage() {
  const { supabase } = await requireUser();
  const hoje = hojeISO();
  const [{ contas, cartoes }, { compras, pagamentos }] = await Promise.all([carregarContasECategorias(supabase), carregarComprasEPagamentos(supabase)]);
  const ativos = cartoes.filter((c) => !c.arquivado);
  const arquivados = cartoes.filter((c) => c.arquivado);
  const resumos = ativos.map((c) => ({ c, r: resumoDoCartao(c, compras, pagamentos, hoje) }));
  const divida = resumos.reduce((s, { r }) => s + r.usadoCentavos, 0);

  return (
    <>
      <Titulo sub={ativos.length ? <>Total comprometido nos cartões: <strong className="text-tinta">{brl(divida)}</strong> (inclui parcelas futuras)</> : "Cadastre seus cartões para acompanhar faturas, limite e parcelas."}>
        Cartões
      </Titulo>
      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        <section className="space-y-4">
          {ativos.length === 0 && (
            <div className="painel flex flex-col items-center py-8 text-center">
              <Lottie src="/animacoes/vazio.json" className="h-32 w-40" />
              <p className="mt-2 font-semibold">Nenhum cartão ainda.</p>
              <p className="mt-1 text-[15px] text-suave">Com o dia de fechamento e vencimento, o MyGrana coloca cada compra na fatura certa.</p>
            </div>
          )}
          {resumos.map(({ c, r }) => {
            const uso = c.limite_centavos > 0 ? Math.min(1, r.usadoCentavos / c.limite_centavos) : 0;
            const f = r.aPagar ?? r.aberta;
            return (
              <Link key={c.id} href={`/cartoes/${c.id}`} className="block rounded-2xl border border-linha bg-papel p-5 transition-colors hover:border-tinta/25">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="flex items-center gap-2 font-display text-xl font-bold"><span className="size-3 rounded-full" style={{ background: c.cor }} aria-hidden="true" />{c.nome}</p>
                    <p className="text-[13px] text-suave">fecha dia {c.dia_fechamento} · vence dia {c.dia_vencimento}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-display text-2xl font-bold tracking-[-0.01em]">{brl(f.restanteCentavos || f.totalCentavos)}</p>
                    <p className={`text-[13px] ${f.status === "vencida" ? "font-bold text-despesa" : "text-suave"}`}>
                      fatura {ROTULO_STATUS[f.status]} · vence {ddmm(f.vencimento)}
                    </p>
                  </div>
                </div>
                {c.limite_centavos > 0 && (
                  <div className="mt-4">
                    <div className="h-2 overflow-hidden rounded-full bg-fundo" aria-hidden="true">
                      <div className={`h-full rounded-full ${uso > 0.8 ? "bg-despesa" : "bg-marca"}`} style={{ width: `${Math.max(1, uso * 100)}%` }} />
                    </div>
                    <p className="mt-1.5 text-[13px] text-suave">
                      {brl(r.disponivelCentavos)} disponíveis de {brl(c.limite_centavos)}
                    </p>
                  </div>
                )}
              </Link>
            );
          })}
          {arquivados.length > 0 && (
            <details>
              <summary className="cursor-pointer text-[15px] font-semibold text-suave">Arquivados ({arquivados.length})</summary>
              <ul className="mt-2 space-y-2">{arquivados.map((c) => <li key={c.id}><Link href={`/cartoes/${c.id}`} className="link">{c.nome}</Link></li>)}</ul>
            </details>
          )}
        </section>
        <aside className="painel h-fit">
          <h2 className="mb-4 font-display text-xl font-bold">Novo cartão</h2>
          <FormCartao contas={contas} />
        </aside>
      </div>
    </>
  );
}
