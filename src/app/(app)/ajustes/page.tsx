import Link from "next/link";
import { getBusinessOrRedirect } from "@/lib/business";
import { createClient } from "@/lib/supabase/server";
import {
  BotonSalir,
  FilaServicio,
  FormNegocio,
  NuevoServicioDialog,
  type ServicioRow,
} from "./ajustes-widgets";

export default async function AjustesPage() {
  const business = await getBusinessOrRedirect();
  const supabase = await createClient();

  const [serviciosRes, perfilRes] = await Promise.all([
    supabase
      .from("services")
      .select(
        "id, name, description, price, duration_minutes, materials_notes, is_active"
      )
      .eq("business_id", business.id)
      .order("sort_order"),
    supabase.from("profiles").select("role").single(),
  ]);

  const servicios = (serviciosRes.data ?? []) as ServicioRow[];
  const esAdmin = perfilRes.data?.role === "admin";

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-4 md:p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Ajustes</h1>
          <p className="mt-1 text-sm text-slate-500">
            Tu negocio y tus servicios
          </p>
        </div>
        <div className="flex items-center gap-3">
          {esAdmin && (
            <Link
              href="/admin"
              className="text-sm font-medium text-blue-600 hover:underline"
            >
              Administración
            </Link>
          )}
          <BotonSalir />
        </div>
      </div>

      <div className="rounded-xl border border-slate-100 bg-white p-5 shadow-sm">
        <h2 className="mb-4 text-sm font-bold text-slate-700">
          Datos del negocio
        </h2>
        <FormNegocio
          businessId={business.id}
          slug={business.slug}
          inicial={{
            name: business.name,
            phone: business.phone ?? "",
            email: business.email ?? "",
            address: business.address ?? "",
            description: business.description ?? "",
            primary_color: business.primary_color,
          }}
        />
      </div>

      <div className="rounded-xl border border-slate-100 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
          <h2 className="text-sm font-bold text-slate-700">Servicios</h2>
          <NuevoServicioDialog businessId={business.id} />
        </div>
        <div className="divide-y divide-slate-50">
          {servicios.length === 0 ? (
            <p className="p-6 text-center text-sm text-slate-400">
              Añade tu primer servicio
            </p>
          ) : (
            servicios.map((s) => <FilaServicio key={s.id} servicio={s} />)
          )}
        </div>
      </div>
    </div>
  );
}
