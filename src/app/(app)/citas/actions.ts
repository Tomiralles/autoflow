"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export interface ActionResult {
  ok?: true;
  error?: string;
}

export interface NuevaCitaInput {
  client_name: string;
  client_phone: string;
  client_email: string;
  service_id: string;
  staff_id: string; // "" = sin asignar
  date: string;
  time: string;
  notes: string;
}

// Alta manual desde la agenda del dueño. La cita nace confirmada (la está
// apuntando él mismo); el anti-doble-reserva lo garantiza el índice único.
export async function crearCita(
  businessId: string,
  input: NuevaCitaInput
): Promise<ActionResult> {
  if (!input.client_name.trim()) return { error: "El nombre es obligatorio." };
  if (!input.date || !input.time) return { error: "Fecha y hora son obligatorias." };

  const supabase = await createClient();

  // Copia nombre, duración y materiales del servicio elegido
  let service: {
    id: string;
    name: string;
    duration_minutes: number | null;
    materials_notes: string | null;
  } | null = null;
  if (input.service_id) {
    const { data } = await supabase
      .from("services")
      .select("id, name, duration_minutes, materials_notes")
      .eq("id", input.service_id)
      .single();
    service = data;
  }

  // El trabajador debe ser del negocio (el select con RLS ya limita,
  // pero el eq de business_id lo hace explícito)
  let staffId: string | null = null;
  if (input.staff_id) {
    const { data: staff } = await supabase
      .from("staff")
      .select("id")
      .eq("id", input.staff_id)
      .eq("business_id", businessId)
      .single();
    staffId = staff?.id ?? null;
  }

  const { error } = await supabase.from("appointments").insert({
    business_id: businessId,
    client_name: input.client_name.trim(),
    client_phone: input.client_phone.trim() || null,
    client_email: input.client_email.trim() || null,
    service_id: service?.id ?? null,
    service_name: service?.name ?? null,
    duration_minutes: service?.duration_minutes ?? null,
    materials_notes: service?.materials_notes ?? null,
    staff_id: staffId,
    date: input.date,
    time: input.time,
    status: "confirmada",
    notes: input.notes.trim() || null,
  });

  if (error) {
    // 23505 = índice único (histórico), 23P01 = constraint de exclusión
    // por trabajador (el actual)
    if (error.code === "23505" || error.code === "23P01") {
      return {
        error: staffId
          ? "Esa persona ya tiene una cita a esa hora. Elige otro hueco."
          : "Ya hay una cita a esa hora. Elige otro hueco.",
      };
    }
    return { error: "No se pudo crear la cita." };
  }

  revalidatePath("/citas");
  revalidatePath("/hoy");
  return { ok: true };
}

// Cambios de estado rápidos desde la agenda (cancelar / no asistió)
export async function cambiarEstadoCita(
  appointmentId: string,
  status: "cancelada" | "no_asistio"
): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("appointments")
    .update({ status })
    .eq("id", appointmentId);
  if (error) return { error: "No se pudo actualizar la cita." };
  revalidatePath("/citas");
  revalidatePath("/hoy");
  return { ok: true };
}
