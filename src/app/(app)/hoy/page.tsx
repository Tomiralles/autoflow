import Link from "next/link";
import {
  AlertCircle,
  BellRing,
  CalendarDays,
  CheckCircle,
  TrendingUp,
  Users,
  Zap,
} from "lucide-react";
import { getBusinessOrRedirect } from "@/lib/business";
import { createClient } from "@/lib/supabase/server";
import { defaultNotifyOnComplete } from "@/lib/notifications";
import { fechaLargaES, hoyISO } from "@/lib/dates";
import {
  CitaDeHoy,
  ReservaPendiente,
  TareaDeHoy,
  type AptRow,
  type TaskRow,
} from "./panel-widgets";

export default async function HoyPage() {
  const business = await getBusinessOrRedirect();
  const supabase = await createClient();
  const hoy = hoyISO();
  const mesActual = hoy.slice(0, 7);

  const [leadsRes, tareasRes, citasHoyRes, pendientesRes, facturasRes, autosRes] =
    await Promise.all([
      supabase
        .from("leads")
        .select("id", { count: "exact", head: true })
        .eq("business_id", business.id)
        .eq("status", "activo"),
      supabase
        .from("tasks")
        .select("id, title, type, due_date, lead_name, lead_phone")
        .eq("business_id", business.id)
        .eq("status", "pendiente")
        .order("due_date"),
      supabase
        .from("appointments")
        .select(
          "id, client_name, client_phone, date, time, service_name, status, materials_notes"
        )
        .eq("business_id", business.id)
        .eq("date", hoy)
        .order("time"),
      supabase
        .from("appointments")
        .select(
          "id, client_name, client_phone, date, time, service_name, status, materials_notes"
        )
        .eq("business_id", business.id)
        .eq("status", "pendiente")
        .gte("date", hoy)
        .order("date")
        .order("time"),
      supabase
        .from("invoices")
        .select("total, paid_date")
        .eq("business_id", business.id)
        .eq("status", "cobrada"),
      supabase
        .from("automations")
        .select("id", { count: "exact", head: true })
        .eq("business_id", business.id)
        .eq("is_active", true),
    ]);

  const tareas = (tareasRes.data ?? []) as TaskRow[];
  const citasHoy = (citasHoyRes.data ?? []) as AptRow[];
  const pendientes = (pendientesRes.data ?? []) as AptRow[];
  const ingresosMes = (facturasRes.data ?? [])
    .filter((f) => f.paid_date?.startsWith(mesActual))
    .reduce((sum, f) => sum + (f.total || 0), 0);
  const tareasUrgentes = tareas.filter((t) => t.due_date <= hoy).slice(0, 8);
  const avisoPorDefecto = defaultNotifyOnComplete(business.sector);

  const kpis = [
    {
      label: "Citas hoy",
      value: String(citasHoy.length),
      icon: CalendarDays,
      color: "text-purple-600",
      bg: "bg-purple-50",
    },
    {
      label: "Por confirmar",
      value: String(pendientes.length),
      icon: BellRing,
      color: "text-amber-600",
      bg: "bg-amber-50",
    },
    {
      label: "Clientes activos",
      value: String(leadsRes.count ?? 0),
      icon: Users,
      color: "text-coral",
      bg: "bg-coral-soft",
    },
    {
      label: "Ingresos del mes",
      value: `${ingresosMes.toLocaleString("es")}€`,
      icon: TrendingUp,
      color: "text-green-600",
      bg: "bg-green-50",
    },
  ];

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 md:p-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">
          Buenos días, {business.name} 👋
        </h1>
        <p className="mt-1 text-sm capitalize text-slate-500">
          {fechaLargaES()}
        </p>
      </div>

      {/* KPIs — números grandes, de un vistazo. "Ingresos del mes" lleva
          a /dinero (facturas y gastos), que no ocupa entrada de menú */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {kpis.map(({ label, value, icon: Icon, color, bg }) => {
          const card = (
            <div
              className={`rounded-xl border border-slate-100 bg-white p-5 shadow-sm ${label === "Ingresos del mes" ? "transition-shadow hover:shadow-md" : ""}`}
            >
              <div
                className={`mb-3 flex h-10 w-10 items-center justify-center rounded-lg ${bg}`}
              >
                <Icon size={20} className={color} />
              </div>
              <p className="text-2xl font-bold text-slate-900">{value}</p>
              <p className="mt-0.5 text-sm text-slate-500">
                {label}
                {label === "Ingresos del mes" && " →"}
              </p>
            </div>
          );
          return label === "Ingresos del mes" ? (
            <Link key={label} href="/dinero">
              {card}
            </Link>
          ) : (
            <div key={label}>{card}</div>
          );
        })}
      </div>

      {/* Reservas por confirmar */}
      {pendientes.length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-white shadow-sm">
          <div className="flex items-center gap-2 border-b border-slate-100 p-5">
            <BellRing size={18} className="text-amber-500" />
            <h2 className="font-bold text-slate-900">Reservas por confirmar</h2>
            <span className="rounded-full bg-amber-400 px-2 py-0.5 text-xs font-bold text-white">
              {pendientes.length}
            </span>
          </div>
          <div className="divide-y divide-slate-50">
            {pendientes.map((apt) => (
              <ReservaPendiente key={apt.id} apt={apt} hoy={hoy} />
            ))}
          </div>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Qué hacer hoy */}
        <div className="rounded-xl border border-slate-100 bg-white shadow-sm">
          <div className="flex items-center gap-2 border-b border-slate-100 p-5">
            <AlertCircle size={18} className="text-red-500" />
            <h2 className="font-bold text-slate-900">Qué hacer hoy</h2>
            {tareasUrgentes.length > 0 && (
              <span className="rounded-full bg-red-500 px-2 py-0.5 text-xs font-bold text-white">
                {tareasUrgentes.length}
              </span>
            )}
          </div>
          <div className="divide-y divide-slate-50">
            {tareasUrgentes.length === 0 ? (
              <div className="p-8 text-center">
                <CheckCircle size={32} className="mx-auto mb-2 text-green-400" />
                <p className="text-sm text-slate-500">
                  ¡Todo al día! No hay acciones urgentes.
                </p>
              </div>
            ) : (
              tareasUrgentes.map((task) => (
                <TareaDeHoy key={task.id} task={task} hoy={hoy} />
              ))
            )}
          </div>
        </div>

        {/* Citas de hoy */}
        <div className="rounded-xl border border-slate-100 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 p-5">
            <div className="flex items-center gap-2">
              <CalendarDays size={18} className="text-brand" />
              <h2 className="font-bold text-slate-900">Citas de hoy</h2>
            </div>
            <Link
              href="/citas"
              className="text-sm font-medium text-coral hover:underline"
            >
              Ver agenda
            </Link>
          </div>
          <div className="divide-y divide-slate-50">
            {citasHoy.length === 0 ? (
              <div className="p-5">
                <p className="mb-3 text-center text-sm text-slate-500">
                  Hoy no tienes citas. Cuando te reserven, se verán así:
                </p>
                {/* Cita de ejemplo: misma maqueta que una real, atenuada */}
                <div className="rounded-xl border border-dashed border-slate-200 p-4 opacity-70">
                  <div className="flex items-center gap-4">
                    <div className="w-12 shrink-0 text-center">
                      <p className="text-sm font-bold text-slate-900">10:30</p>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-slate-900">
                        María García
                      </p>
                      <p className="truncate text-xs text-slate-500">
                        Corte y peinado
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
              citasHoy.map((apt) => (
                <CitaDeHoy
                  key={apt.id}
                  apt={apt}
                  avisoPorDefecto={avisoPorDefecto}
                />
              ))
            )}
          </div>
        </div>
      </div>

      {/* El producto vende tranquilidad: la automatización se ve trabajando */}
      <div className="flex items-center justify-between rounded-2xl bg-brand p-5">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-coral">
            <Zap size={20} className="text-coral-fg" />
          </div>
          <div>
            <p className="font-bold text-white">
              {autosRes.count ?? 0} automatizaciones activas
            </p>
            <p className="text-sm text-slate-300">
              Trabajando por ti mientras te concentras en tu faena
            </p>
          </div>
        </div>
        <Link
          href="/automatico"
          className="rounded-xl bg-coral px-4 py-2 text-sm font-semibold text-coral-fg transition-colors hover:bg-coral-hover"
        >
          Gestionar
        </Link>
      </div>
    </div>
  );
}
