import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

// Cliente para Server Components, Server Actions y Route Handlers.
// Lee la sesión de las cookies; RLS aplica igual que en el navegador.
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Un Server Component no puede escribir cookies; el proxy
            // (src/proxy.ts) ya refresca la sesión, así que es seguro ignorarlo.
          }
        },
      },
    }
  );
}
