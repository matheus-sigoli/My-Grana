import Link from "next/link";
import { BotaoPush } from "@/components/botao-push";
import { Lottie } from "@/components/lottie";
import { Titulo } from "@/components/titulo";
import { carregarAvisos } from "@/lib/dados-avisos";
import { hojeISO } from "@/lib/datas";
import { pushConfigurado } from "@/lib/push";
import { requireUser } from "@/lib/supabase/server";

export const metadata = { title: "Avisos" };

export default async function AvisosPage() {
  const { supabase, user } = await requireUser();
  const avisos = await carregarAvisos(supabase, user.id, hojeISO());
  const chave = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";

  return (
    <>
      <Titulo sub="Faturas e contas que vencem, orçamentos no limite e saldos negativos.">Avisos</Titulo>
      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <section aria-label="Avisos de hoje">
          {avisos.length === 0 ? (
            <div className="painel flex flex-col items-center py-10 text-center">
              <Lottie src="/animacoes/sucesso.json" className="size-20" />
              <p className="mt-3 font-display text-xl font-bold">Tudo em dia.</p>
              <p className="mt-1 text-[15px] text-suave">Nenhuma conta vencendo nem orçamento no limite.</p>
            </div>
          ) : (
            <ul className="space-y-3">
              {avisos.map((a) => (
                <li key={a.id}>
                  <Link href={a.href} className={`flex items-start gap-3 rounded-2xl border bg-papel p-4 hover:border-marca ${a.nivel === "alerta" ? "border-despesa/40" : "border-linha"}`}>
                    <span className={`mt-1.5 size-2.5 shrink-0 rounded-full ${a.nivel === "alerta" ? "bg-despesa" : "bg-acento"}`} aria-hidden="true" />
                    <span className="min-w-0">
                      <span className="block text-[15px] font-semibold">{a.titulo}</span>
                      <span className="block text-[13px] text-suave">{a.texto}</span>
                    </span>
                    <span className="sr-only">{a.nivel === "alerta" ? "(urgente)" : ""}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
        <aside className="painel h-fit">
          <h2 className="font-display text-xl font-bold">No celular</h2>
          <p className="mb-4 mt-1 text-[15px] text-suave">Receba um resumo por dia quando houver algo para resolver.</p>
          {pushConfigurado() ? <BotaoPush chavePublica={chave} /> : <p className="text-[15px] text-suave">As notificações no celular chegam em breve. Por enquanto, os avisos aparecem aqui e no sino do topo.</p>}
        </aside>
      </div>
    </>
  );
}
