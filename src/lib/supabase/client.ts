import { createBrowserClient } from "@supabase/ssr";

// Cliente para componentes de navegador ("use client").
// Usa la clave anónima: RLS decide qué puede ver cada usuario.
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
