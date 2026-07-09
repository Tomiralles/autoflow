"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Package } from "lucide-react";
import { EstadoBadge, type AptRow } from "../hoy/panel-widgets";
import { horaCorta } from "@/lib/dates";
import { cambiarEstadoCita } from "./actions";

// Fila de la agenda: una sola acción visible y solo cuando procede
export function FilaCita({ apt }: { apt: AptRow & { notes: string | null } }) {
  const [pending, startTransition] = useTransition();
  const abierta = ["pendiente", "confirmada"].includes(apt.status);

  const cancelar = () =>
    startTransition(async () => {
      const r = await cambiarEstadoCita(apt.id, "cancelada");
      if (r.error) toast.error(r.error);
      else toast.success("Cita cancelada");
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
          <p className="truncate text-xs text-slate-500">
            {apt.service_name}
            {apt.staff_name ? ` · con ${apt.staff_name}` : ""}
            {apt.client_phone ? ` · ${apt.client_phone}` : ""}
          </p>
        </div>
        <EstadoBadge status={apt.status} />
        {abierta && (
          <button
            onClick={cancelar}
            disabled={pending}
            className="shrink-0 text-xs font-medium text-slate-400 hover:text-red-500"
          >
            Cancelar
          </button>
        )}
      </div>
      {apt.materials_notes && (
        <div className="mt-2 ml-16 flex items-start gap-1.5 rounded-lg bg-slate-50 px-2.5 py-1.5 text-xs text-slate-500">
          <Package size={12} className="mt-0.5 shrink-0 text-slate-400" />
          <span className="whitespace-pre-wrap">{apt.materials_notes}</span>
        </div>
      )}
      {apt.notes && (
        <p className="mt-1 ml-16 text-xs italic text-slate-400">{apt.notes}</p>
      )}
    </div>
  );
}
