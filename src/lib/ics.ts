// Genera un .ics estándar (RFC 5545) para una cita, para que el cliente la
// añada a su calendario (Google, Apple, Outlook...) con un toque. Sin OAuth.
// Portado de src/lib/ics.js del proyecto viejo; aquí va como ADJUNTO real
// en el email (Resend lo soporta), no como enlace subido a storage.

function escapeIcsText(value: string | null | undefined): string {
  return String(value || "")
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\n/g, "\\n");
}

// Hora local flotante (sin Z / TZID): la app de calendario aplica la zona
// del dispositivo — correcto aquí porque el cliente es local al negocio.
function toIcsLocalDateTime(date: string, time: string): string {
  return `${date.replace(/-/g, "")}T${time.replace(":", "")}00`;
}

function toIcsUtcDateTime(d: Date): string {
  return d.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
}

function addMinutes(
  date: string,
  time: string,
  minutes: number
): { date: string; time: string } {
  const start = new Date(`${date}T${time}:00`);
  const end = new Date(start.getTime() + minutes * 60000);
  const pad = (n: number) => String(n).padStart(2, "0");
  return {
    date: `${end.getFullYear()}-${pad(end.getMonth() + 1)}-${pad(end.getDate())}`,
    time: `${pad(end.getHours())}:${pad(end.getMinutes())}`,
  };
}

export function buildIcsContent(opts: {
  id: string;
  serviceName?: string | null;
  date: string;
  time: string; // "HH:MM"
  durationMinutes?: number | null;
  businessName?: string | null;
  businessPhone?: string | null;
  businessAddress?: string | null;
  clientName?: string | null;
}): string {
  const end = addMinutes(opts.date, opts.time, opts.durationMinutes || 60);
  const summary = `${opts.serviceName || "Cita"} - ${opts.businessName || ""}`.trim();
  const descriptionParts = [
    opts.serviceName ? `Servicio: ${opts.serviceName}` : null,
    opts.businessPhone ? `Teléfono: ${opts.businessPhone}` : null,
  ].filter(Boolean);

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//AutoFlow AI//Booking//ES",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${opts.id}@autoflow-ai`,
    `DTSTAMP:${toIcsUtcDateTime(new Date())}`,
    `DTSTART:${toIcsLocalDateTime(opts.date, opts.time)}`,
    `DTEND:${toIcsLocalDateTime(end.date, end.time)}`,
    `SUMMARY:${escapeIcsText(summary)}`,
    `DESCRIPTION:${escapeIcsText(descriptionParts.join("\n"))}`,
    opts.businessAddress ? `LOCATION:${escapeIcsText(opts.businessAddress)}` : null,
    "END:VEVENT",
    "END:VCALENDAR",
  ].filter(Boolean);

  return lines.join("\r\n");
}
