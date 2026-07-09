"use server";

import { createClient } from "@/lib/supabase/server";
import { enviarEmail } from "@/lib/email";
import { buildIcsContent } from "@/lib/ics";
import { renderTemplate } from "@/lib/notifications";
import type { Ocupacion } from "@/lib/slots";

// Intervalos ocupados de un día (inicio + duración), vía RPC pública.
// No expone datos de clientes; la duración hace falta para filtrar por
// solapamiento y no ofrecer huecos dentro de una cita larga.
export async function huecosOcupados(
  slug: string,
  date: string
): Promise<Ocupacion[]> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("get_booked_slots", {
    p_slug: slug,
    p_date: date,
  });
  return (
    (data as
      | { start_time: string; duration_minutes: number; staff_id: string | null }[]
      | null) ?? []
  ).map((r) => ({
    time: r.start_time.slice(0, 5),
    duration: r.duration_minutes || 60,
    staff_id: r.staff_id,
  }));
}

export interface ReservaInput {
  service_id: string;
  date: string;
  time: string; // "HH:MM"
  full_name: string;
  email: string;
  phone: string;
  staff_id: string | null; // null = me da igual / negocio sin equipo
}

export interface ReservaResult {
  ok?: true;
  staff_name?: string | null;
  error?: string;
  // El widget decide por código (no por texto) si vuelve al calendario
  codigo?: string;
}

const ERRORES: Record<string, string> = {
  hueco_ocupado: "Justo se ha reservado esa hora. Elige otra, por favor.",
  fuera_de_horario: "Esa hora queda fuera del horario. Elige otra, por favor.",
  fecha_pasada: "Esa fecha ya ha pasado.",
  datos_invalidos: "Revisa tus datos e inténtalo de nuevo.",
  negocio_no_encontrado: "Este negocio no está disponible ahora mismo.",
  servicio_no_encontrado: "Ese servicio ya no está disponible.",
  trabajador_no_encontrado: "Ese profesional ya no está disponible. Elige otro, por favor.",
};

// Reserva desde la página pública: la RPC crea lead + cita pendiente +
// tarea para el dueño de forma atómica; aquí solo enviamos el email de
// cortesía con el .ics adjunto (si hay email y Resend configurado).
export async function reservar(
  slug: string,
  input: ReservaInput
): Promise<ReservaResult> {
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("book_appointment", {
    p_slug: slug,
    p_service_id: input.service_id,
    p_date: input.date,
    p_time: input.time,
    p_name: input.full_name,
    p_email: input.email,
    p_phone: input.phone,
    p_staff_id: input.staff_id,
  });

  if (error) {
    console.error("[reserva] RPC falló:", error);
    return { error: "No se pudo completar la reserva. Inténtalo de nuevo." };
  }

  const res = data as {
    error?: string;
    appointment_id?: string;
    business_name?: string;
    business_phone?: string | null;
    business_address?: string | null;
    service_name?: string;
    duration_minutes?: number;
    staff_name?: string | null;
    email_subject?: string | null;
    email_body?: string | null;
  };

  if (res.error) {
    return {
      error: ERRORES[res.error] ?? ERRORES.datos_invalidos,
      codigo: res.error,
    };
  }

  // Email de reserva: siempre sale si el cliente dio email (núcleo del
  // producto); usa el texto de la automatización si está personalizada.
  const email = input.email.trim();
  if (email && res.appointment_id) {
    const fechaLarga = new Intl.DateTimeFormat("es-ES", {
      timeZone: "Europe/Madrid",
      weekday: "long",
      day: "numeric",
      month: "long",
    }).format(new Date(`${input.date}T12:00:00`));

    const vars = {
      nombre: input.full_name,
      fecha: fechaLarga,
      hora: input.time,
      servicio: res.service_name,
      negocio: res.business_name,
    };

    const defaultBody = `Hola ${input.full_name},\n\nTu cita ha sido reservada con éxito. Aquí tienes los detalles:\n\nServicio: ${res.service_name || ""}\nFecha: ${fechaLarga}\nHora: ${input.time}${res.staff_name ? `\nTe atenderá: ${res.staff_name}` : ""}\n\n${res.business_name}${res.business_phone ? `\nTeléfono: ${res.business_phone}` : ""}${res.business_address ? `\nDirección: ${res.business_address}` : ""}\n\n¡Te esperamos!`;

    const subject =
      renderTemplate(res.email_subject, vars) ||
      `Tu reserva en ${res.business_name}`;
    const body = renderTemplate(res.email_body, vars) || defaultBody;

    const ics = buildIcsContent({
      id: res.appointment_id,
      serviceName: res.service_name,
      date: input.date,
      time: input.time,
      durationMinutes: res.duration_minutes,
      businessName: res.business_name,
      businessPhone: res.business_phone,
      businessAddress: res.business_address,
      clientName: input.full_name,
    });

    await enviarEmail({
      to: email,
      fromName: res.business_name ?? undefined,
      subject,
      body: `${body}\n\nTe adjuntamos la cita para tu calendario (Google, Apple, Outlook...).`,
      attachments: [
        {
          filename: `cita-${input.date}.ics`,
          content: Buffer.from(ics).toString("base64"),
        },
      ],
    });
  }

  return { ok: true, staff_name: res.staff_name ?? null };
}
