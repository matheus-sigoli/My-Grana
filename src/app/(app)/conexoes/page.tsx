import Link from "next/link";
import { BotaoConfirmar } from "@/components/confirmar";
import { BotaoConectar } from "@/components/openfinance/botao-conectar";
import { Titulo } from "@/components/titulo";
import { brl } from "@/lib/dinheiro";
import { pluggyConfigurado } from "@/lib/openfinance/pluggy";
import { requireUser } from "@/lib/supabase/server";
import type { Conta } from "@/lib/tipos";
import { removerConexao, sincronizar, vincularConta } from "./actions";

export const metadata = { title: "Open Finance" };

const MSG: Record<string, string> = {
  sync: "Sincronizado. As transações novas estão na caixa de entrada.",
  vinculo: "Vínculo salvo. Sincronize para trazer as transações.",
  removida: "Conexão removida e acesso revogado na Pluggy.",
};

const DATA_HORA = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" });

export default async function ConexoesPage({ searchParams }: { searchParams: Promise<{ ok?: string; erro?: string }> }) {
  const sp = await searchParams;
  const { supabase } = await requireUser();
  const [{ data: conexoes }, { data: externas }, { data: contasData }, { count: pendentes }] = await Promise.all([
    supabase.from("conexoes_bancarias").select("*").order("created_at"),
    supabase.from("contas_externas").select("*").order("nome"),
    supabase.from("contas").select("*").eq("arquivada", false).order("nome"),
    supabase.from("transacoes_importadas").select("id", { count: "exact", head: true }).eq("situacao", "pendente"),
  ]);
  const contas = (contasData ?? []) as Conta[];
  const configurado = pluggyConfigurado();

  return (
    <>
      <Titulo
        sub="Conecte seu banco pelo Open Finance para trazer as movimentações sem digitar."
        acao={configurado ? <BotaoConectar /> : undefined}
      >
        Open Finance
      </Titulo>

      {sp.ok && MSG[sp.ok] && <p role="status" className="mb-6 rounded-2xl bg-marca-clara px-4 py-3 font-semibold text-marca">{MSG[sp.ok]}</p>}
      {sp.erro && <p role="alert" className="mb-6 rounded-2xl bg-despesa/10 px-4 py-3 font-semibold text-despesa">Não foi possível sincronizar agora. Tente de novo em instantes.</p>}

      {(pendentes ?? 0) > 0 && (
        <Link href="/revisar" className="mb-6 flex items-center justify-between gap-4 rounded-2xl bg-acento px-5 py-4 font-bold text-[#0f1b17]">
          <span>{pendentes} {pendentes === 1 ? "transação esperando" : "transações esperando"} revisão</span>
          <span aria-hidden="true">Revisar ›</span>
        </Link>
      )}

      {!configurado && <ComoConfigurar />}

      {configurado && (conexoes ?? []).length === 0 && (
        <section className="painel max-w-2xl">
          <h2 className="font-display text-xl font-bold">Como funciona</h2>
          <ol className="mt-3 list-decimal space-y-2 pl-5 text-[15px]">
            <li>Crie sua conta grátis no <a className="link" href="https://meu.pluggy.ai" target="_blank" rel="noopener noreferrer">Meu Pluggy</a> e autorize seus bancos lá, pelo Open Finance.</li>
            <li>Aqui, clique em <strong>Conectar banco</strong> e escolha <strong>Meu Pluggy</strong> na lista.</li>
            <li>Vincule cada conta do banco a uma conta do MyGrana e sincronize.</li>
            <li>As movimentações chegam na caixa de entrada para você revisar a categoria antes de virarem lançamentos.</li>
          </ol>
          <p className="mt-4 text-[13px] text-suave">O MyGrana só lê dados. Você pode remover a conexão a qualquer momento e o acesso é revogado.</p>
        </section>
      )}

      <div className="space-y-6">
        {(conexoes ?? []).map((cx) => {
          const minhas = (externas ?? []).filter((e) => e.conexao_id === cx.id);
          return (
            <section key={cx.id} className="painel">
              <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="font-display text-xl font-bold">{cx.instituicao}</h2>
                  <p className="text-[13px] text-suave">
                    {cx.ultima_sincronizacao ? `Sincronizado em ${DATA_HORA.format(new Date(cx.ultima_sincronizacao))}` : "Ainda não sincronizado"}
                    {cx.status && cx.status !== "UPDATED" && ` · situação: ${cx.status}`}
                  </p>
                  {cx.erro && <p className="mt-1 text-[13px] font-semibold text-despesa">{cx.erro}</p>}
                </div>
                <div className="flex flex-wrap gap-2">
                  <form action={sincronizar}>
                    <input type="hidden" name="id" value={cx.id} />
                    <button className="btn-sec">Sincronizar agora</button>
                  </form>
                  {cx.status && cx.status !== "UPDATED" && <BotaoConectar itemId={cx.pluggy_item_id} rotulo="Reautorizar" secundario />}
                </div>
              </div>

              <ul className="divide-y divide-linha">
                {minhas.map((e) => (
                  <li key={e.id} className="py-4">
                    <form action={vincularConta} className="grid items-end gap-3 sm:grid-cols-[1fr_200px_150px_auto]">
                      <input type="hidden" name="id" value={e.id} />
                      <div className="min-w-0">
                        <p className="truncate font-semibold">{e.nome}{e.numero ? ` · ${e.numero}` : ""}</p>
                        <p className="text-[13px] text-suave">
                          {e.tipo === "CREDIT" ? "Cartão de crédito (chega com o módulo de cartões)" : "Conta"}
                          {e.saldo_centavos !== null && ` · saldo no banco ${brl(Number(e.saldo_centavos))}`}
                        </p>
                      </div>
                      <div>
                        <label className="rotulo" htmlFor={`v-${e.id}`}>Lançar em</label>
                        <select id={`v-${e.id}`} name="conta_id" defaultValue={e.conta_id ?? ""} disabled={e.tipo === "CREDIT"} className="campo">
                          <option value="">Não importar</option>
                          {contas.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="rotulo" htmlFor={`d-${e.id}`}>A partir de</label>
                        <input id={`d-${e.id}`} name="importar_desde" type="date" defaultValue={e.importar_desde} className="campo" />
                      </div>
                      <button className="btn-sec" disabled={e.tipo === "CREDIT"}>Salvar</button>
                    </form>
                  </li>
                ))}
                {minhas.length === 0 && <li className="py-3 text-[15px] text-suave">Nenhuma conta encontrada ainda. Clique em Sincronizar agora.</li>}
              </ul>

              <details className="mt-4">
                <summary className="cursor-pointer text-[13px] font-semibold text-suave">Remover conexão</summary>
                <form action={removerConexao} className="mt-3 max-w-xs">
                  <input type="hidden" name="id" value={cx.id} />
                  <BotaoConfirmar confirmar="Remover e revogar acesso">Remover conexão</BotaoConfirmar>
                  <p className="mt-2 text-[13px] text-suave">Os lançamentos já importados continuam. Transações pendentes na caixa de entrada são apagadas.</p>
                </form>
              </details>
            </section>
          );
        })}
      </div>
    </>
  );
}

function ComoConfigurar() {
  return (
    <section className="painel max-w-2xl">
      <h2 className="font-display text-xl font-bold">Conexão com bancos chegando</h2>
      <p className="mt-2 text-[15px] text-suave">
        Em breve você poderá conectar seu banco pelo Open Finance e ver as movimentações chegarem sozinhas, prontas para revisar.
        Enquanto isso, lance seus gastos e receitas pelo botão <strong className="text-tinta">Novo lançamento</strong>.
      </p>
    </section>
  );
}
