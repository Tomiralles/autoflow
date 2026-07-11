import type { SupabaseClient } from "@supabase/supabase-js";
import { enviarEmail } from "@/lib/email";
import { renderTemplate } from "@/lib/notifications";
import { hoyISO } from "@/lib/dates";
import { generateReservationUrl } from "@/lib/whatsapp/incoming";

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
    // Nombre + slug: la plantilla de reactivación incluye {{enlace}} para
    // que el cliente reserve su próxima cita sin escribir ni llamar
    const { data: biz } = await supabase
      .from("businesses")
      .select("name, slug")
      .eq("id", automation.business_id)
      .single();
    if (!biz) continue;
    const negocio = biz.name;
    const enlace = generateReservationUrl(biz);

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

      const vars = { nombre: lead.full_name, negocio, enlace };
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

// "Reporte de ego": los lunes, resumen de la semana anterior al dueño
// (citas atendidas + dinero cobrado). Retención pura: que vea cada semana
// lo que la app hace por él. Va en el cron diario porque Vercel Hobby no
// admite un tercer cron. Solo se envía si hubo actividad — un email de
// "0 citas" desanima en vez de fidelizar.
async function runReporteSemanal(supabase: SupabaseClient): Promise<number> {
  const hoy = hoyISO();
  const esLunes = new Date(`${hoy}T12:00:00`).getDay() === 1;
  if (!esLunes) return 0;

  // Semana anterior completa: lunes a domingo
  const d = new Date(`${hoy}T12:00:00`);
  d.setDate(d.getDate() - 7);
  const inicio = d.toISOString().slice(0, 10);
  d.setDate(d.getDate() + 6);
  const fin = d.toISOString().slice(0, 10);

  const { data: negocios } = await supabase
    .from("businesses")
    .select("id, name, email, weekly_report_sent_date")
    .eq("onboarding_completed", true)
    .neq("plan_status", "inactive")
    .not("email", "is", null);

  let enviados = 0;

  for (const negocio of negocios ?? []) {
    // Idempotencia: si el cron corre dos veces el mismo lunes, no reenviar
    if (negocio.weekly_report_sent_date && negocio.weekly_report_sent_date >= hoy)
      continue;

    const [citasRes, facturasRes] = await Promise.all([
      supabase
        .from("appointments")
        .select("id", { count: "exact", head: true })
        .eq("business_id", negocio.id)
        .gte("date", inicio)
        .lte("date", fin)
        .not("status", "in", "(cancelada,no_asistio)"),
      supabase
        .from("invoices")
        .select("total")
        .eq("business_id", negocio.id)
        .eq("status", "cobrada")
        .gte("paid_date", inicio)
        .lte("paid_date", fin),
    ]);

    const citas = citasRes.count ?? 0;
    const ingresos = (facturasRes.data ?? []).reduce(
      (sum, f) => sum + (f.total || 0),
      0
    );
    if (citas === 0 && ingresos === 0) continue;

    const lineas = [
      `Hola ${negocio.name},`,
      "",
      "Así fue tu semana pasada:",
      "",
      `✅ ${citas} ${citas === 1 ? "cita atendida" : "citas atendidas"}`,
    ];
    if (ingresos > 0) {
      lineas.push(`💰 ${ingresos.toLocaleString("es")}€ cobrados`);
    }
    lineas.push(
      "",
      "Mientras tanto, las confirmaciones y recordatorios han salido solos. Tú a lo tuyo.",
      "",
      "— AutoFlow AI"
    );

    const ok = await enviarEmail({
      to: negocio.email,
      fromName: "AutoFlow AI",
      subject: `Tu semana: ${citas} ${citas === 1 ? "cita" : "citas"}${ingresos > 0 ? ` y ${ingresos.toLocaleString("es")}€` : ""}`,
      body: lineas.join("\n"),
    });

    if (ok) {
      await supabase
        .from("businesses")
        .update({ weekly_report_sent_date: hoy })
        .eq("id", negocio.id);
      enviados++;
    }
  }

  return enviados;
}

// Aviso al administrador de la PLATAFORMA (cobro manual): un email diario
// con los negocios activos cuyo pago vence en ≤7 días o ya venció. Solo
// se envía si hay algo que cobrar; al vencer NO se apaga nada solo — el
// admin decide en /admin (semáforo + botón "+1 mes").
async function runAvisoVencimientos(supabase: SupabaseClient): Promise<number> {
  const adminEmail = process.env.ADMIN_EMAIL;
  if (!adminEmail) return 0;

  const hoy = hoyISO();
  const d = new Date(`${hoy}T12:00:00`);
  d.setDate(d.getDate() + 7);
  const limite = d.toISOString().slice(0, 10);

  const { data: negocios } = await supabase
    .from("businesses")
    .select("name, slug, paid_until")
    .eq("plan_status", "active")
    .not("paid_until", "is", null)
    .lte("paid_until", limite)
    .order("paid_until");

  if (!negocios?.length) return 0;

  const lineas = negocios.map((n) => {
    const fecha = new Date(`${n.paid_until}T12:00:00`).toLocaleDateString("es-ES");
    return n.paid_until < hoy
      ? `🔴 ${n.name} (/${n.slug}) — VENCIDO desde el ${fecha}`
      : `🟡 ${n.name} (/${n.slug}) — vence el ${fecha}`;
  });

  const ok = await enviarEmail({
    to: adminEmail,
    fromName: "AutoFlow AI",
    subject: `Cobros pendientes: ${negocios.length} ${negocios.length === 1 ? "negocio" : "negocios"}`,
    body: `Suscripciones que necesitan cobro:\n\n${lineas.join("\n")}\n\nCuando cobres, pulsa "+1 mes" en el panel de Administración.\n\n— AutoFlow AI`,
  });

  return ok ? negocios.length : 0;
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
    reporte_semanal: await runReporteSemanal(supabase),
    aviso_vencimientos: await runAvisoVencimientos(supabase),
  };
  return {
    processed: Object.values(porRutina).reduce((a, b) => a + b, 0),
    porRutina,
  };
}
