import Link from "next/link";
import { carregarAvisos } from "@/lib/dados-avisos";
import { hojeISO } from "@/lib/datas";
import { createClient } from "@/lib/supabase/server";
import { ICONES, LinkAtalho } from "./menu-mais";

const SINO = "M6 16V11a6 6 0 1 1 12 0v5l2 2H4zM10 20a2 2 0 0 0 4 0";

async function contar(userId: string) {
  const supabase = await createClient();
  const avisos = await carregarAvisos(supabase, userId, hojeISO()).catch(() => []);
  return { total: avisos.length, alertas: avisos.filter((a) => a.nivel === "alerta").length };
}

/** Sino do topo (celular). Renderizado dentro de <Suspense>: não atrasa a página. */
export async function SinoAvisos({ userId }: { userId: string }) {
  const { total, alertas } = await contar(userId);
  return <Sino total={total} alertas={alertas} />;
}

export function Sino({ total = 0, alertas = 0 }: { total?: number; alertas?: number }) {
  return (
    <Link href="/avisos" aria-label={total ? `Avisos: ${total}` : "Avisos"} className="relative grid size-10 place-items-center rounded-full text-suave hover:bg-fundo hover:text-tinta">
      <svg viewBox="0 0 24 24" className="size-[22px]" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={SINO} /></svg>
      {total > 0 && (
        <span className={`absolute right-1 top-1 grid min-w-[18px] place-items-center rounded-full px-1 text-[11px] font-bold leading-[18px] ${alertas ? "bg-despesa text-white" : "bg-acento text-[#0f1b17]"}`} aria-hidden="true">
          {total > 9 ? "9+" : total}
        </span>
      )}
    </Link>
  );
}

/** Atalho "Avisos" da barra lateral com contador. */
export async function AtalhoAvisos({ userId }: { userId: string }) {
  const { total } = await contar(userId);
  return <LinkAtalho a={{ href: "/avisos", rotulo: "Avisos", icone: ICONES.avisos, contador: total }} />;
}
