import { CalendarDays } from "lucide-react";
import { getBusinessOrRedirect } from "@/lib/business";
import { createClient } from "@/lib/supabase/server";
import { fechaCortaES, hoyISO } from "@/lib/dates";
import { NuevaCitaDialog } from "./nueva-cita";
import { FilaCita } from "./fila-cita";
import type { AptRow } from "../hoy/panel-widgets";

type Cita = AptRow & { notes: string | null };

export default async function CitasPage() {
  const business = await getBusinessOrRedirect();
  const supabase = await createClient();
  const hoy = hoyISO();

  const [citasRes, serviciosRes] = await Promise.all([
    supabase
      .from("appointments")
      .select(
        "id, client_name, client_phone, date, time, service_name, status, materials_notes, notes"
      )
      .eq("business_id", business.id)
      .gte("date", hoy)
      .order("date")
      .order("time"),
    supabase
      .from("services")
      .select("id, name")
      .eq("business_id", business.id)
      .eq("is_active", true)
      .order("sort_order"),
  ]);

  const citas = (citasRes.data ?? []) as Cita[];
  const porDia = new Map<string, Cita[]>();
  for (const c of citas) {
    const grupo = porDia.get(c.date) ?? [];
    grupo.push(c);
    porDia.set(c.date, grupo);
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-4 md:p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Citas</h1>
          <p className="mt-1 text-sm text-slate-500">
            Tu agenda a partir de hoy
          </p>
        </div>
        <NuevaCitaDialog
          businessId={business.id}
          services={serviciosRes.data ?? []}
          hoy={hoy}
        />
      </div>

      {citas.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 p-12 text-center">
          <CalendarDays size={36} className="mx-auto mb-3 text-slate-300" />
          <p className="font-medium text-slate-600">No hay citas próximas</p>
          <p className="mt-1 text-sm text-slate-400">
            Crea una con &quot;Nueva cita&quot; o espera reservas de tu página
            pública.
          </p>
        </div>
      ) : (
        [...porDia.entries()].map(([fecha, grupo]) => (
          <div
            key={fecha}
            className="rounded-xl border border-slate-100 bg-white shadow-sm"
          >
            <div className="border-b border-slate-100 px-5 py-3">
              <h2 className="text-sm font-bold capitalize text-slate-700">
                {fecha === hoy ? "Hoy" : fechaCortaES(fecha)}
                <span className="ml-2 font-normal text-slate-400">
                  {grupo.length} {grupo.length === 1 ? "cita" : "citas"}
                </span>
              </h2>
            </div>
            <div className="divide-y divide-slate-50">
              {grupo.map((apt) => (
                <FilaCita key={apt.id} apt={apt} />
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
