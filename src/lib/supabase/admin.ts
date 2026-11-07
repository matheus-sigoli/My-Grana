import "server-only";
import { createClient } from "@supabase/supabase-js";

/**
 * Cliente com a chave de serviço (ignora RLS). Uso restrito a:
 * - o resumo diário de avisos por push (rota de cron protegida por CRON_SECRET);
 * - excluir a própria conta (auth.admin.deleteUser) depois que os dados foram apagados.
 * Toda consulta feita com ele precisa filtrar por user_id explicitamente.
 */
export const adminConfigurado = () => !!process.env.SUPABASE_SERVICE_ROLE_KEY;

export function createAdminClient() {
  const chave = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!chave) throw new Error("Serviço indisponível");
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, chave, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}
