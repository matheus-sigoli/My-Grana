import "server-only";
import { createClient } from "@supabase/supabase-js";

/**
 * Cliente com a chave de serviço (ignora RLS). Uso restrito ao resumo diário de avisos por push
 * (rota de cron protegida por CRON_SECRET). Excluir a conta não usa mais esta chave (ver ADR-0011).
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
