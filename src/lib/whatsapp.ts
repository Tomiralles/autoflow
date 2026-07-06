import "server-only";

// Envío por UltraMsg. Cada negocio puede tener su propia instancia
// (businesses.whatsapp_instance_id / whatsapp_api_token); si no, se usan
// las credenciales de plataforma del .env. Sin credenciales → no-op.
export async function enviarWhatsApp(opts: {
  phone: string;
  message: string;
  instanceId?: string | null;
  token?: string | null;
}): Promise<boolean> {
  const instanceId = opts.instanceId || process.env.ULTRAMSG_INSTANCE_ID;
  const token = opts.token || process.env.ULTRAMSG_TOKEN;
  if (!instanceId || !token || !opts.phone) {
    console.log(`[whatsapp omitido: sin configurar] to=${opts.phone}`);
    return false;
  }

  try {
    const res = await fetch(
      `https://api.ultramsg.com/${instanceId}/messages/chat`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, to: opts.phone, body: opts.message }),
      }
    );
    if (!res.ok) {
      console.error("[whatsapp] error UltraMsg:", res.status, await res.text());
      return false;
    }
    return true;
  } catch (e) {
    console.error("[whatsapp] fallo enviando:", e);
    return false;
  }
}
