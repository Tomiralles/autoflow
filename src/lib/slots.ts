// Generación de huecos horarios de la página pública de reservas.
// Separado del widget para poder testearlo (lógica pura, sin React).

export interface DayHours {
  open?: boolean;
  start?: string;
  end?: string;
}

const DIAS = [
  "domingo",
  "lunes",
  "martes",
  "miercoles",
  "jueves",
  "viernes",
  "sabado",
];

export interface Ocupacion {
  time: string; // "HH:MM"
  duration: number; // minutos
}

function aMinutos(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

// Quita los huecos que se solapan con alguna cita existente. Comparar
// solo la hora de inicio no basta: una cita de 120 min debe bloquear
// también los huecos que caen dentro de ella.
export function filtrarHuecosLibres(
  candidatos: string[],
  durationMins: number,
  ocupadas: Ocupacion[]
): string[] {
  const rangos = ocupadas.map((o) => {
    const ini = aMinutos(o.time);
    return [ini, ini + (o.duration || 60)] as const;
  });
  return candidatos.filter((t) => {
    const ini = aMinutos(t);
    const fin = ini + durationMins;
    return !rangos.some(([oIni, oFin]) => ini < oFin && fin > oIni);
  });
}

// Para el día de HOY, quita los huecos cuya hora ya pasó. `ahora` es la
// hora actual "HH:MM" en la zona del negocio (Europe/Madrid).
export function sinHuecosPasados(
  candidatos: string[],
  esHoy: boolean,
  ahora: string
): string[] {
  if (!esHoy) return candidatos;
  return candidatos.filter((t) => t > ahora);
}

export function generarHuecos(
  start: string,
  end: string,
  durationMins: number
): string[] {
  const slots: string[] = [];
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  let cur = sh * 60 + sm;
  const endMin = eh * 60 + em;
  while (cur + durationMins <= endMin) {
    slots.push(
      `${String(Math.floor(cur / 60)).padStart(2, "0")}:${String(cur % 60).padStart(2, "0")}`
    );
    cur += durationMins;
  }
  return slots;
}

// Horario de un día ISO según working_hours del negocio; sin configurar,
// se asume abierto L-S de 09:00 a 19:00 (domingo cerrado).
export function horarioDelDia(
  iso: string,
  workingHours: Record<string, DayHours> | null
): DayHours {
  const nombre = DIAS[new Date(`${iso}T12:00:00`).getDay()];
  if (workingHours && Object.keys(workingHours).length > 0) {
    return workingHours[nombre] ?? { open: false };
  }
  return nombre === "domingo"
    ? { open: false }
    : { open: true, start: "09:00", end: "19:00" };
}
