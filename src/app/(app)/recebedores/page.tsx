import Link from "next/link";
import { Titulo } from "@/components/titulo";
import { agrupar } from "@/lib/categorias";
import { carregarContasECategorias } from "@/lib/dados";
import { requireUser } from "@/lib/supabase/server";
import { excluirRegra, salvarRegra } from "./actions";

export const metadata = { title: "Recebedores" };

type Regra = { id: string; nome: string; tipo: "receita" | "despesa"; categoria_id: string | null; recorrencia_id: string | null; usos: number; updated_at: string };

const AVISO: Record<string, { t: string; erro?: boolean }> = {
  salva: { t: "Regra atualizada." },
  excluida: { t: "Regra excluída. Na próxima importação, esse recebedor volta a ser novo." },
  erro: { t: "Não foi possível salvar. Escolha uma categoria ou conta fixa do mesmo tipo.", erro: true },
};

export default async function RecebedoresPage({ searchParams }: { searchParams: Promise<{ ok?: string }> }) {
  const sp = await searchParams;
  const { supabase } = await requireUser();
  const [{ data }, { categorias }, { data: recs }] = await Promise.all([
    supabase.from("regras_recebedor").select("id,nome,tipo,categoria_id,recorrencia_id,usos,updated_at").order("usos", { ascending: false }).order("nome"),
    carregarContasECategorias(supabase),
    supabase.from("recorrencias").select("id,descricao,tipo,ativa").in("tipo", ["receita", "despesa"]).order("descricao"),
  ]);
  const regras = (data ?? []) as Regra[];
  const nomeCat = new Map(categorias.map((c) => [c.id, c.nome]));
  const nomeRec = new Map((recs ?? []).map((r) => [r.id as string, r.descricao as string]));
  const aviso = sp.ok ? AVISO[sp.ok] : undefined;

  return (
    <>
      <Titulo sub="Quem recebe ou manda dinheiro e o que o MyGrana já sabe sobre cada um. As regras só preenchem a revisão — você sempre confere antes de importar.">
        Recebedores
      </Titulo>
      {aviso && (
        <p role={aviso.erro ? "alert" : "status"} className={`mb-6 rounded-2xl px-4 py-3 font-semibold ${aviso.erro ? "bg-despesa/10 text-despesa" : "bg-marca-clara text-marca"}`}>{aviso.t}</p>
      )}

      {regras.length === 0 ? (
        <div className="painel max-w-2xl">
          <p className="font-display text-xl font-bold">Nenhum recebedor aprendido ainda.</p>
          <p className="mt-2 text-[15px] text-suave">
            Importe um extrato (o PDF do Bradesco traz o nome na linha “DES:” / “REM:”). Ao importar uma linha com recebedor na
            revisão, o MyGrana lembra a categoria ou a conta fixa que você escolheu.
          </p>
          <Link href="/importar" className="btn mt-5">Importar extrato</Link>
        </div>
      ) : (
        <ul className="divide-y divide-linha overflow-hidden rounded-2xl border border-linha bg-papel">
          {regras.map((r) => (
            <li key={r.id} className="grid gap-3 px-4 py-4 sm:grid-cols-[1fr_280px_auto] sm:items-center sm:px-5">
              <div className="min-w-0">
                <p className="truncate text-[15px] font-semibold">{r.nome}</p>
                <p className="truncate text-[13px] text-suave">
                  {r.tipo === "receita" ? "Manda dinheiro para você" : "Você paga"} ·{" "}
                  {r.recorrencia_id ? `conta fixa “${nomeRec.get(r.recorrencia_id) ?? "—"}”` : nomeCat.get(r.categoria_id ?? "") ?? "—"} ·{" "}
                  {r.usos} {r.usos === 1 ? "vez" : "vezes"}
                </p>
              </div>
              <form action={salvarRegra} className="flex gap-2">
                <input type="hidden" name="id" value={r.id} />
                <select name="destino" defaultValue={r.recorrencia_id ? `rec:${r.recorrencia_id}` : `cat:${r.categoria_id}`} aria-label={`Destino de ${r.nome}`} className="campo min-w-0 flex-1">
                  {(recs ?? []).filter((x) => x.tipo === r.tipo && x.ativa).length > 0 && (
                    <optgroup label="Conta fixa">
                      {(recs ?? []).filter((x) => x.tipo === r.tipo && x.ativa).map((x) => <option key={x.id} value={`rec:${x.id}`}>{x.descricao}</option>)}
                    </optgroup>
                  )}
                  {agrupar(categorias, r.tipo).map(({ mae, filhas }) => (
                    <optgroup key={mae.id} label={mae.nome}>
                      <option value={`cat:${mae.id}`}>{mae.nome}{filhas.length ? " (geral)" : ""}</option>
                      {filhas.map((f) => <option key={f.id} value={`cat:${f.id}`}>{f.nome}</option>)}
                    </optgroup>
                  ))}
                </select>
                <button className="btn-sec min-h-11 px-4 text-sm">Salvar</button>
              </form>
              <form action={excluirRegra}>
                <input type="hidden" name="id" value={r.id} />
                <button className="text-sm font-semibold text-suave hover:text-despesa" aria-label={`Excluir regra de ${r.nome}`}>Excluir</button>
              </form>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
