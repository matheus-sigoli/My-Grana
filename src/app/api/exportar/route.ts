import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Tabelas do usuário (lista fixa: nada de nome de tabela vindo da requisição).
const TABELAS = [
  "contas", "categorias", "lancamentos", "cartoes", "pagamentos_fatura", "recorrencias", "ocorrencias_tratadas",
  "ativos", "operacoes_investimento", "avaliacoes", "proventos", "alocacao_alvo", "orcamentos", "metas",
  "conexoes_bancarias", "contas_externas", "transacoes_importadas", "preferencias",
] as const;

/** Portabilidade (LGPD): todos os dados do usuário logado em JSON. Só leitura; a RLS limita ao próprio usuário. */
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new NextResponse("Não autorizado", { status: 401 });
  const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (aal?.nextLevel === "aal2" && aal.currentLevel !== "aal2") return new NextResponse("Confirme o código do autenticador", { status: 401 });

  const resultados = await Promise.all(TABELAS.map((t) => supabase.from(t).select("*").limit(50000)));
  const dados: Record<string, unknown> = {
    exportado_em: new Date().toISOString(),
    usuario: { email: user.email, criado_em: user.created_at },
  };
  TABELAS.forEach((t, i) => { dados[t] = resultados[i].data ?? []; });

  const dia = new Date().toISOString().slice(0, 10);
  return new NextResponse(JSON.stringify(dados, null, 2), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "content-disposition": `attachment; filename="mygrana-meus-dados-${dia}.json"`,
      "cache-control": "no-store",
    },
  });
}
