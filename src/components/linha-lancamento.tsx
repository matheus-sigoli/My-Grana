import Link from "next/link";
import { brl } from "@/lib/dinheiro";
import type { Cartao } from "@/lib/cartoes";
import type { Categoria, Conta, Lancamento } from "@/lib/tipos";

export function LinhaLancamento({
  l,
  contas,
  cats,
  cartoes,
}: {
  l: Lancamento;
  contas: Map<string, Conta>;
  cats: Map<string, Categoria>;
  cartoes?: Map<string, Cartao>;
}) {
  const conta = l.conta_id ? contas.get(l.conta_id) : null;
  const cartao = l.cartao_id ? cartoes?.get(l.cartao_id) : null;
  const origem = cartao ? `${cartao.nome}${l.total_parcelas ? ` · ${l.parcela}/${l.total_parcelas}` : ""}` : conta?.nome ?? "?";
  const destino = l.conta_destino_id ? contas.get(l.conta_destino_id) : null;
  const cat = l.categoria_id ? cats.get(l.categoria_id) : null;
  const mae = cat?.parent_id ? cats.get(cat.parent_id) : null;
  const sinal = l.tipo === "receita" ? "+" : l.tipo === "despesa" ? "−" : "";
  const cor = l.tipo === "receita" ? "text-receita" : l.tipo === "despesa" ? "text-tinta" : "text-transf";

  return (
    <Link href={`/lancamentos/${l.id}`} className="flex min-h-16 items-center gap-3 px-4 py-3 transition-colors duration-150 hover:bg-fundo focus-visible:bg-fundo sm:px-5">
      <span
        className="grid size-9 shrink-0 place-items-center rounded-full text-xs font-bold text-white"
        style={{ background: l.tipo === "transferencia" ? "#475569" : cat?.cor ?? "#94a3b8" }}
        aria-hidden
      >
        {l.tipo === "transferencia" ? "⇄" : (mae?.nome ?? cat?.nome ?? "?").slice(0, 1)}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[15px] font-semibold">{l.descricao}</p>
        <p className="truncate text-[13px] text-suave">
          {l.tipo === "transferencia"
            ? `${conta?.nome ?? "?"} → ${destino?.nome ?? "?"}`
            : `${mae ? `${mae.nome} › ` : ""}${cat?.nome ?? "Sem categoria"} · ${origem}`}
        </p>
      </div>
      <p className={`whitespace-nowrap text-[15px] font-bold ${cor}`}>
        {sinal} {brl(l.valor_centavos)}
      </p>
    </Link>
  );
}
