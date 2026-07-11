"use server";

import { createClient } from "@/lib/supabase/server";
import { enviarEmail } from "@/lib/email";
import { enviarWhatsApp } from "@/lib/whatsapp";

export interface CancelacionResult {
  ok?: true;
  error?: string;
}

const ERRORES: Record<string, string> = {
  no_encontrada: "No hemos encontrado esta cita.",
  no_cancelable: "Esta cita ya no se puede cancelar.",
  ya_pasada: "Esta cita ya ha pasado.",
};

// El cliente cancela su propia cita desde el enlace del email/WhatsApp.
// La RPC valida el token y el estado; después avisamos al dueño de que
// se le ha liberado el hueco (si el aviso falla, la cancelación vale).
export async function cancelarCita(token: string): Promise<CancelacionResult> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("cancel_appointment", {
    p_token: token,
  });

  if (error) {
    console.error("[cancelar] RPC falló:", error);
    return { error: "No se pudo cancelar. Inténtalo de nuevo." };
  }

  const res = data as {
    ok?: boolean;
    error?: string;
    client_name?: string;
    service_name?: string | null;
    date?: string;
    time?: string;
    business_name?: string;
    business_email?: string | null;
    business_phone?: string | null;
  };

  if (res.error) {
    return { error: ERRORES[res.error] ?? ERRORES.no_encontrada };
  }

  try {
    const fecha = new Intl.DateTimeFormat("es-ES", {
      timeZone: "Europe/Madrid",
      weekday: "long",
      day: "numeric",
      month: "long",
    }).format(new Date(`${res.date}T12:00:00`));
    const hora = res.time?.slice(0, 5);
    const resumen = `Cancelación: ${res.client_name} ha cancelado su cita${res.service_name ? ` de ${res.service_name}` : ""} del ${fecha} a las ${hora}. El hueco queda libre.`;

    if (res.business_email) {
      await enviarEmail({
        to: res.business_email,
        fromName: "AutoFlow AI",
        subject: `Cancelación: ${res.client_name} — ${fecha}, ${hora}`,
        body: `${resumen}\n\n— AutoFlow AI`,
      });
    }
    if (res.business_phone) {
      const tel = res.business_phone.replace(/\s/g, "");
      await enviarWhatsApp({
        phone: tel.startsWith("+") ? tel : `+34${tel}`,
        message: resumen,
      });
    }
  } catch (e) {
    console.error("[cancelar] aviso al dueño falló:", e);
  }

  return { ok: true };
}
