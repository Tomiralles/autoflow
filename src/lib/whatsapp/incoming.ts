import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Detect if a message contains a keyword.
 * Case-insensitive, whole-word matching.
 */
export function detectKeyword(message: string, keywords: string[]): string | null {
  const lowerMessage = message.toLowerCase();

  for (const keyword of keywords) {
    // Whole-word match: surrounded by word boundaries or spaces
    const regex = new RegExp(`\\b${keyword}\\b`, "i");
    if (regex.test(lowerMessage)) {
      return keyword;
    }
  }

  return null;
}

/**
 * Check rate limit: max 3 responses per phone per minute.
 */
export async function rateLimitCheck(
  phone: string,
  businessId: string,
  supabase: SupabaseClient
): Promise<boolean> {
  const oneMinuteAgo = new Date(Date.now() - 60000).toISOString();

  const { data, error } = await supabase
    .from("whatsapp_incoming_messages")
    .select("id")
    .eq("phone", phone)
    .eq("business_id", businessId)
    .eq("auto_responded", true)
    .gte("responded_at", oneMinuteAgo);

  if (error) {
    console.error("[WhatsApp] Rate limit check error:", error);
    // On error, allow the message (fail open)
    return true;
  }

  const count = data?.length ?? 0;
  return count < 3;
}

/**
 * Enlace a la página pública de reservas del negocio: {APP_URL}/{slug}.
 */
export function generateReservationUrl(business: { slug: string }): string {
  const baseUrl = (
    process.env.NEXT_PUBLIC_APP_URL || "https://autoflow-five-alpha.vercel.app"
  )
    .trim()
    .replace(/\/$/, "");
  return `${baseUrl}/${business.slug}`;
}
