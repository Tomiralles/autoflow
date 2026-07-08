"use client";

import type { DayHours } from "@/lib/slots";

// Mismas claves que lib/slots.ts (DIAS, indexado por Date.getDay()).
const DIAS: { key: string; label: string }[] = [
  { key: "lunes", label: "Lunes" },
  { key: "martes", label: "Martes" },
  { key: "miercoles", label: "Miércoles" },
  { key: "jueves", label: "Jueves" },
  { key: "viernes", label: "Viernes" },
  { key: "sabado", label: "Sábado" },
  { key: "domingo", label: "Domingo" },
];

export type Horario = Record<string, DayHours>;

// El mismo por defecto que asume lib/slots.ts cuando no hay nada guardado:
// lunes a sábado de 9:00 a 19:00, domingo cerrado.
export const HORARIO_POR_DEFECTO: Horario = Object.fromEntries(
  DIAS.map(({ key }) => [
    key,
    key === "domingo"
      ? { open: false }
      : { open: true, start: "09:00", end: "19:00" },
  ])
);

export function HorarioEditor({
  value,
  onChange,
}: {
  value: Horario;
  onChange: (next: Horario) => void;
}) {
  const dia = (key: string): DayHours =>
    value[key] ?? { open: false, start: "09:00", end: "19:00" };

  const set = (key: string, patch: Partial<DayHours>) =>
    onChange({ ...value, [key]: { ...dia(key), ...patch } });

  return (
    <div className="space-y-2">
      {DIAS.map(({ key, label }) => {
        const d = dia(key);
        return (
          <div
            key={key}
            className="flex items-center gap-3 rounded-xl bg-slate-50 px-3 py-2.5"
          >
            <label className="flex w-28 shrink-0 cursor-pointer items-center gap-2">
              <input
                type="checkbox"
                checked={d.open ?? false}
                onChange={(e) => set(key, { open: e.target.checked })}
                className="h-5 w-5 shrink-0 cursor-pointer rounded accent-coral"
              />
              <span className="text-sm font-medium text-slate-700">
                {label}
              </span>
            </label>
            {d.open ? (
              <div className="flex flex-1 items-center gap-2">
                <input
                  type="time"
                  value={d.start || "09:00"}
                  onChange={(e) => set(key, { start: e.target.value })}
                  className="h-9 flex-1 rounded-lg border border-input bg-white px-2 text-sm"
                />
                <span className="text-slate-400">a</span>
                <input
                  type="time"
                  value={d.end || "19:00"}
                  onChange={(e) => set(key, { end: e.target.value })}
                  className="h-9 flex-1 rounded-lg border border-input bg-white px-2 text-sm"
                />
              </div>
            ) : (
              <span className="flex-1 text-sm text-slate-400">Cerrado</span>
            )}
          </div>
        );
      })}
    </div>
  );
}
