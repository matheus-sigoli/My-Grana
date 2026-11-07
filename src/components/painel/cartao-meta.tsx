import Link from "next/link";
import { brl } from "@/lib/dinheiro";
import { NOME_TIPO_META, type Meta } from "@/lib/planejamento";

type Props = {
  meta: Meta;
  atual: number;
  pct: number;
  faltaCentavos: number;
  concluida: boolean;
  vencida: boolean;
  porMesCentavos: number | null;
  contaNome?: string;
  editar?: boolean;
};

const dataBR = (iso: string) => iso.split("-").reverse().join("/");

/** Cartão de uma meta, usado na página de metas e no painel. */
export function CartaoMeta({ meta, atual, pct, faltaCentavos, concluida, vencida, porMesCentavos, contaNome, editar }: Props) {
  const corpo = (
    <>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-[15px] font-semibold">{meta.nome}</p>
          <p className="truncate text-[13px] text-suave">
            {NOME_TIPO_META[meta.tipo]}{contaNome ? ` · ${contaNome}` : ""}{meta.prazo ? ` · até ${dataBR(meta.prazo)}` : ""}
          </p>
        </div>
        <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-[13px] font-bold ${concluida ? "bg-receita text-white" : vencida ? "bg-despesa text-white" : "bg-marca-clara text-marca"}`}>
          {concluida ? "Concluída" : `${pct}%`}
        </span>
      </div>
      <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-fundo" aria-hidden="true">
        <div className={`h-full rounded-full ${concluida ? "bg-receita" : "bg-marca"}`} style={{ width: `${Math.max(2, pct)}%` }} />
      </div>
      <p className="mt-2 text-[13px] text-suave">
        <strong className="text-tinta">{brl(Math.max(0, atual))}</strong> de {brl(meta.valor_alvo_centavos)}
        {meta.tipo === "renda_passiva" ? " por mês" : ""}
        {!concluida && (porMesCentavos ? ` · guarde ${brl(porMesCentavos)}/mês` : vencida ? " · prazo passou" : ` · faltam ${brl(faltaCentavos)}`)}
      </p>
    </>
  );
  return editar ? (
    <Link href={`/metas/${meta.id}`} className="block rounded-2xl border border-linha bg-papel p-4 hover:border-marca">{corpo}</Link>
  ) : (
    <div className="rounded-xl bg-fundo p-4">{corpo}</div>
  );
}
