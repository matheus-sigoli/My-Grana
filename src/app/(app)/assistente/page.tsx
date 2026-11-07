import { ChatAssistente } from "@/components/chat-assistente";
import { Titulo } from "@/components/titulo";
import { hojeISO } from "@/lib/datas";
import { iaConfigurada, LIMITE_DIARIO, montarContexto } from "@/lib/ia";
import { carregarPreferencias } from "@/lib/preferencias";
import { requireUser } from "@/lib/supabase/server";
import { definirIa } from "./actions";

export const metadata = { title: "Assistente" };

export default async function AssistentePage() {
  const { supabase } = await requireUser();
  const prefs = await carregarPreferencias();

  if (!iaConfigurada()) {
    return (
      <>
        <Titulo sub="Perguntas sobre o seu dinheiro, respondidas com os seus números.">Assistente</Titulo>
        <div className="painel max-w-xl"><p className="text-[15px]">O assistente chega em breve.</p></div>
      </>
    );
  }

  if (!prefs.ia_ativada) {
    return (
      <>
        <Titulo sub="Perguntas sobre o seu dinheiro, respondidas com os seus números.">Assistente</Titulo>
        <section className="painel max-w-2xl">
          <h2 className="font-display text-xl font-bold">Antes de ativar</h2>
          <ul className="mt-4 space-y-2 text-[15px]">
            <li>• As respostas são geradas pelo Claude, da Anthropic. Para responder, ele recebe um <strong>resumo</strong> dos seus dados.</li>
            <li>• O resumo tem nomes de contas e categorias, saldos, totais por mês, seus 10 maiores gastos do mês, metas e próximos vencimentos.</li>
            <li>• <strong>Nunca</strong> enviamos senha, e-mail, número de conta ou cartão, nem dados da sua conexão com bancos.</li>
            <li>• Você vê exatamente o que é enviado antes de cada pergunta, e pode desativar quando quiser.</li>
            <li>• O assistente não recomenda comprar ou vender investimentos específicos.</li>
          </ul>
          <form action={definirIa} className="mt-6">
            <input type="hidden" name="ativar" value="1" />
            <button className="btn">Concordo, ativar o assistente</button>
          </form>
        </section>
      </>
    );
  }

  const [contexto, { data: uso }] = await Promise.all([
    montarContexto(supabase),
    supabase.from("uso_ia").select("pedidos").eq("dia", hojeISO()).maybeSingle(),
  ]);
  const restantes = Math.max(0, LIMITE_DIARIO - Number(uso?.pedidos ?? 0));

  return (
    <>
      <Titulo sub="Perguntas sobre o seu dinheiro, respondidas com os seus números." acao={
        <form action={definirIa}><input type="hidden" name="ativar" value="0" /><button className="btn-sec">Desativar</button></form>
      }>Assistente</Titulo>
      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        <section className="painel"><ChatAssistente restantesIniciais={restantes} /></section>
        <aside className="painel h-fit">
          <details>
            <summary className="cursor-pointer font-semibold">Dados enviados a cada pergunta</summary>
            <p className="mt-2 text-[13px] text-suave">Exatamente isto, mais a sua pergunta. Sem senhas, e-mail ou números de conta.</p>
            <pre className="mt-3 max-h-96 overflow-auto rounded-xl bg-fundo p-3 text-[11px] leading-snug">{JSON.stringify(contexto, null, 2)}</pre>
          </details>
        </aside>
      </div>
    </>
  );
}
