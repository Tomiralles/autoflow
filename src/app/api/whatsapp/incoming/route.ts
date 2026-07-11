import { createAdminClient } from "@/lib/supabase/admin";
import { enviarWhatsApp } from "@/lib/whatsapp";
import { detectKeyword, rateLimitCheck, generateReservationUrl } from "@/lib/whatsapp/incoming";
import type { SupabaseClient } from "@supabase/supabase-js";

// Webhook de UltraMsg: recibe mensajes entrantes de WhatsApp y, si el
// texto contiene una palabra clave de reserva, responde con el enlace
// público del negocio. Siempre devuelve 200 {ok:true} — un error HTTP
// haría que UltraMsg reintentara en bucle. Sin WHATSAPP_WEBHOOK_TOKEN
// configurado: cerrado, nunca abierto por accidente.
//
// El panel de UltraMsg solo deja poner una URL, así que el token viaja
// como query param: /api/whatsapp/incoming?token=XXX (también se acepta
// el header X-UltraMsg-Token para pruebas manuales).
const KEYWORDS = ["cita", "reserva", "horario", "agendar", "disponibilidad", "precio", "tarifa"];

const ok = () => new Response(JSON.stringify({ ok: true }), { status: 200 });

// UltraMsg manda {event_type, instanceId, data:{from,body,fromMe,type}}.
// El formato simple {phone,message,business_id} se mantiene para pruebas.
type WebhookPayload = {
  event_type?: string;
  instanceId?: string;
  data?: { from?: string; body?: string; fromMe?: boolean; type?: string };
  phone?: string;
  message?: string;
  business_id?: string;
};

type Negocio = {
  id: string;
  name: string;
  slug: string;
  whatsapp_instance_id: string | null;
  whatsapp_api_token: string | null;
};

const CAMPOS_NEGOCIO = "id, name, slug, whatsapp_instance_id, whatsapp_api_token";

// El mensaje entrante no trae business_id: se resuelve por la instancia
// de UltraMsg del negocio, con fallback a WHATSAPP_DEFAULT_BUSINESS_ID
// (la instancia de plataforma es compartida y no identifica al negocio).
// Los negocios inactivos (impago) no responden: su página está apagada
// y el enlace daría 404.
async function resolverNegocio(
  supabase: SupabaseClient,
  businessId: string | undefined,
  instanceId: string | undefined
): Promise<Negocio | null> {
  if (businessId) {
    const { data } = await supabase
      .from("businesses")
      .select(CAMPOS_NEGOCIO)
      .eq("id", businessId)
      .neq("plan_status", "inactive")
      .maybeSingle();
    if (data) return data;
  }
  if (instanceId) {
    const { data } = await supabase
      .from("businesses")
      .select(CAMPOS_NEGOCIO)
      .eq("whatsapp_instance_id", instanceId)
      .neq("plan_status", "inactive")
      .limit(1)
      .maybeSingle();
    if (data) return data;
  }
  const defaultId = process.env.WHATSAPP_DEFAULT_BUSINESS_ID;
  if (defaultId) {
    const { data } = await supabase
      .from("businesses")
      .select(CAMPOS_NEGOCIO)
      .eq("id", defaultId)
      .neq("plan_status", "inactive")
      .maybeSingle();
    if (data) return data;
  }
  return null;
}

export async function POST(request: Request) {
  try {
    const secret = process.env.WHATSAPP_WEBHOOK_TOKEN;
    if (!secret) {
      console.error("[whatsapp/incoming] WHATSAPP_WEBHOOK_TOKEN sin configurar");
      return ok();
    }
    const qToken = new URL(request.url).searchParams.get("token");
    const hToken = request.headers.get("x-ultramsg-token");
    if (qToken !== secret && hToken !== secret) {
      console.warn("[whatsapp/incoming] token de webhook inválido");
      return ok();
    }

    const raw = (await request.json()) as WebhookPayload;

    let phone: string | undefined;
    let message: string | undefined;
    let businessId: string | undefined;
    let instanceId: string | undefined;

    if (raw.data) {
      // Formato nativo de UltraMsg
      if (raw.event_type && raw.event_type !== "message_received") return ok();
      // Mensajes salientes del propio negocio: NUNCA responder (anti-bucle)
      if (raw.data.fromMe) return ok();
      // Solo texto; audio/imagen/ubicación se ignoran de momento
      if (raw.data.type && raw.data.type !== "chat") return ok();
      phone = (raw.data.from || "").replace(/@.*$/, "");
      message = raw.data.body;
      instanceId = raw.instanceId;
    } else {
      phone = raw.phone;
      message = raw.message;
      businessId = raw.business_id;
    }

    if (!phone || !message) {
      console.warn("[whatsapp/incoming] payload sin teléfono o mensaje");
      return ok();
    }

    const normalizedPhone = phone.startsWith("+") ? phone : `+${phone}`;
    const supabase = createAdminClient();

    const business = await resolverNegocio(supabase, businessId, instanceId);
    if (!business) {
      console.warn(
        `[whatsapp/incoming] sin negocio para instancia=${instanceId} id=${businessId} (¿falta WHATSAPP_DEFAULT_BUSINESS_ID?)`
      );
      return ok();
    }

    const keyword = detectKeyword(message, KEYWORDS);
    if (!keyword) {
      // Sin palabra clave: silencio (no rebotar evita bucles), solo log
      await supabase.from("whatsapp_incoming_messages").insert({
        business_id: business.id,
        phone: normalizedPhone,
        message,
        matched_keyword: null,
        auto_responded: false,
      });
      return ok();
    }

    // Rate limit: máx 3 respuestas por teléfono por minuto (corta bucles con bots)
    const canRespond = await rateLimitCheck(normalizedPhone, business.id, supabase);
    if (!canRespond) {
      console.log(`[whatsapp/incoming] rate limit para ${normalizedPhone}`);
      await supabase.from("whatsapp_incoming_messages").insert({
        business_id: business.id,
        phone: normalizedPhone,
        message,
        matched_keyword: keyword,
        auto_responded: false,
      });
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
      business_id: business.id,
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
