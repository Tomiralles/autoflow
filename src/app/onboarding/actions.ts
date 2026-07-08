"use server";

import { createClient } from "@/lib/supabase/server";
import {
  TEMPLATES,
  ESSENTIAL_TEMPLATE_KEYS,
} from "@/lib/automation-templates";
import type { Horario } from "@/components/horario-editor";

export interface BusinessInput {
  name: string;
  slug: string;
  sector: string;
  phone: string;
  primary_color: string;
  secondary_color: string;
  working_hours: Horario;
}

export interface ServiceInput {
  name: string;
  description: string;
  price: string;
  duration_minutes: number;
}

// Rutas propias de la app que un negocio no puede ocupar como URL pública
const SLUGS_RESERVADOS = [
  "login",
  "registro",
  "onboarding",
  "hoy",
  "citas",
  "clientes",
  "automatico",
  "ajustes",
  "admin",
  "auth",
  "api",
];

function generarSlug(nombre: string): string {
  return nombre
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .slice(0, 30);
}

// Paso 1: crear el negocio. La unicidad del slug la garantiza la BD
// (constraint unique), no una consulta previa: sin carreras posibles.
export async function crearNegocio(
  input: BusinessInput
): Promise<{ businessId?: string; error?: string; slugTaken?: boolean }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sesión caducada. Vuelve a entrar." };

  if (!input.name.trim()) return { error: "El nombre del negocio es obligatorio." };

  const slugPedido = input.slug.trim();
  let slug = slugPedido || generarSlug(input.name);
  if (!slug) slug = `negocio-${user.id.slice(0, 6)}`;
  if (SLUGS_RESERVADOS.includes(slug)) {
    if (slugPedido) return { slugTaken: true };
    slug = `${slug}-negocio`;
  }

  for (let intento = 0; intento < 2; intento++) {
    const { data, error } = await supabase
      .from("businesses")
      .insert({
        owner_id: user.id,
        name: input.name.trim(),
        slug,
        sector: input.sector,
        phone: input.phone.trim() || null,
        primary_color: input.primary_color,
        secondary_color: input.secondary_color,
        working_hours: input.working_hours,
        plan: "free",
        plan_status: "trial",
        onboarding_completed: false,
      })
      .select("id")
      .single();

    if (!error) return { businessId: data.id };

    if (error.code === "23505") {
      // Slug ocupado: si lo eligió el usuario, que decida otro;
      // si era autogenerado, reintenta una vez con sufijo aleatorio
      if (slugPedido) return { slugTaken: true };
      slug = `${slug.slice(0, 25)}-${Math.random().toString(36).slice(2, 6)}`;
      continue;
    }
    return { error: "No se pudo crear el negocio. Inténtalo de nuevo." };
  }
  return { error: "No se pudo reservar una URL libre. Elige una manualmente." };
}

// Paso 2: guardar servicios, activar las 4 automatizaciones esenciales
// y cerrar el onboarding. Idempotente si se repite (upsert por template_key).
export async function completarOnboarding(
  businessId: string,
  services: ServiceInput[]
): Promise<{ ok?: true; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sesión caducada. Vuelve a entrar." };

  const validos = services.filter((s) => s.name.trim());
  if (validos.length > 0) {
    const { error } = await supabase.from("services").insert(
      validos.map((s, i) => ({
        business_id: businessId,
        name: s.name.trim(),
        description: s.description.trim() || null,
        price: parseFloat(s.price) || 0,
        duration_minutes: s.duration_minutes || 60,
        is_active: true,
        sort_order: i,
      }))
    );
    if (error) return { error: "No se pudieron guardar los servicios." };
  }

  const esenciales = TEMPLATES.filter((t) =>
    ESSENTIAL_TEMPLATE_KEYS.includes(t.key)
  );
  const { error: autoError } = await supabase.from("automations").upsert(
    esenciales.map((t) => ({
      business_id: businessId,
      template_key: t.key,
      name: t.name,
      description: t.description,
      trigger: t.trigger,
      action_type: t.action_type,
      condition_days: t.condition_days,
      email_subject: t.default_subject,
      email_body: t.default_body,
      task_title: t.task_title ?? "",
      is_active: true,
    })),
    { onConflict: "business_id,template_key" }
  );
  if (autoError) {
    return { error: "No se pudieron activar las automatizaciones." };
  }

  const { error: bizError } = await supabase
    .from("businesses")
    .update({ onboarding_completed: true })
    .eq("id", businessId);
  if (bizError) return { error: "No se pudo finalizar la configuración." };

  return { ok: true };
}
