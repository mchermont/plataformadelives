import { createClient } from "@supabase/supabase-js";

/**
 * Cliente com a service role key — ignora RLS por completo. Só pode ser
 * importado em código server-only (Route Handlers), nunca em componente
 * client nem exposto ao browser. Usado para operações que exigem a Admin
 * API do Supabase Auth (ex.: excluir uma conta de verdade), que RLS não
 * alcança porque auth.users não é uma tabela comum.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY não configurada — necessária para excluir contas de usuário.",
    );
  }
  return createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
