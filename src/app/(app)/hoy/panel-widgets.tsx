"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { CheckCheck, CheckCircle, Package } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { horaCorta, fechaCortaES } from "@/lib/dates";
import { completarTarea, confirmarCita, faenaTerminada } from "./actions";

export interface AptRow {
  id: string;
  client_name: string;
  client_phone: string | null;
  date: string;
  time: string;
  service_name: string | null;
  status: string;
  materials_notes: string | null;
}

const ESTADO_BADGE: Record<string, { label: string; className: string }> = {
  confirmada: { label: "Confirmada", className: "bg-green-100 text-green-700" },
  pendiente: { label: "Por confirmar", className: "bg-amber-100 text-amber-700" },
  completada: { label: "Completada", className: "bg-slate-200 text-slate-600" },
  cancelada: { label: "Cancelada", className: "bg-red-50 text-red-600" },
  no_asistio: { label: "No asistió", className: "bg-red-100 text-red-600" },
};

export function EstadoBadge({ status }: { status: string }) {
  const info = ESTADO_BADGE[status] ?? {
    label: status,
    className: "bg-slate-100 text-slate-600",
  };
  return <Badge className={info.className}>{info.label}</Badge>;
}

// Fila de "Reservas por confirmar" con su botón de un toque
export function ReservaPendiente({ apt, hoy }: { apt: AptRow; hoy: string }) {
  const [pending, startTransition] = useTransition();

  const confirmar = () =>
    startTransition(async () => {
      const r = await confirmarCita(apt.id);
      if (r.error) toast.error(r.error);
      else toast.success(`Cita de ${apt.client_name} confirmada`);
    });

  return (
    <div className="flex items-center gap-4 p-4">
      <div className="w-16 shrink-0 text-center">
        <p className="text-xs font-semibold text-slate-500">
          {apt.date === hoy ? "Hoy" : fechaCortaES(apt.date)}
        </p>
        <p className="text-sm font-bold text-slate-900">{horaCorta(apt.time)}</p>
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-slate-900">
          {apt.client_name}
        </p>
        <p className="truncate text-xs text-slate-500">
          {apt.service_name}
          {apt.client_phone ? ` · ${apt.client_phone}` : ""}
        </p>
      </div>
      <Button size="sm" onClick={confirmar} disabled={pending}>
        <CheckCircle size={14} />
        {pending ? "Confirmando..." : "Confirmar"}
      </Button>
    </div>
  );
}

// Fila de "Citas de hoy" con materiales y el cierre "Faena terminada"
export function CitaDeHoy({
  apt,
  avisoPorDefecto,
}: {
  apt: AptRow;
  avisoPorDefecto: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [cerrando, setCerrando] = useState(false);
  const [avisar, setAvisar] = useState(avisoPorDefecto);

  const cerrada = ["completada", "cancelada", "no_asistio"].includes(apt.status);

  const cerrar = () =>
    startTransition(async () => {
      const r = await faenaTerminada(apt.id, avisar);
      if (r.error) toast.error(r.error);
      else {
        toast.success(
          avisar
            ? "Faena cerrada y cliente avisado"
            : "Faena cerrada"
        );
        setCerrando(false);
      }
    });

  return (
    <div className="p-4">
      <div className="flex items-center gap-4">
        <div className="w-12 shrink-0 text-center">
          <p className="text-sm font-bold text-slate-900">
            {horaCorta(apt.time)}
          </p>
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-slate-900">
            {apt.client_name}
          </p>
          <p className="truncate text-xs text-slate-500">{apt.service_name}</p>
        </div>
        <EstadoBadge status={apt.status} />
      </div>

      {apt.materials_notes && (
        <div className="mt-2 ml-16 flex items-start gap-1.5 rounded-lg bg-slate-50 px-2.5 py-1.5 text-xs text-slate-500">
          <Package size={12} className="mt-0.5 shrink-0 text-slate-400" />
          <span className="whitespace-pre-wrap">{apt.materials_notes}</span>
        </div>
      )}

      {!cerrada &&
        (cerrando ? (
          <div className="mt-2 ml-16 space-y-2 rounded-lg border border-green-100 bg-green-50 p-3">
            <label className="flex cursor-pointer items-center gap-2 text-xs text-slate-700">
              <Checkbox
                checked={avisar}
                onCheckedChange={(v) => setAvisar(v === true)}
              />
              Avisar al cliente de que ya puede recoger (email + WhatsApp)
            </label>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCerrando(false)}
              >
                Cancelar
              </Button>
              <Button
                size="sm"
                className="bg-green-600 hover:bg-green-700"
                onClick={cerrar}
                disabled={pending}
              >
                <CheckCheck size={13} />
                {pending ? "Cerrando..." : "Confirmar cierre"}
              </Button>
            </div>
          </div>
        ) : (
          <div className="mt-2 ml-16">
            <button
              onClick={() => setCerrando(true)}
              className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-green-700 transition-colors hover:bg-green-50"
            >
              <CheckCheck size={13} />
              Faena terminada
            </button>
          </div>
        ))}
    </div>
  );
}

export interface TaskRow {
  id: string;
  title: string;
  type: string | null;
  due_date: string;
  lead_name: string | null;
  lead_phone: string | null;
}

const TIPO_TAREA: Record<string, string> = {
  llamar: "Llamar",
  volver_a_llamar: "Volver a llamar",
  enviar_email: "Enviar email",
  confirmar_cita: "Confirmar cita",
  hacer_upsell: "Hacer upsell",
  otro: "Tarea",
};

// Fila de "Qué hacer hoy" con su check de completar
export function TareaDeHoy({ task, hoy }: { task: TaskRow; hoy: string }) {
  const [pending, startTransition] = useTransition();
  const vencida = task.due_date < hoy;

  const completar = () =>
    startTransition(async () => {
      const r = await completarTarea(task.id);
      if (r.error) toast.error(r.error);
    });

  return (
    <div className="flex items-center gap-3 p-4">
      <span className="shrink-0 rounded-md border border-slate-200 bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600">
        {TIPO_TAREA[task.type || "otro"] ?? task.type}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-slate-900">
          {task.lead_name || task.title}
        </p>
        {task.lead_phone && (
          <p className="text-xs text-slate-500">{task.lead_phone}</p>
        )}
      </div>
      {vencida && (
        <span className="shrink-0 text-xs font-medium text-red-500">
          Vencida
        </span>
      )}
      <button
        onClick={completar}
        disabled={pending}
        title="Marcar como hecha"
        className="shrink-0 rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-green-50 hover:text-green-600"
      >
        <CheckCircle size={16} />
      </button>
    </div>
  );
}
