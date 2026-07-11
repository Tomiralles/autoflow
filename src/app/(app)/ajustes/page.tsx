import Link from "next/link";
import { headers } from "next/headers";
import { getBusinessOrRedirect } from "@/lib/business";
import { createClient } from "@/lib/supabase/server";
import {
  BotonSalir,
  FilaServicio,
  FormApariencia,
  FormHorario,
  FormNegocio,
  NuevoServicioDialog,
  type ServicioRow,
} from "./ajustes-widgets";
import {
  FilaTrabajador,
  NuevoTrabajadorDialog,
  type TrabajadorRow,
} from "./equipo-widgets";
import { FilaCierre, NuevoCierreDialog, type CierreRow } from "./cierres-widgets";
import type { Horario } from "@/components/horario-editor";

export default async function AjustesPage() {
  const business = await getBusinessOrRedirect();
  const supabase = await createClient();

  // Origen real de la petición: funciona en local, en el subdominio
  // .vercel.app y con cualquier dominio propio que se añada más adelante,
  // sin depender de que NEXT_PUBLIC_APP_URL esté puesta o al día.
  const headerList = await headers();
  const host = headerList.get("host") ?? "localhost:3000";
  const protocolo = host.startsWith("localhost") ? "http" : "https";
  const origen = `${protocolo}://${host}`;

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [serviciosRes, perfilRes, aparienciaRes, equipoRes, cierresRes] = await Promise.all([
    supabase
      .from("services")
      .select(
        "id, name, description, price, duration_minutes, materials_notes, is_active"
      )
      .eq("business_id", business.id)
      .order("sort_order"),
    // Filtrar por id es imprescindible: un admin ve TODOS los perfiles por
    // RLS, y sin el eq() el .single() falla justo para los admins.
    supabase.from("profiles").select("role").eq("id", user!.id).single(),
    supabase
      .from("businesses")
      .select("secondary_color, logo_url, hero_image_url, working_hours, google_review_url")
      .eq("id", business.id)
      .single(),
    supabase
      .from("staff")
      .select("id, name, working_hours, is_active")
      .eq("business_id", business.id)
      .order("sort_order")
      .order("created_at"),
    // Solo cierres vigentes o futuros; los pasados no aportan nada
    supabase
      .from("business_closures")
      .select("id, start_date, end_date, reason")
      .eq("business_id", business.id)
      .gte("end_date", new Date().toISOString().slice(0, 10))
      .order("start_date"),
  ]);

  const servicios = (serviciosRes.data ?? []) as ServicioRow[];
  const equipo = (equipoRes.data ?? []) as TrabajadorRow[];
  const cierres = (cierresRes.data ?? []) as CierreRow[];
  const esAdmin = perfilRes.data?.role === "admin";
  const apariencia = aparienciaRes.data as {
    secondary_color: string | null;
    logo_url: string | null;
    hero_image_url: string | null;
    working_hours: Horario | null;
    google_review_url: string | null;
  } | null;

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
              className="text-sm font-medium text-coral hover:underline"
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
          origen={origen}
          inicial={{
            name: business.name,
            phone: business.phone ?? "",
            email: business.email ?? "",
            address: business.address ?? "",
            description: business.description ?? "",
            google_review_url: apariencia?.google_review_url ?? "",
          }}
        />
      </div>

      <div className="rounded-xl border border-slate-100 bg-white p-5 shadow-sm">
        <h2 className="mb-1 text-sm font-bold text-slate-700">Apariencia</h2>
        <p className="mb-4 text-xs text-slate-500">
          Personaliza cómo ven tu página de reservas los clientes
        </p>
        <FormApariencia
          businessId={business.id}
          slug={business.slug}
          inicial={{
            primary_color: business.primary_color,
            secondary_color: apariencia?.secondary_color ?? "#0F172A",
            logo_url: apariencia?.logo_url ?? null,
            hero_image_url: apariencia?.hero_image_url ?? null,
          }}
        />
      </div>

      <div className="rounded-xl border border-slate-100 bg-white p-5 shadow-sm">
        <h2 className="mb-1 text-sm font-bold text-slate-700">
          Horario de apertura
        </h2>
        <p className="mb-4 text-xs text-slate-500">
          Tus clientes solo podrán reservar dentro de estas horas
        </p>
        <FormHorario
          businessId={business.id}
          slug={business.slug}
          inicial={apariencia?.working_hours ?? null}
        />
      </div>

      <div className="rounded-xl border border-slate-100 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
          <div>
            <h2 className="text-sm font-bold text-slate-700">
              Vacaciones y días cerrados
            </h2>
            <p className="text-xs text-slate-500">
              Esos días tus clientes no podrán reservar
            </p>
          </div>
          <NuevoCierreDialog businessId={business.id} slug={business.slug} />
        </div>
        <div className="divide-y divide-slate-50">
          {cierres.length === 0 ? (
            <p className="p-6 text-center text-sm text-slate-400">
              ¿Vacaciones, un puente, una tarde libre? Añádelo y la agenda se
              cierra sola esos días
            </p>
          ) : (
            cierres.map((c) => (
              <FilaCierre key={c.id} cierre={c} slug={business.slug} />
            ))
          )}
        </div>
      </div>

      <div className="rounded-xl border border-slate-100 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
          <div>
            <h2 className="text-sm font-bold text-slate-700">Equipo</h2>
            <p className="text-xs text-slate-500">
              Si sois varios, cada persona tiene su propia agenda
            </p>
          </div>
          <NuevoTrabajadorDialog
            businessId={business.id}
            slug={business.slug}
            horarioNegocio={apariencia?.working_hours ?? null}
          />
        </div>
        <div className="divide-y divide-slate-50">
          {equipo.length === 0 ? (
            <p className="p-6 text-center text-sm text-slate-400">
              ¿Trabajáis 2 o más personas? Añadidlas y vuestros clientes
              podrán elegir con quién reservar
            </p>
          ) : (
            equipo.map((t) => (
              <FilaTrabajador
                key={t.id}
                trabajador={t}
                slug={business.slug}
                horarioNegocio={apariencia?.working_hours ?? null}
              />
            ))
          )}
        </div>
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
