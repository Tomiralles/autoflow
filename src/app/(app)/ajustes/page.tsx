import Link from "next/link";
import { headers } from "next/headers";
import { getBusinessOrRedirect } from "@/lib/business";
import { createClient } from "@/lib/supabase/server";
import {
  BotonSalir,
  FilaServicio,
  FormApariencia,
  FormNegocio,
  NuevoServicioDialog,
  type ServicioRow,
} from "./ajustes-widgets";

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

  const [serviciosRes, perfilRes, aparienciaRes] = await Promise.all([
    supabase
      .from("services")
      .select(
        "id, name, description, price, duration_minutes, materials_notes, is_active"
      )
      .eq("business_id", business.id)
      .order("sort_order"),
    supabase.from("profiles").select("role").single(),
    supabase
      .from("businesses")
      .select("secondary_color, logo_url, hero_image_url")
      .eq("id", business.id)
      .single(),
  ]);

  const servicios = (serviciosRes.data ?? []) as ServicioRow[];
  const esAdmin = perfilRes.data?.role === "admin";
  const apariencia = aparienciaRes.data as {
    secondary_color: string | null;
    logo_url: string | null;
    hero_image_url: string | null;
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
