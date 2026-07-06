import Link from "next/link";
import { redirect } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { FilaNegocio, type AdminBusinessRow } from "./admin-widgets";

// Panel del dueño del SaaS (Tomi): cobro manual. Fuera del área (app)
// porque la cuenta admin no tiene por qué tener un negocio propio.
export default async function AdminPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (profile?.role !== "admin") redirect("/hoy");

  const { data } = await supabase.rpc("admin_list_businesses");
  const negocios = (data ?? []) as AdminBusinessRow[];
  const activos = negocios.filter((n) => n.plan_status !== "inactive").length;

  return (
    <main className="mx-auto max-w-4xl space-y-6 p-4 md:p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900">
            <ShieldCheck size={24} className="text-blue-600" />
            Administración
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {negocios.length} negocios · {activos} en servicio · cobro manual:
            apaga al que no pague
          </p>
        </div>
        <Link
          href="/hoy"
          className="text-sm font-medium text-blue-600 hover:underline"
        >
          ← Volver a la app
        </Link>
      </div>

      <div className="rounded-xl border border-slate-100 bg-white shadow-sm">
        <div className="divide-y divide-slate-50">
          {negocios.length === 0 ? (
            <p className="p-8 text-center text-sm text-slate-400">
              No hay negocios dados de alta
            </p>
          ) : (
            negocios.map((n) => <FilaNegocio key={n.id} negocio={n} />)
          )}
        </div>
      </div>
    </main>
  );
}
