import type { SupabaseClient } from "@supabase/supabase-js";
import { enviarEmail } from "@/lib/email";
import { renderTemplate } from "@/lib/notifications";
import { hoyISO } from "@/lib/dates";

// Rutinas diarias por sondeo (cron diario). Portadas de
// base44/functions/checkInactiveLeads/entry.ts, que pese al nombre
// procesaba 5 triggers: lead_inactivo, cliente_inactivo, post_venta,
// factura_vencida y no_contesto. Lo de citas vive en reminders.ts.

interface AutomationRow {
  id: string;
  business_id: string;
  action_type: string;
  condition_days: number | null;
  email_subject: string | null;
  email_body: string | null;
  task_title: string | null;
  runs_count: number;
}

function diasAtras(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

async function automationsActivas(
  supabase: SupabaseClient,
  trigger: string
): Promise<AutomationRow[]> {
  const { data, error } = await supabase
    .from("automations")
    .select(
      "id, business_id, action_type, condition_days, email_subject, email_body, task_title, runs_count"
    )
    .eq("trigger", trigger)
    .eq("is_active", true);
  if (error) throw new Error(`automations(${trigger}): ${error.message}`);
  return data ?? [];
}

async function marcarEjecucion(
  supabase: SupabaseClient,
  automation: AutomationRow,
  fired: number
): Promise<void> {
  await supabase
    .from("automations")
    .update({
      last_run: new Date().toISOString(),
      runs_count: (automation.runs_count || 0) + fired,
    })
    .eq("id", automation.id);
}

async function nombreNegocio(
  supabase: SupabaseClient,
  businessId: string
): Promise<string> {
  const { data } = await supabase
    .from("businesses")
    .select("name")
    .eq("id", businessId)
    .single();
  return data?.name ?? "";
}

async function crearTarea(
  supabase: SupabaseClient,
  automation: AutomationRow,
  lead: { id: string; full_name: string; phone: string | null },
  tituloPorDefecto: string,
  tipo: string,
  prioridad: string
): Promise<void> {
  await supabase.from("tasks").insert({
    business_id: automation.business_id,
    lead_id: lead.id,
    lead_name: lead.full_name,
    lead_phone: lead.phone,
    title: renderTemplate(automation.task_title || tituloPorDefecto, {
      nombre: lead.full_name,
    }),
    type: tipo,
    due_date: hoyISO(),
    priority: prioridad,
    status: "pendiente",
    created_by_automation: true,
  });
}

// Lead activo sin contacto en N días → email de seguimiento o tarea de llamada
async function runLeadInactivo(supabase: SupabaseClient): Promise<number> {
  let processed = 0;

  for (const automation of await automationsActivas(supabase, "lead_inactivo")) {
    const cutoff = diasAtras(automation.condition_days || 2);
    const negocio = await nombreNegocio(supabase, automation.business_id);

    const { data: leads } = await supabase
      .from("leads")
      .select("id, full_name, email, phone, pipeline_stage, last_contact_date, last_reminder_sent_date, created_at")
      .eq("business_id", automation.business_id)
      .eq("status", "activo");

    let fired = 0;

    for (const lead of leads ?? []) {
      if (["cerrado_ganado", "cerrado_perdido"].includes(lead.pipeline_stage)) continue;

      const lastContact = lead.last_contact_date || lead.created_at;
      if (!lastContact) continue;
      const lastContactDate = new Date(lastContact);
      if (lastContactDate > cutoff) continue;
      // No repetir hasta que haya contacto nuevo
      if (
        lead.last_reminder_sent_date &&
        new Date(lead.last_reminder_sent_date) >= lastContactDate
      )
        continue;

      const vars = { nombre: lead.full_name, negocio };
      if (automation.action_type === "enviar_email" && lead.email) {
        await enviarEmail({
          to: lead.email,
          fromName: negocio,
          subject:
            renderTemplate(automation.email_subject, vars) || "Seguimos en contacto",
          body: renderTemplate(automation.email_body, vars),
        });
      } else if (automation.action_type === "crear_tarea") {
        await crearTarea(
          supabase,
          automation,
          lead,
          "Seguimiento - {{nombre}}",
          "volver_a_llamar",
          "alta"
        );
      } else {
        continue;
      }

      await supabase
        .from("leads")
        .update({ last_reminder_sent_date: new Date().toISOString() })
        .eq("id", lead.id);
      processed++;
      fired++;
    }

    await marcarEjecucion(supabase, automation, fired);
  }

  return processed;
}

// Cliente ganado sin compras en N días → email de reactivación
async function runClienteInactivo(supabase: SupabaseClient): Promise<number> {
  let processed = 0;

  for (const automation of await automationsActivas(supabase, "cliente_inactivo")) {
    const cutoff = diasAtras(automation.condition_days || 30);
    const negocio = await nombreNegocio(supabase, automation.business_id);

    const { data: leads } = await supabase
      .from("leads")
      .select("id, full_name, email, last_purchase_date, last_reactivation_sent_date")
      .eq("business_id", automation.business_id)
      .eq("status", "ganado")
      .not("last_purchase_date", "is", null);

    let fired = 0;

    for (const lead of leads ?? []) {
      const lastPurchase = new Date(lead.last_purchase_date!);
      if (lastPurchase > cutoff) continue;
      // No reenviar hasta que vuelva a comprar
      if (
        lead.last_reactivation_sent_date &&
        new Date(lead.last_reactivation_sent_date) >= lastPurchase
      )
        continue;
      if (!lead.email) continue;

      const vars = { nombre: lead.full_name, negocio };
      await enviarEmail({
        to: lead.email,
        fromName: negocio,
        subject:
          renderTemplate(automation.email_subject, vars) || "¡Te echamos de menos!",
        body: renderTemplate(automation.email_body, vars),
      });

      await supabase
        .from("leads")
        .update({ last_reactivation_sent_date: new Date().toISOString() })
        .eq("id", lead.id);
      processed++;
      fired++;
    }

    await marcarEjecucion(supabase, automation, fired);
  }

  return processed;
}

// N días tras la venta → tarea de upsell
async function runPostVenta(supabase: SupabaseClient): Promise<number> {
  let processed = 0;

  for (const automation of await automationsActivas(supabase, "post_venta")) {
    const cutoff = diasAtras(automation.condition_days || 30);

    const { data: leads } = await supabase
      .from("leads")
      .select("id, full_name, phone, last_purchase_date, last_upsell_task_date")
      .eq("business_id", automation.business_id)
      .eq("status", "ganado")
      .not("last_purchase_date", "is", null);

    let fired = 0;

    for (const lead of leads ?? []) {
      const lastPurchase = new Date(lead.last_purchase_date!);
      if (lastPurchase > cutoff) continue;
      if (
        lead.last_upsell_task_date &&
        new Date(lead.last_upsell_task_date) >= lastPurchase
      )
        continue;

      await crearTarea(
        supabase,
        automation,
        lead,
        "Hacer upsell - {{nombre}}",
        "hacer_upsell",
        "media"
      );

      await supabase
        .from("leads")
        .update({ last_upsell_task_date: new Date().toISOString() })
        .eq("id", lead.id);
      processed++;
      fired++;
    }

    await marcarEjecucion(supabase, automation, fired);
  }

  return processed;
}

// Factura vencida N días sin cobrar → aviso al DUEÑO (no al cliente)
async function runFacturaVencida(supabase: SupabaseClient): Promise<number> {
  let processed = 0;

  for (const automation of await automationsActivas(supabase, "factura_vencida")) {
    const days = automation.condition_days || 7;

    const { data: business } = await supabase
      .from("businesses")
      .select("name, email")
      .eq("id", automation.business_id)
      .single();
    if (!business?.email) {
      await marcarEjecucion(supabase, automation, 0);
      continue;
    }

    const { data: invoices } = await supabase
      .from("invoices")
      .select("id, client_name, total, due_date, status")
      .eq("business_id", automation.business_id)
      .eq("owner_notified", false)
      .not("due_date", "is", null)
      .not("status", "in", "(cobrada,cancelada)");

    let fired = 0;

    for (const invoice of invoices ?? []) {
      const daysOverdue = Math.floor(
        (Date.now() - new Date(invoice.due_date).getTime()) / 86400000
      );
      if (daysOverdue < days) continue;

      const vars = {
        cliente: invoice.client_name,
        importe: String(invoice.total ?? ""),
        dias: String(daysOverdue),
      };
      await enviarEmail({
        to: business.email,
        fromName: "AutoFlow AI",
        subject:
          renderTemplate(automation.email_subject, vars) ||
          "Factura vencida sin cobrar",
        body: renderTemplate(automation.email_body, vars),
      });

      await supabase
        .from("invoices")
        .update({ owner_notified: true })
        .eq("id", invoice.id);
      processed++;
      fired++;
    }

    await marcarEjecucion(supabase, automation, fired);
  }

  return processed;
}

// Interacción "no contestó" de hace N días → tarea de rellamada
async function runNoContesto(supabase: SupabaseClient): Promise<number> {
  let processed = 0;

  for (const automation of await automationsActivas(supabase, "no_contesto")) {
    const cutoff = diasAtras(automation.condition_days || 1);

    const { data: interactions } = await supabase
      .from("interactions")
      .select("id, lead_id, created_at")
      .eq("business_id", automation.business_id)
      .eq("outcome", "no_contestado")
      .eq("task_created", false)
      .lte("created_at", cutoff.toISOString());

    let fired = 0;

    for (const interaction of interactions ?? []) {
      if (!interaction.lead_id) continue;

      const { data: lead } = await supabase
        .from("leads")
        .select("id, full_name, phone")
        .eq("id", interaction.lead_id)
        .single();
      if (!lead) continue;

      await crearTarea(
        supabase,
        automation,
        lead,
        "Volver a llamar - {{nombre}}",
        "volver_a_llamar",
        "alta"
      );

      await supabase
        .from("interactions")
        .update({ task_created: true })
        .eq("id", interaction.id);
      processed++;
      fired++;
    }

    await marcarEjecucion(supabase, automation, fired);
  }

  return processed;
}

export async function runDailyAutomations(
  supabase: SupabaseClient
): Promise<{ processed: number; porRutina: Record<string, number> }> {
  const porRutina = {
    lead_inactivo: await runLeadInactivo(supabase),
    cliente_inactivo: await runClienteInactivo(supabase),
    post_venta: await runPostVenta(supabase),
    factura_vencida: await runFacturaVencida(supabase),
    no_contesto: await runNoContesto(supabase),
  };
  return {
    processed: Object.values(porRutina).reduce((a, b) => a + b, 0),
    porRutina,
  };
}
