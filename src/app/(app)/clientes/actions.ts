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

// Registro rápido de una llamada. Alimenta dos automatizaciones: pone al
// día last_contact_date (reloj de "lead inactivo") y, si no contestó, el
// cron diario creará la tarea de rellamada (trigger no_contesto).
export async function registrarLlamada(
  leadId: string,
  outcome: "contestado" | "no_contestado" | "interesado" | "no_interesado",
  notes: string
): Promise<ActionResult> {
  const supabase = await createClient();

  const { data: lead } = await supabase
    .from("leads")
    .select("business_id")
    .eq("id", leadId)
    .single();
  if (!lead) return { error: "El cliente ya no existe." };

  const { error } = await supabase.from("interactions").insert({
    business_id: lead.business_id,
    lead_id: leadId,
    type: "llamada",
    outcome,
    notes: notes.trim() || null,
  });
  if (error) return { error: "No se pudo registrar la llamada." };

  await supabase
    .from("leads")
    .update({ last_contact_date: new Date().toISOString() })
    .eq("id", leadId);

  revalidatePath("/clientes");
  revalidatePath("/hoy");
  return { ok: true };
}

// Derecho al olvido (RGPD): borra los datos personales del cliente en el
// lead, sus citas, tareas e interacciones, pero CONSERVA las filas para no
// romper el histórico ni las estadísticas. Irreversible a propósito.
export async function anonimizarCliente(leadId: string): Promise<ActionResult> {
  const supabase = await createClient();

  const { data: lead } = await supabase
    .from("leads")
    .select("id")
    .eq("id", leadId)
    .single();
  if (!lead) return { error: "El cliente ya no existe." };

  const { error } = await supabase
    .from("leads")
    .update({
      full_name: "Cliente eliminado",
      phone: null,
      email: null,
      notes: null,
      status: "perdido",
      pipeline_stage: "cerrado_perdido",
    })
    .eq("id", leadId);
  if (error) return { error: "No se pudieron borrar los datos." };

  // Datos personales copiados a otras tablas (RLS limita al negocio propio)
  await supabase
    .from("appointments")
    .update({ client_name: "Cliente eliminado", client_email: null, client_phone: null, notes: null })
    .eq("lead_id", leadId);
  await supabase
    .from("tasks")
    .update({ lead_name: "Cliente eliminado", lead_phone: null })
    .eq("lead_id", leadId);
  await supabase.from("interactions").update({ notes: null }).eq("lead_id", leadId);

  revalidatePath("/clientes");
  revalidatePath("/hoy");
  revalidatePath("/citas");
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
