import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { logout } from "@/app/(auth)/actions";
import { Button } from "@/components/ui/button";

// Panel del día — Fase 2 lo convierte en la pantalla principal real.
// De momento confirma sesión + negocio y da salida.
export default async function HoyPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: businesses } = await supabase
    .from("businesses")
    .select("id, name, slug, onboarding_completed")
    .limit(1);
  const business = businesses?.[0];
  if (!business || !business.onboarding_completed) redirect("/onboarding");

  return (
    <main className="mx-auto w-full max-w-3xl p-6">
      <header className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{business.name}</h1>
          <p className="text-sm text-slate-500">Panel del día</p>
        </div>
        <form action={logout}>
          <Button variant="outline" size="sm" type="submit">
            Salir
          </Button>
        </form>
      </header>
      <div className="rounded-xl border border-dashed border-slate-300 p-10 text-center text-slate-500">
        <p className="text-3xl">🛠️</p>
        <p className="mt-2 font-medium">El panel del día llega en la Fase 2</p>
        <p className="mt-1 text-sm">
          Citas de hoy, por confirmar, materiales y &quot;Faena terminada&quot;.
        </p>
      </div>
    </main>
  );
}
