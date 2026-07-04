import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

// Cliente con service role: SALTA el RLS. Solo para código de servidor
// que trabaja sobre varios negocios a la vez (crons, panel admin).
// Nunca importar desde un componente de cliente ("server-only" lo impide).
export function createAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}
