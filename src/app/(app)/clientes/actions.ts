"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export interface ActionResult {
  ok?: true;
  error?: string;
}

export interface ClienteInput {
  full_name: string;
  phone: string;
  email: string;
  notes: string;
}

export async function crearCliente(
  businessId: string,
  input: ClienteInput
): Promise<ActionResult> {
  if (!input.full_name.trim()) return { error: "El nombre es obligatorio." };

  const supabase = await createClient();
  const { error } = await supabase.from("leads").insert({
    business_id: businessId,
    full_name: input.full_name.trim(),
    phone: input.phone.trim() || null,
    email: input.email.trim() || null,
    notes: input.notes.trim() || null,
    source: "manual",
    last_contact_date: new Date().toISOString(),
  });
  if (error) return { error: "No se pudo guardar el cliente." };

  revalidatePath("/clientes");
  return { ok: true };
}

export async function editarCliente(
  leadId: string,
  input: ClienteInput
): Promise<ActionResult> {
  if (!input.full_name.trim()) return { error: "El nombre es obligatorio." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("leads")
    .update({
      full_name: input.full_name.trim(),
      phone: input.phone.trim() || null,
      email: input.email.trim() || null,
      notes: input.notes.trim() || null,
    })
    .eq("id", leadId);
  if (error) return { error: "No se pudo guardar el cliente." };

  revalidatePath("/clientes");
  return { ok: true };
}

// Cambio de etapa desde la lista (select simple, no tablero kanban)
export async function cambiarEtapa(
  leadId: string,
  etapa: string
): Promise<ActionResult> {
  const supabase = await createClient();

  const patch: Record<string, unknown> = { pipeline_stage: etapa };
  if (etapa === "cerrado_ganado") patch.status = "ganado";
  else if (etapa === "cerrado_perdido") patch.status = "perdido";
  else patch.status = "activo";

  const { error } = await supabase.from("leads").update(patch).eq("id", leadId);
  if (error) return { error: "No se pudo cambiar la etapa." };

  revalidatePath("/clientes");
  revalidatePath("/hoy");
  return { ok: true };
}
