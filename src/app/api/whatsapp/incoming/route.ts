import { createAdminClient } from "@/lib/supabase/admin";
import { enviarWhatsApp } from "@/lib/whatsapp";
import { detectKeyword, rateLimitCheck, generateReservationUrl } from "@/lib/whatsapp/incoming";

// Webhook de UltraMsg: recibe mensajes entrantes de WhatsApp y, si el
// texto contiene una palabra clave de reserva, responde con el enlace
// público del negocio. Siempre devuelve 200 {ok:true} — un error HTTP
// haría que UltraMsg reintentara en bucle. Sin WHATSAPP_WEBHOOK_TOKEN
// configurado: cerrado, nunca abierto por accidente.
const KEYWORDS = ["cita", "reserva", "horario", "agendar", "disponibilidad", "precio", "tarifa"];

const ok = () => new Response(JSON.stringify({ ok: true }), { status: 200 });

export async function POST(request: Request) {
  try {
    const secret = process.env.WHATSAPP_WEBHOOK_TOKEN;
    if (!secret) {
      console.error("[whatsapp/incoming] WHATSAPP_WEBHOOK_TOKEN sin configurar");
      return ok();
    }
    if (request.headers.get("x-ultramsg-token") !== secret) {
      console.warn("[whatsapp/incoming] token de webhook inválido");
      return ok();
    }

    const payload = (await request.json()) as {
      phone?: string;
      message?: string;
      business_id?: string;
    };
    const { phone, message, business_id } = payload;
    if (!phone || !message || !business_id) {
      console.warn("[whatsapp/incoming] faltan campos", { phone, business_id });
      return ok();
    }

    const normalizedPhone = phone.startsWith("+") ? phone : `+${phone}`;
    const supabase = createAdminClient();

    const keyword = detectKeyword(message, KEYWORDS);
    if (!keyword) {
      // Sin palabra clave: silencio (no rebotar evita bucles), solo log
      await supabase.from("whatsapp_incoming_messages").insert({
        business_id,
        phone: normalizedPhone,
        message,
        matched_keyword: null,
        auto_responded: false,
      });
      return ok();
    }

    // Rate limit: máx 3 respuestas por teléfono por minuto (corta bucles con bots)
    const canRespond = await rateLimitCheck(normalizedPhone, business_id, supabase);
    if (!canRespond) {
      console.log(`[whatsapp/incoming] rate limit para ${normalizedPhone}`);
      await supabase.from("whatsapp_incoming_messages").insert({
        business_id,
        phone: normalizedPhone,
        message,
        matched_keyword: keyword,
        auto_responded: false,
      });
      return ok();
    }

    const { data: business } = await supabase
      .from("businesses")
      .select("id, name, slug, whatsapp_instance_id, whatsapp_api_token")
      .eq("id", business_id)
      .single();
    if (!business) {
      console.warn(`[whatsapp/incoming] negocio ${business_id} no encontrado`);
      return ok();
    }

    const reservationUrl = generateReservationUrl(business);
    const responseMessage = `Hola, soy el asistente automático de ${business.name} 🤖\n\nPuedes reservar tu cita aquí:\n${reservationUrl}\n\nSi prefieres, responde a este mensaje y te atendemos en persona.`;

    // enviarWhatsApp hace fallback a las credenciales de plataforma del
    // .env si el negocio no tiene las suyas (mismo patrón que reminders)
    const sent = await enviarWhatsApp({
      phone: normalizedPhone,
      message: responseMessage,
      instanceId: business.whatsapp_instance_id,
      token: business.whatsapp_api_token,
    });

    const { error } = await supabase.from("whatsapp_incoming_messages").insert({
      business_id,
      phone: normalizedPhone,
      message,
      matched_keyword: keyword,
      auto_responded: sent,
      responded_at: sent ? new Date().toISOString() : null,
    });
    if (error) {
      console.error("[whatsapp/incoming] fallo al registrar mensaje:", error);
    }

    return ok();
  } catch (error) {
    console.error("[whatsapp/incoming] error:", error);
    return ok();
  }
}
