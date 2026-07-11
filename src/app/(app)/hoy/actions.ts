"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { hoyISO } from "@/lib/dates";
import { enviarEmail } from "@/lib/email";
import { enviarWhatsApp } from "@/lib/whatsapp";
import {
  APPOINTMENT_STATUS_TO_STAGE,
  completeService,
  confirmAppointment,
} from "@/lib/notifications";

export interface ActionResult {
  ok?: true;
  error?: string;
}

// Botón "Confirmar" de una reserva pendiente: confirma la cita, avisa al
// cliente y avanza su lead a "cita confirmada".
export async function confirmarCita(
  appointmentId: string
): Promise<ActionResult> {
  const supabase = await createClient();

  const { data: apt } = await supabase
    .from("appointments")
    .select(
      "id, business_id, lead_id, client_name, client_email, client_phone, date, time, service_name, status, ics_url"
    )
    .eq("id", appointmentId)
    .single();
  if (!apt) return { error: "La cita ya no existe." };

  try {
    await confirmAppointment(supabase, apt.business_id, apt);
  } catch {
    return { error: "No se pudo confirmar la cita." };
  }

  if (apt.lead_id) {
    await supabase
      .from("leads")
      .update({ pipeline_stage: APPOINTMENT_STATUS_TO_STAGE.confirmada })
      .eq("id", apt.lead_id);
  }

  revalidatePath("/hoy");
  revalidatePath("/citas");
  return { ok: true };
}

// "Faena terminada": cita completada, lead ganado, (opcional) aviso de
// recogida al cliente y (opcional) cobro apuntado como factura cobrada.
export async function faenaTerminada(
  appointmentId: string,
  avisarCliente: boolean,
  importeCobrado: number | null
): Promise<ActionResult> {
  const supabase = await createClient();

  const { data: apt } = await supabase
    .from("appointments")
    .select(
      "id, business_id, lead_id, client_name, client_email, client_phone, service_name"
    )
    .eq("id", appointmentId)
    .single();
  if (!apt) return { error: "La cita ya no existe." };

  const { error } = await supabase
    .from("appointments")
    .update({ status: "completada" })
    .eq("id", apt.id);
  if (error) return { error: "No se pudo cerrar la cita." };

  if (apt.lead_id) {
    await supabase
      .from("leads")
      .update({ pipeline_stage: "cerrado_ganado", status: "ganado" })
      .eq("id", apt.lead_id);
  }

  // Cobro apuntado en el mismo gesto: factura ya cobrada con fecha de hoy.
  let cobroFallido = false;
  if (importeCobrado != null && Number.isFinite(importeCobrado) && importeCobrado > 0) {
    const total = Math.round(importeCobrado * 100) / 100;
    const { error: errFactura } = await supabase.from("invoices").insert({
      business_id: apt.business_id,
      lead_id: apt.lead_id,
      client_name: apt.client_name,
      client_email: apt.client_email,
      client_phone: apt.client_phone,
      items: [{ description: apt.service_name || "Servicio", amount: total }],
      total,
      status: "cobrada",
      paid_date: hoyISO(),
    });
    cobroFallido = !!errFactura;
  }

  await completeService(
    supabase,
    apt.business_id,
    {
      id: apt.lead_id,
      full_name: apt.client_name,
      email: apt.client_email,
      phone: apt.client_phone,
      service_name: apt.service_name,
    },
    { notifyClient: avisarCliente }
  );

  // Petición de reseña en Google: si el negocio tiene su enlace puesto en
  // Ajustes, un gracias con el enlace justo al terminar (el mejor momento
  // para pedirla). WhatsApp si hay teléfono; si no, email. Nunca bloquea.
  try {
    const { data: biz } = await supabase
      .from("businesses")
      .select("name, google_review_url, whatsapp_instance_id, whatsapp_api_token")
      .eq("id", apt.business_id)
      .single();
    if (biz?.google_review_url && (apt.client_phone || apt.client_email)) {
      const msg = `¡Gracias por tu visita a ${biz.name}! 😊\n\nSi has quedado contento/a, ¿nos dejas una reseña en Google? Se tarda un minuto y nos ayuda muchísimo:\n${biz.google_review_url}`;
      if (apt.client_phone) {
        await enviarWhatsApp({
          phone: apt.client_phone,
          message: msg,
          instanceId: biz.whatsapp_instance_id,
          token: biz.whatsapp_api_token,
        });
      } else {
        await enviarEmail({
          to: apt.client_email,
          fromName: biz.name,
          subject: `¡Gracias por tu visita! — ${biz.name}`,
          body: msg,
        });
      }
    }
  } catch (e) {
    console.error("[faena] petición de reseña falló:", e);
  }

  revalidatePath("/hoy");
  revalidatePath("/citas");
  revalidatePath("/dinero");
  if (cobroFallido) {
    return {
      error:
        "La faena se cerró, pero el cobro no se pudo apuntar. Añádelo a mano en Dinero.",
    };
  }
  return { ok: true };
}

// Check rápido de "Qué hacer hoy": completar una tarea.
export async function completarTarea(taskId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("tasks")
    .update({ status: "completada" })
    .eq("id", taskId);
  if (error) return { error: "No se pudo completar la tarea." };
  revalidatePath("/hoy");
  return { ok: true };
}
