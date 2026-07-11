"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface CitaSemana {
  id: string;
  client_name: string;
  date: string;
  time: string;
  service_name: string | null;
  status: string;
  staff_name: string | null;
}

// Color del chip según estado (canceladas y no-asistidas no se pintan:
// solo meterían ruido en la semana)
const CHIP: Record<string, string> = {
  pendiente: "bg-amber-50 text-amber-800 border-amber-200",
  confirmada: "bg-green-50 text-green-800 border-green-200",
  completada: "bg-slate-100 text-slate-500 border-slate-200",
};

function lunesDe(iso: string): Date {
  const d = new Date(`${iso}T12:00:00`);
  const dow = (d.getDay() + 6) % 7; // 0 = lunes
  d.setDate(d.getDate() - dow);
  return d;
}

function aISO(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function SemanaView({
  citas,
  hoy,
}: {
  citas: CitaSemana[];
  hoy: string;
}) {
  // 0 = semana actual; solo se navega hacia delante (los datos cargados
  // empiezan en el lunes de esta semana)
  const [offset, setOffset] = useState(0);

  const dias = useMemo(() => {
    const lunes = lunesDe(hoy);
    lunes.setDate(lunes.getDate() + offset * 7);
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(lunes);
      d.setDate(d.getDate() + i);
      return {
        iso: aISO(d),
        etiqueta: new Intl.DateTimeFormat("es-ES", {
          weekday: "short",
        }).format(d),
        num: d.getDate(),
      };
    });
  }, [hoy, offset]);

  const rango = useMemo(() => {
    const fmt = (iso: string) =>
      new Intl.DateTimeFormat("es-ES", { day: "numeric", month: "short" }).format(
        new Date(`${iso}T12:00:00`)
      );
    return `${fmt(dias[0].iso)} — ${fmt(dias[6].iso)}`;
  }, [dias]);

  const porDia = useMemo(() => {
    const m = new Map<string, CitaSemana[]>();
    for (const c of citas) {
      if (!(c.status in CHIP)) continue;
      const grupo = m.get(c.date) ?? [];
      grupo.push(c);
      m.set(c.date, grupo);
    }
    return m;
  }, [citas]);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Button
          size="icon"
          variant="outline"
          disabled={offset === 0}
          onClick={() => setOffset((o) => o - 1)}
          aria-label="Semana anterior"
        >
          <ChevronLeft size={16} />
        </Button>
        <p className="text-sm font-semibold capitalize text-slate-700">
          {offset === 0 ? "Esta semana" : rango}
          {offset !== 0 && null}
        </p>
        <Button
          size="icon"
          variant="outline"
          onClick={() => setOffset((o) => o + 1)}
          aria-label="Semana siguiente"
        >
          <ChevronRight size={16} />
        </Button>
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-100 bg-white shadow-sm">
        <div className="grid min-w-[700px] grid-cols-7 divide-x divide-slate-50">
          {dias.map((dia) => {
            const grupo = (porDia.get(dia.iso) ?? []).sort((a, b) =>
              a.time.localeCompare(b.time)
            );
            const esHoy = dia.iso === hoy;
            return (
              <div key={dia.iso} className="min-h-40">
                <div
                  className={`border-b px-2 py-2 text-center ${
                    esHoy
                      ? "border-coral bg-coral/5"
                      : "border-slate-100 bg-slate-50/50"
                  }`}
                >
                  <p className="text-[11px] font-semibold uppercase text-slate-400">
                    {dia.etiqueta}
                  </p>
                  <p
                    className={`text-sm font-bold ${
                      esHoy ? "text-coral" : "text-slate-700"
                    }`}
                  >
                    {dia.num}
                  </p>
                </div>
                <div className="space-y-1 p-1.5">
                  {grupo.map((c) => (
                    <div
                      key={c.id}
                      className={`rounded-lg border px-1.5 py-1 ${CHIP[c.status]}`}
                      title={`${c.time.slice(0, 5)} ${c.client_name}${c.service_name ? ` · ${c.service_name}` : ""}${c.staff_name ? ` · con ${c.staff_name}` : ""}`}
                    >
                      <p className="text-[11px] font-bold leading-tight">
                        {c.time.slice(0, 5)}
                      </p>
                      <p className="truncate text-[11px] leading-tight">
                        {c.client_name}
                      </p>
                      {c.staff_name && (
                        <p className="truncate text-[10px] leading-tight opacity-70">
                          {c.staff_name}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-500">
        <span className="flex items-center gap-1">
          <span className="size-2.5 rounded-full border border-amber-200 bg-amber-50" />
          Por confirmar
        </span>
        <span className="flex items-center gap-1">
          <span className="size-2.5 rounded-full border border-green-200 bg-green-50" />
          Confirmada
        </span>
        <span className="flex items-center gap-1">
          <span className="size-2.5 rounded-full border border-slate-200 bg-slate-100" />
          Completada
        </span>
      </div>
    </div>
  );
}
