import Link from "next/link";
import { BotaoPush } from "@/components/botao-push";
import { DoisFatores } from "@/components/config/dois-fatores";
import { EditorPainel } from "@/components/config/editor-painel";
import { ExcluirConta } from "@/components/config/excluir-conta";
import { SeletorTema } from "@/components/seletor-tema";
import { Titulo } from "@/components/titulo";
import { iaConfigurada } from "@/lib/ia";
import { carregarPreferencias } from "@/lib/preferencias";
import { pushConfigurado } from "@/lib/push";
import { requireUser } from "@/lib/supabase/server";
import { temaAtual } from "@/lib/tema";
import { definirIa } from "../assistente/actions";

export const metadata = { title: "Configurações" };

function Secao({ id, titulo, children }: { id: string; titulo: string; children: React.ReactNode }) {
  return (
    <section aria-labelledby={id} className="painel">
      <h2 id={id} className="mb-4 font-display text-xl font-bold">{titulo}</h2>
      {children}
    </section>
  );
}

export default async function ConfiguracoesPage({ searchParams }: { searchParams: Promise<{ ok?: string }> }) {
  const sp = await searchParams;
  const { user } = await requireUser();
  const [prefs, tema] = await Promise.all([carregarPreferencias(), temaAtual()]);
  const fatores = (user.factors ?? [])
    .filter((f) => f.status === "verified" && f.factor_type === "totp")
    .map((f) => ({ id: f.id, nome: f.friendly_name ?? null, criado: f.created_at }));

  return (
    <>
      <Titulo sub={user.email}>Configurações</Titulo>
      {sp.ok === "painel" && <p role="status" className="mb-6 rounded-2xl bg-marca-clara px-4 py-3 font-semibold text-marca">Painel atualizado.</p>}

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-6">
          <Secao id="t-seg" titulo="Segurança">
            <DoisFatores fatores={fatores} />
          </Secao>
          <Secao id="t-painel" titulo="Seu painel">
            <EditorPainel atuais={prefs.painel_blocos} />
          </Secao>
        </div>

        <div className="space-y-6">
          <Secao id="t-tema" titulo="Aparência">
            <div className="max-w-xs"><SeletorTema atual={tema} /></div>
          </Secao>
          <Secao id="t-not" titulo="Notificações">
            {pushConfigurado()
              ? <BotaoPush chavePublica={process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? ""} />
              : <p className="text-[15px] text-suave">Os avisos aparecem no sino do topo. Notificações no celular chegam em breve.</p>}
          </Secao>
          {iaConfigurada() && (
            <Secao id="t-ia" titulo="Assistente com IA">
              <p className="mb-3 text-[15px] text-suave">{prefs.ia_ativada ? "Ativo. Um resumo dos seus dados vai para a IA só quando você pergunta." : "Desligado. Nenhum dado seu sai do MyGrana."}</p>
              {prefs.ia_ativada ? (
                <form action={definirIa}><input type="hidden" name="ativar" value="0" /><button className="btn-sec">Desativar</button></form>
              ) : (
                <Link href="/assistente" className="btn-sec">Ver como funciona</Link>
              )}
            </Secao>
          )}
          <Secao id="t-dados" titulo="Seus dados">
            <p className="mb-3 text-[15px] text-suave">Baixe tudo o que você guardou aqui, num arquivo JSON.</p>
            <a href="/api/exportar" className="btn-sec" download>Exportar meus dados</a>
            <div className="mt-6 border-t border-linha pt-5">
              <h3 className="mb-2 font-semibold text-despesa">Excluir conta</h3>
              <ExcluirConta />
            </div>
          </Secao>
        </div>
      </div>
    </>
  );
}
