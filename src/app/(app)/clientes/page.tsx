import { Users } from "lucide-react";
import { getBusinessOrRedirect } from "@/lib/business";
import { createClient } from "@/lib/supabase/server";
import {
  FilaCliente,
  NuevoClienteDialog,
  type ClienteRow,
} from "./cliente-widgets";

export default async function ClientesPage() {
  const business = await getBusinessOrRedirect();
  const supabase = await createClient();

  const { data } = await supabase
    .from("leads")
    .select(
      "id, full_name, phone, email, pipeline_stage, status, notes, service_name"
    )
    .eq("business_id", business.id)
    .order("updated_at", { ascending: false });

  const clientes = (data ?? []) as ClienteRow[];
  const activos = clientes.filter((c) => c.status === "activo");
  const cerrados = clientes.filter((c) => c.status !== "activo");

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-4 md:p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Clientes</h1>
          <p className="mt-1 text-sm text-slate-500">
            {activos.length} en seguimiento · {cerrados.length} cerrados
          </p>
        </div>
        <NuevoClienteDialog businessId={business.id} />
      </div>

      {clientes.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 p-12 text-center">
          <Users size={36} className="mx-auto mb-3 text-slate-300" />
          <p className="font-medium text-slate-600">Aún no hay clientes</p>
          <p className="mt-1 text-sm text-slate-400">
            Se añaden solos cuando alguien reserva en tu página pública, o
            créalos a mano.
          </p>
        </div>
      ) : (
        <>
          <div className="rounded-xl border border-slate-100 bg-white shadow-sm">
            <div className="border-b border-slate-100 px-5 py-3">
              <h2 className="text-sm font-bold text-slate-700">
                En seguimiento
              </h2>
            </div>
            <div className="divide-y divide-slate-50">
              {activos.length === 0 ? (
                <p className="p-6 text-center text-sm text-slate-400">
                  Nadie en seguimiento ahora mismo
                </p>
              ) : (
                activos.map((c) => <FilaCliente key={c.id} cliente={c} />)
              )}
            </div>
          </div>

          {cerrados.length > 0 && (
            <div className="rounded-xl border border-slate-100 bg-white shadow-sm">
              <div className="border-b border-slate-100 px-5 py-3">
                <h2 className="text-sm font-bold text-slate-700">
                  Ganados y perdidos
                </h2>
              </div>
              <div className="divide-y divide-slate-50">
                {cerrados.map((c) => (
                  <FilaCliente key={c.id} cliente={c} />
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
