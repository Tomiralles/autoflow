import "server-only";
import { Resend } from "resend";

// Envío de email transaccional. Si Resend aún no está configurado
// (decisión: se activa más adelante), no rompe el flujo: devuelve false
// y el llamador sigue. Los flujos de negocio nunca dependen del envío.
export async function enviarEmail(opts: {
  to: string;
  subject: string;
  body: string;
  fromName?: string;
}): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.RESEND_FROM_EMAIL;
  if (!apiKey || !fromEmail) {
    console.log(`[email omitido: Resend sin configurar] to=${opts.to} subject=${opts.subject}`);
    return false;
  }

  try {
    const resend = new Resend(apiKey);
    const { error } = await resend.emails.send({
      from: opts.fromName ? `${opts.fromName} <${fromEmail}>` : fromEmail,
      to: opts.to,
      subject: opts.subject,
      text: opts.body,
    });
    if (error) {
      console.error("[email] error de Resend:", error);
      return false;
    }
    return true;
  } catch (e) {
    console.error("[email] fallo enviando:", e);
    return false;
  }
}
