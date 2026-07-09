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

  const [citasRes, serviciosRes, equipoRes] = await Promise.all([
    supabase
      .from("appointments")
      .select(
        "id, client_name, client_phone, date, time, service_name, status, materials_notes, notes, staff:staff_id(name)"
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
    supabase
      .from("staff")
      .select("id, name")
      .eq("business_id", business.id)
      .eq("is_active", true)
      .order("sort_order")
      .order("created_at"),
  ]);

  // El embed staff:staff_id(name) llega como objeto anidado → se aplana
  type RawCita = Cita & { staff: { name: string } | null };
  const citas: Cita[] = ((citasRes.data ?? []) as unknown as RawCita[]).map(
    ({ staff, ...c }) => ({ ...c, staff_name: staff?.name ?? null })
  );
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
          equipo={equipoRes.data ?? []}
          hoy={hoy}
        />
      </div>

      {citas.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center">
          <CalendarDays size={36} className="mx-auto mb-3 text-slate-300" />
          <p className="font-medium text-slate-600">No hay citas próximas</p>
          <p className="mt-1 text-sm text-slate-400">
            Crea una con &quot;Nueva cita&quot; o espera reservas de tu página
            pública. Cuando lleguen, se verán así:
          </p>
          {/* Cita de ejemplo para que el dueño reconozca el formato */}
          <div className="mx-auto mt-4 max-w-md rounded-xl border border-dashed border-slate-200 bg-white p-4 text-left opacity-70">
            <div className="flex items-center gap-4">
              <div className="w-12 shrink-0 text-center">
                <p className="text-sm font-bold text-slate-900">10:30</p>
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-slate-900">
                  María García
                </p>
                <p className="truncate text-xs text-slate-500">
                  Corte y peinado · 612 345 678
                </p>
              </div>
              <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-700">
                Confirmada
              </span>
              <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold tracking-wide text-slate-400">
                EJEMPLO
              </span>
            </div>
          </div>
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
