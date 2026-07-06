"use client";

import { useCallback, useMemo, useState, useTransition } from "react";
import { Check, ChevronLeft, Clock } from "lucide-react";
import { huecosOcupados, reservar } from "./actions";

export interface PublicService {
  id: string;
  name: string;
  description: string | null;
  price: number | null;
  duration_minutes: number | null;
  image_url: string | null;
}

export interface DayHours {
  open?: boolean;
  start?: string;
  end?: string;
}

export interface PublicBusiness {
  name: string;
  slug: string;
  phone: string | null;
  primary_color: string;
  working_hours: Record<string, DayHours> | null;
  services: PublicService[];
  show_prices: boolean;
}

const DIAS = ["domingo", "lunes", "martes", "miercoles", "jueves", "viernes", "sabado"];

function generarHuecos(start: string, end: string, durationMins: number): string[] {
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

function proximosDias(n: number): { iso: string; dia: string; num: string; mes: string }[] {
  const out = [];
  const fmt = (d: Date, opts: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat("es-ES", { timeZone: "Europe/Madrid", ...opts }).format(d);
  for (let i = 0; i < n; i++) {
    const d = new Date(Date.now() + i * 86400000);
    out.push({
      iso: new Intl.DateTimeFormat("en-CA", {
        timeZone: "Europe/Madrid",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(d),
      dia: fmt(d, { weekday: "short" }),
      num: fmt(d, { day: "numeric" }),
      mes: fmt(d, { month: "short" }),
    });
  }
  return out;
}

type Paso = "servicio" | "calendario" | "datos" | "exito";

export function ReservaWidget({ business }: { business: PublicBusiness }) {
  const [paso, setPaso] = useState<Paso>("servicio");
  const [servicio, setServicio] = useState<PublicService | null>(null);
  const [fecha, setFecha] = useState<string | null>(null);
  const [hora, setHora] = useState<string | null>(null);
  const [ocupadas, setOcupadas] = useState<string[]>([]);
  const [cargandoHuecos, setCargandoHuecos] = useState(false);
  const [datos, setDatos] = useState({ full_name: "", email: "", phone: "" });
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  const color = business.primary_color || "#3B82F6";
  const dias = useMemo(() => proximosDias(14), []);

  // Horario del día: si el negocio no lo ha configurado, L-S 09:00-19:00
  const horarioDelDia = useCallback(
    (iso: string): DayHours => {
      const nombre = DIAS[new Date(`${iso}T12:00:00`).getDay()];
      const wh = business.working_hours;
      if (wh && Object.keys(wh).length > 0) return wh[nombre] ?? { open: false };
      return nombre === "domingo"
        ? { open: false }
        : { open: true, start: "09:00", end: "19:00" };
    },
    [business.working_hours]
  );

  const elegirFecha = (iso: string) => {
    setFecha(iso);
    setHora(null);
    setCargandoHuecos(true);
    huecosOcupados(business.slug, iso)
      .then(setOcupadas)
      .finally(() => setCargandoHuecos(false));
  };

  const huecosLibres = useMemo(() => {
    if (!fecha) return [];
    const h = horarioDelDia(fecha);
    if (!h.open) return [];
    const todos = generarHuecos(
      h.start || "09:00",
      h.end || "19:00",
      servicio?.duration_minutes || 60
    );
    return todos.filter((t) => !ocupadas.includes(t));
  }, [fecha, ocupadas, servicio, horarioDelDia]);

  const confirmarReserva = () =>
    startTransition(async () => {
      if (!servicio || !fecha || !hora) return;
      setError("");
      const r = await reservar(business.slug, {
        service_id: servicio.id,
        date: fecha,
        time: hora,
        ...datos,
      });
      if (r.error) {
        setError(r.error);
        if (r.error.includes("esa hora")) {
          setHora(null);
          setPaso("calendario");
          const res = await huecosOcupados(business.slug, fecha);
          setOcupadas(res);
        }
      } else {
        setPaso("exito");
      }
    });

  return (
    <div className="mx-auto max-w-md space-y-4 px-5 py-6">
      {paso !== "servicio" && paso !== "exito" && (
        <button
          onClick={() => setPaso(paso === "datos" ? "calendario" : "servicio")}
          className="flex items-center gap-1 text-sm font-medium text-slate-500 hover:text-slate-700"
        >
          <ChevronLeft size={16} /> Atrás
        </button>
      )}

      {paso === "servicio" && (
        <div className="space-y-3">
          <h2 className="text-lg font-bold text-slate-900">Elige un servicio</h2>
          {business.services.length === 0 ? (
            <p className="py-12 text-center text-slate-400">
              No hay servicios disponibles
            </p>
          ) : (
            business.services.map((s) => (
              <button
                key={s.id}
                onClick={() => {
                  setServicio(s);
                  setFecha(null);
                  setHora(null);
                  setPaso("calendario");
                }}
                className="w-full rounded-2xl border border-slate-100 bg-white p-5 text-left shadow-sm transition-all hover:shadow-md"
              >
                <p className="font-bold text-slate-900">{s.name}</p>
                {s.description && (
                  <p className="mt-0.5 line-clamp-2 text-sm text-slate-500">
                    {s.description}
                  </p>
                )}
                <div className="mt-2 flex items-center gap-3">
                  {business.show_prices && (s.price ?? 0) > 0 && (
                    <span className="text-sm font-bold" style={{ color }}>
                      {s.price}€
                    </span>
                  )}
                  {s.duration_minutes && (
                    <span className="flex items-center gap-1 text-xs text-slate-400">
                      <Clock size={11} />
                      {s.duration_minutes} min
                    </span>
                  )}
                </div>
              </button>
            ))
          )}
        </div>
      )}

      {paso === "calendario" && (
        <div className="space-y-4">
          <h2 className="text-lg font-bold text-slate-900">
            ¿Cuándo te viene bien?
          </h2>
          {error && (
            <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm font-medium text-amber-700">
              {error}
            </p>
          )}
          <div className="flex gap-2 overflow-x-auto pb-1">
            {dias.map((d) => {
              const abierto = horarioDelDia(d.iso).open;
              const activo = fecha === d.iso;
              return (
                <button
                  key={d.iso}
                  disabled={!abierto}
                  onClick={() => elegirFecha(d.iso)}
                  className="flex w-14 shrink-0 flex-col items-center rounded-xl border-2 py-2 text-center transition-all disabled:opacity-30"
                  style={
                    activo
                      ? { borderColor: color, backgroundColor: `${color}18` }
                      : { borderColor: "#e2e8f0" }
                  }
                >
                  <span className="text-[11px] capitalize text-slate-500">
                    {d.dia}
                  </span>
                  <span className="text-base font-bold text-slate-900">
                    {d.num}
                  </span>
                  <span className="text-[10px] text-slate-400">{d.mes}</span>
                </button>
              );
            })}
          </div>
          {fecha && (
            <div>
              {cargandoHuecos ? (
                <p className="py-6 text-center text-sm text-slate-400">
                  Buscando huecos...
                </p>
              ) : huecosLibres.length === 0 ? (
                <p className="py-6 text-center text-sm text-slate-400">
                  No quedan huecos ese día. Prueba otro.
                </p>
              ) : (
                <div className="grid grid-cols-4 gap-2">
                  {huecosLibres.map((t) => (
                    <button
                      key={t}
                      onClick={() => setHora(t)}
                      className="rounded-lg border-2 py-2 text-sm font-semibold transition-all"
                      style={
                        hora === t
                          ? { borderColor: color, backgroundColor: color, color: "#fff" }
                          : { borderColor: "#e2e8f0", color: "#334155" }
                      }
                    >
                      {t}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
          <button
            disabled={!fecha || !hora}
            onClick={() => setPaso("datos")}
            className="w-full rounded-xl py-3 text-sm font-bold text-white transition-opacity disabled:opacity-40"
            style={{ backgroundColor: color }}
          >
            Continuar
          </button>
        </div>
      )}

      {paso === "datos" && (
        <div className="space-y-4">
          <h2 className="text-lg font-bold text-slate-900">Tus datos</h2>
          <div className="rounded-xl bg-white p-4 text-sm shadow-sm">
            <p className="font-semibold text-slate-900">{servicio?.name}</p>
            <p className="mt-0.5 text-slate-500">
              {fecha &&
                new Intl.DateTimeFormat("es-ES", {
                  timeZone: "Europe/Madrid",
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                }).format(new Date(`${fecha}T12:00:00`))}{" "}
              · {hora}
            </p>
          </div>
          <input
            className="w-full rounded-xl border-2 border-slate-200 px-4 py-3 text-sm outline-none focus:border-slate-400"
            placeholder="Tu nombre *"
            value={datos.full_name}
            onChange={(e) => setDatos({ ...datos, full_name: e.target.value })}
          />
          <input
            className="w-full rounded-xl border-2 border-slate-200 px-4 py-3 text-sm outline-none focus:border-slate-400"
            placeholder="Tu teléfono"
            type="tel"
            value={datos.phone}
            onChange={(e) => setDatos({ ...datos, phone: e.target.value })}
          />
          <input
            className="w-full rounded-xl border-2 border-slate-200 px-4 py-3 text-sm outline-none focus:border-slate-400"
            placeholder="Tu email (para recibir la confirmación)"
            type="email"
            value={datos.email}
            onChange={(e) => setDatos({ ...datos, email: e.target.value })}
          />
          {error && (
            <p className="text-sm font-medium text-red-600">{error}</p>
          )}
          <button
            disabled={pending || !datos.full_name.trim()}
            onClick={confirmarReserva}
            className="w-full rounded-xl py-3 text-sm font-bold text-white transition-opacity disabled:opacity-40"
            style={{ backgroundColor: color }}
          >
            {pending ? "Reservando..." : "Confirmar reserva"}
          </button>
        </div>
      )}

      {paso === "exito" && (
        <div className="space-y-4 py-8 text-center">
          <div
            className="mx-auto flex h-20 w-20 items-center justify-center rounded-full"
            style={{ backgroundColor: `${color}20` }}
          >
            <Check size={36} style={{ color }} />
          </div>
          <h2 className="text-xl font-bold text-slate-900">¡Reserva recibida!</h2>
          <p className="text-sm text-slate-500">
            {servicio?.name} · {hora}
            <br />
            {business.name} te confirmará la cita en breve
            {datos.email ? " — te hemos enviado los detalles por email" : ""}.
          </p>
        </div>
      )}
    </div>
  );
}
