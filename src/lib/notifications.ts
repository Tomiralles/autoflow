import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { enviarEmail } from "@/lib/email";
import { enviarWhatsApp } from "@/lib/whatsapp";
import { hoyISO } from "@/lib/dates";
import { renderTemplate } from "@/lib/templates";

// Portado de src/lib/notifications.js del proyecto Base44. Misma lógica de
// negocio; el transporte (Resend/UltraMsg) es tolerante a falta de claves.

// Mantiene sincronizados el estado de la cita y la etapa del lead,
// se cambie donde se cambie (agenda o pipeline).
export const APPOINTMENT_STATUS_TO_STAGE: Record<string, string> = {
  confirmada: "cita_confirmada",
  completada: "en_negociacion",
  cancelada: "cerrado_perdido",
};

export { renderTemplate };

interface BusinessRow {
  id: string;
  name: string;
  phone: string | null;
  address: string | null;
  sector: string | null;
  whatsapp_instance_id: string | null;
  whatsapp_api_token: string | null;
}

interface AppointmentRow {
  id: string;
  lead_id: string | null;
  client_name: string;
  client_email: string | null;
  client_phone: string | null;
  date: string;
  time: string;
  service_name: string | null;
  status: string;
  ics_url: string | null;
}

interface LeadLike {
  id?: string | null;
  full_name: string;
  email?: string | null;
  phone?: string | null;
  service_name?: string | null;
}

async function getBusiness(
  supabase: SupabaseClient,
  businessId: string
): Promise<BusinessRow | null> {
  const { data } = await supabase
    .from("businesses")
    .select(
      "id, name, phone, address, sector, whatsapp_instance_id, whatsapp_api_token"
    )
    .eq("id", businessId)
    .single();
  return data;
}

// Confirma una cita concreta y avisa al cliente (email + WhatsApp).
// Compartida por el botón "Confirmar" del panel del día y el pipeline.
export async function confirmAppointment(
  supabase: SupabaseClient,
  businessId: string,
  appointment: AppointmentRow
): Promise<void> {
  if (!appointment || appointment.status === "confirmada") return;

  const { error } = await supabase
    .from("appointments")
    .update({ status: "confirmada" })
    .eq("id", appointment.id);
  if (error) throw new Error("No se pudo confirmar la cita.");

  // A partir de aquí, fallos de notificación no bloquean el flujo
  try {
    const business = await getBusiness(supabase, businessId);
    if (!business) return;

    if (appointment.client_email) {
      let body = `Hola ${appointment.client_name},\n\nTu cita ha sido confirmada. Aquí tienes los detalles:\n\nServicio: ${appointment.service_name || ""}\nFecha: ${appointment.date}\nHora: ${appointment.time.slice(0, 5)}\n\n${business.name}${business.phone ? `\nTeléfono: ${business.phone}` : ""}${business.address ? `\nDirección: ${business.address}` : ""}\n\n¡Te esperamos!`;
      if (appointment.ics_url) {
        body += `\n\nAñade esta cita a tu calendario (Google, Apple, Outlook...): ${appointment.ics_url}`;
      }
      await enviarEmail({
        to: appointment.client_email,
        fromName: business.name,
        subject: `Tu cita en ${business.name} ha sido confirmada`,
        body,
      });
    }

    if (appointment.client_phone) {
      await enviarWhatsApp({
        phone: appointment.client_phone,
        message: `Hola ${appointment.client_name}, tu cita en ${business.name} del ${appointment.date} a las ${appointment.time.slice(0, 5)} está confirmada. ¡Te esperamos!`,
        instanceId: business.whatsapp_instance_id,
        token: business.whatsapp_api_token,
      });
    }
  } catch (e) {
    console.error("[notificaciones] aviso de confirmación falló:", e);
  }
}

// Aviso "ya puedes recoger": para taller/estética, donde el cliente no está
// presente al terminar. En peluquería el cliente ya está allí.
async function sendPickupReadyNotice(
  supabase: SupabaseClient,
  businessId: string,
  lead: LeadLike
): Promise<void> {
  try {
    const business = await getBusiness(supabase, businessId);
    if (!business) return;

    const message = `Hola ${lead.full_name}, te confirmamos que ${lead.service_name ? `tu servicio "${lead.service_name}"` : "tu encargo"} ya está listo. Puedes pasar a recogerlo en nuestro horario comercial.\n\n${business.name}${business.phone ? `\nTeléfono: ${business.phone}` : ""}${business.address ? `\nDirección: ${business.address}` : ""}`;

    if (lead.email) {
      await enviarEmail({
        to: lead.email,
        fromName: business.name,
        subject: `${business.name} - Ya puedes recogerlo`,
        body: message,
      });
    }
    if (lead.phone) {
      await enviarWhatsApp({
        phone: lead.phone,
        message,
        instanceId: business.whatsapp_instance_id,
        token: business.whatsapp_api_token,
      });
    }
  } catch (e) {
    console.error("[notificaciones] aviso de recogida falló:", e);
  }
}

// Registra la venta cerrada: sella last_purchase_date (lo usan las
// automatizaciones de reactivación y upsell) y dispara el email opcional
// de "venta_cerrada" si el negocio lo tiene activo.
async function recordSaleClosed(
  supabase: SupabaseClient,
  businessId: string,
  lead: LeadLike
): Promise<void> {
  if (lead.id) {
    await supabase
      .from("leads")
      .update({ last_purchase_date: new Date().toISOString() })
      .eq("id", lead.id);
  }

  try {
    const { data: automations } = await supabase
      .from("automations")
      .select("id, email_subject, email_body, runs_count")
      .eq("business_id", businessId)
      .eq("trigger", "venta_cerrada")
      .eq("is_active", true)
      .limit(1);

    const automation = automations?.[0];
    if (automation && lead.email) {
      const business = await getBusiness(supabase, businessId);
      const vars = {
        nombre: lead.full_name,
        servicio: lead.service_name,
        negocio: business?.name,
      };
      const enviado = await enviarEmail({
        to: lead.email,
        fromName: business?.name,
        subject:
          renderTemplate(automation.email_subject, vars) ||
          "¡Gracias por elegirnos!",
        body:
          renderTemplate(automation.email_body, vars) ||
          `Hola ${lead.full_name},\n\nMuchas gracias por confiar en nosotros.`,
      });
      if (enviado) {
        await supabase
          .from("automations")
          .update({
            last_run: new Date().toISOString(),
            runs_count: (automation.runs_count || 0) + 1,
          })
          .eq("id", automation.id);
      }
    }
  } catch (e) {
    console.error("[notificaciones] email de venta cerrada falló:", e);
  }
}

// "Faena terminada" desde el panel del día: registra la venta siempre y
// solo avisa de la recogida si notifyClient es true.
export async function completeService(
  supabase: SupabaseClient,
  businessId: string,
  lead: LeadLike,
  { notifyClient }: { notifyClient: boolean }
): Promise<void> {
  if (notifyClient) await sendPickupReadyNotice(supabase, businessId, lead);
  await recordSaleClosed(supabase, businessId, lead);
}

// Sectores donde el cliente no suele estar presente al acabar la faena.
export function defaultNotifyOnComplete(sector: string | null): boolean {
  return ["taller", "estetica"].includes(sector || "");
}

// Fecha de hoy reexportada para los server actions del panel
export { hoyISO };
