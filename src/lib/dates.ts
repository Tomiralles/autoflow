// El producto es para negocios en España; el servidor (Vercel) corre en UTC,
// así que "hoy" se calcula siempre en Europe/Madrid para no cambiar de día
// a deshoras.
const TZ = "Europe/Madrid";

export function hoyISO(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export function fechaLargaES(date: Date = new Date()): string {
  return new Intl.DateTimeFormat("es-ES", {
    timeZone: TZ,
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(date);
}

// "2026-07-10" -> "10 jul"
export function fechaCortaES(iso: string): string {
  return new Intl.DateTimeFormat("es-ES", {
    timeZone: TZ,
    day: "numeric",
    month: "short",
  }).format(new Date(`${iso}T12:00:00`));
}

// "14:30:00" -> "14:30"
export function horaCorta(time: string): string {
  return time.slice(0, 5);
}
