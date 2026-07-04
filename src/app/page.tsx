import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

// La raíz solo despacha: con sesión al panel, sin sesión al login.
// (La landing comercial vendrá más adelante, si hace falta.)
export default async function RootPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  redirect(user ? "/hoy" : "/login");
}
