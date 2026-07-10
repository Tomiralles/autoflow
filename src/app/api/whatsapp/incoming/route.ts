import { createClient } from "@supabase/supabase-js";
import { enviarWhatsApp } from "@/lib/whatsapp";
import { detectKeyword, rateLimitCheck, generateReservationUrl } from "@/lib/whatsapp/incoming";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("[WhatsApp] Missing Supabase config: NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
}

const supabase = createClient(supabaseUrl || "", supabaseKey || "");

const KEYWORDS = ["cita", "reserva", "horario", "agendar", "disponibilidad", "precio", "tarifa"];

export async function POST(request: Request) {
  try {
    // Check Supabase config
    if (!supabaseUrl || !supabaseKey) {
      console.error("[WhatsApp] Cannot process: missing Supabase config");
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    }

    // Validate webhook token
    const token = request.headers.get("x-ultramsg-token");
    if (token !== process.env.WHATSAPP_WEBHOOK_TOKEN) {
      console.warn("[WhatsApp] Invalid webhook token");
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    }

    const payload = await request.json() as {
      phone?: string;
      message?: string;
      business_id?: string;
    };

    const { phone, message, business_id } = payload;

    if (!phone || !message || !business_id) {
      console.warn("[WhatsApp] Missing required fields", { phone, message, business_id });
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    }

    // Normalize phone number
    const normalizedPhone = phone.startsWith("+") ? phone : `+${phone}`;

    // Check rate limit
    const canRespond = await rateLimitCheck(normalizedPhone, business_id, supabase);
    if (!canRespond) {
      console.log(`[WhatsApp] Rate limit exceeded for ${normalizedPhone}`);
      await supabase.from("whatsapp_incoming_messages").insert({
        business_id,
        phone: normalizedPhone,
        message,
        matched_keyword: null,
        auto_responded: false,
      });
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    }

    // Detect keyword
    const keyword = detectKeyword(message, KEYWORDS);

    if (!keyword) {
      // No keyword match, log but don't respond
      await supabase.from("whatsapp_incoming_messages").insert({
        business_id,
        phone: normalizedPhone,
        message,
        matched_keyword: null,
        auto_responded: false,
      });
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    }

    // Get business info
    const { data: business } = await supabase
      .from("businesses")
      .select("id, name, whatsapp_instance_id, whatsapp_api_token")
      .eq("id", business_id)
      .single();

    if (!business || !business.whatsapp_instance_id || !business.whatsapp_api_token) {
      console.warn(`[WhatsApp] Business ${business_id} not configured for WhatsApp`);
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    }

    // Generate response message with reservation link
    const reservationUrl = generateReservationUrl(business);
    const responseMessage = `Este es un enlace automático de ${business.name}.\n\nPuedes reservar tu cita aquí:\n${reservationUrl}`;

    // Send response (fire and forget, don't block on errors)
    enviarWhatsApp({
      phone: normalizedPhone,
      message: responseMessage,
      instanceId: business.whatsapp_instance_id,
      token: business.whatsapp_api_token,
    }).catch((err) => {
      console.error(`[WhatsApp] Failed to send response to ${normalizedPhone}:`, err);
    });

    // Log the incoming message and response
    const { error } = await supabase.from("whatsapp_incoming_messages").insert({
      business_id,
      phone: normalizedPhone,
      message,
      matched_keyword: keyword,
      auto_responded: true,
      responded_at: new Date().toISOString(),
    });

    if (error) {
      console.error(`[WhatsApp] Failed to log message:`, error);
    }

    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  } catch (error) {
    console.error("[WhatsApp] Webhook error:", error);
    // Always return 200 to avoid UltraMsg retry loops
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  }
}
