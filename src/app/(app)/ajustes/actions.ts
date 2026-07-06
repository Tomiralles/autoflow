"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export interface ActionResult {
  ok?: true;
  error?: string;
}

export interface NegocioInput {
  name: string;
  phone: string;
  email: string;
  address: string;
  description: string;
  primary_color: string;
}

export async function guardarNegocio(
  businessId: string,
  input: NegocioInput
): Promise<ActionResult> {
  if (!input.name.trim()) return { error: "El nombre es obligatorio." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("businesses")
    .update({
      name: input.name.trim(),
      phone: input.phone.trim() || null,
      email: input.email.trim() || null,
      address: input.address.trim() || null,
      description: input.description.trim() || null,
      primary_color: input.primary_color,
    })
    .eq("id", businessId);
  if (error) return { error: "No se pudieron guardar los cambios." };

  revalidatePath("/ajustes");
  revalidatePath("/hoy");
  return { ok: true };
}

export interface ServicioInput {
  name: string;
  description: string;
  price: string;
  duration_minutes: number;
  materials_notes: string;
}

export async function crearServicio(
  businessId: string,
  input: ServicioInput
): Promise<ActionResult> {
  if (!input.name.trim()) return { error: "El nombre es obligatorio." };

  const supabase = await createClient();
  const { count } = await supabase
    .from("services")
    .select("id", { count: "exact", head: true })
    .eq("business_id", businessId);

  const { error } = await supabase.from("services").insert({
    business_id: businessId,
    name: input.name.trim(),
    description: input.description.trim() || null,
    price: parseFloat(input.price) || 0,
    duration_minutes: input.duration_minutes || 60,
    materials_notes: input.materials_notes.trim() || null,
    is_active: true,
    sort_order: count ?? 0,
  });
  if (error) return { error: "No se pudo crear el servicio." };

  revalidatePath("/ajustes");
  return { ok: true };
}

export async function editarServicio(
  serviceId: string,
  input: ServicioInput
): Promise<ActionResult> {
  if (!input.name.trim()) return { error: "El nombre es obligatorio." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("services")
    .update({
      name: input.name.trim(),
      description: input.description.trim() || null,
      price: parseFloat(input.price) || 0,
      duration_minutes: input.duration_minutes || 60,
      materials_notes: input.materials_notes.trim() || null,
    })
    .eq("id", serviceId);
  if (error) return { error: "No se pudo guardar el servicio." };

  revalidatePath("/ajustes");
  return { ok: true };
}

// Activar/desactivar en vez de borrar: las citas antiguas siguen apuntando
// al servicio y no se pierde el histórico.
export async function toggleServicio(
  serviceId: string,
  activo: boolean
): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("services")
    .update({ is_active: activo })
    .eq("id", serviceId);
  if (error) return { error: "No se pudo cambiar el servicio." };

  revalidatePath("/ajustes");
  return { ok: true };
}
