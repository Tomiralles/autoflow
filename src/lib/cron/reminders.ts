import type { SupabaseClient } from "@supabase/supabase-js";
import { enviarEmail } from "@/lib/email";
import { enviarWhatsApp } from "@/lib/whatsapp";
import { renderTemplate } from "@/lib/notifications";
import { hoyISO } from "@/lib/dates";

// Recordatorio 24h antes (cron horario). Portado de
// base44/functions/sendAppointmentReminders/entry.ts: solo los negocios
// con la automatización activa (trigger cita_reservada, condition_days<0)
// envían; se respeta la ventana y el texto de cada negocio.

// Diferencia de horas entre "ahora" y la cita, ambas en hora local de
// Madrid, independientemente de la zona del servidor (Vercel = UTC).
function horasHastaCita(date: string, time: string): number {
  const nowMadrid = new Date(
    new Intl.DateTimeFormat("sv-SE", {
      timeZone: "Europe/Madrid",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    })
      .format(new Date())
      .replace(" ", "T")
  );
  const apt = new Date(`${date}T${time.length === 5 ? `${time}:00` : time}`);
  return (apt.getTime() - nowMadrid.getTime()) / 3600000;
}

export async function runReminders(
  supabase: SupabaseClient
): Promise<{ sent: number }> {
  const { data: automations, error } = await supabase
    .from("automations")
    .select("id, business_id, condition_days, email_subject, email_body, runs_count")
    .eq("trigger", "cita_reservada")
    .eq("is_active", true)
    .lt("condition_days", 0);
  if (error) throw new Error(`automations: ${error.message}`);

  let sent = 0;

  for (const automation of automations ?? []) {
    const windowHours = Math.abs(automation.condition_days || -1) * 24;

    const { data: business } = await supabase
      .from("businesses")
      .select("id, name, phone, address, plan_status, whatsapp_instance_id, whatsapp_api_token")
      .eq("id", automation.business_id)
      .single();
    // Negocio dado de baja (impago): no gastar mensajes en sus citas
    if (!business || business.plan_status === "inactive") continue;

    const { data: appointments } = await supabase
      .from("appointments")
      .select("id, client_name, client_email, client_phone, date, time, service_name, status")
      .eq("business_id", automation.business_id)
      .eq("reminder_sent", false)
      .in("status", ["pendiente", "confirmada"])
      .gte("date", hoyISO());

    let fired = 0;

    for (const apt of appointments ?? []) {
      if (!apt.date || !apt.time) continue;
      // Basta un canal: el recordatorio sale por email, WhatsApp o ambos
      if (!apt.client_email && !apt.client_phone) continue;

      const hoursUntil = horasHastaCita(apt.date, apt.time);
      if (hoursUntil > windowHours || hoursUntil <= 0) continue;

      const hora = apt.time.slice(0, 5);
      const vars = {
        nombre: apt.client_name,
        fecha: apt.date,
        hora,
        servicio: apt.service_name,
        negocio: business.name,
      };
      const subject =
        renderTemplate(automation.email_subject, vars) ||
        `Recordatorio de tu cita con ${business.name}`;
      const body =
        renderTemplate(automation.email_body, vars) ||
        `Hola ${apt.client_name},\n\nTe recordamos que tienes una cita programada para el ${apt.date} a las ${hora}${apt.service_name ? ` (${apt.service_name})` : ""}.\n\n¡Te esperamos!\n\n${business.name}`;

      if (apt.client_email) {
        await enviarEmail({
          to: apt.client_email,
          fromName: business.name,
          subject,
          body,
        });
      }

      if (apt.client_phone) {
        await enviarWhatsApp({
          phone: apt.client_phone,
          message: body,
          instanceId: business.whatsapp_instance_id,
          token: business.whatsapp_api_token,
        });
      }

      // Marcar ANTES de contar: si esto falla, mejor un recordatorio de
      // menos que repetirlo cada hora
      const { error: markError } = await supabase
        .from("appointments")
        .update({ reminder_sent: true })
        .eq("id", apt.id);
      if (markError) continue;

      fired++;
      sent++;
    }

    await supabase
      .from("automations")
      .update({
        last_run: new Date().toISOString(),
        runs_count: (automation.runs_count || 0) + fired,
      })
      .eq("id", automation.id);
  }

  return { sent };
}
