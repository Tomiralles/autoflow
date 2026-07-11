"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { borrarCierre, crearCierre } from "./actions";

export interface CierreRow {
  id: string;
  start_date: string;
  end_date: string;
  reason: string | null;
}

function fechaLarga(iso: string): string {
  return new Date(`${iso}T12:00:00`).toLocaleDateString("es-ES", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export function NuevoCierreDialog({
  businessId,
  slug,
}: {
  businessId: string;
  slug: string;
}) {
  const [open, setOpen] = useState(false);
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");
  const [motivo, setMotivo] = useState("");
  const [pending, startTransition] = useTransition();

  const guardar = () =>
    startTransition(async () => {
      // Un solo día: basta con rellenar "desde"
      const fin = hasta || desde;
      const r = await crearCierre(businessId, slug, {
        start_date: desde,
        end_date: fin,
        reason: motivo.trim() || null,
      });
      if (r.error) toast.error(r.error);
      else {
        toast.success("Cierre guardado — esos días ya no aceptan reservas");
        setDesde("");
        setHasta("");
        setMotivo("");
        setOpen(false);
      }
    });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <Plus size={16} />
          Añadir
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Vacaciones o día cerrado</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="cierre-desde">Desde *</Label>
              <Input
                id="cierre-desde"
                type="date"
                value={desde}
                onChange={(e) => setDesde(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cierre-hasta">Hasta</Label>
              <Input
                id="cierre-hasta"
                type="date"
                value={hasta}
                min={desde || undefined}
                onChange={(e) => setHasta(e.target.value)}
              />
            </div>
          </div>
          <p className="text-xs text-slate-500">
            Para un solo día, deja &quot;Hasta&quot; vacío.
          </p>
          <div className="space-y-2">
            <Label htmlFor="cierre-motivo">Motivo (solo lo ves tú)</Label>
            <Input
              id="cierre-motivo"
              placeholder="Ej: Vacaciones de agosto"
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
            />
          </div>
          <Button
            className="w-full"
            disabled={pending || !desde}
            onClick={guardar}
          >
            Guardar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function FilaCierre({
  cierre,
  slug,
}: {
  cierre: CierreRow;
  slug: string;
}) {
  const [pending, startTransition] = useTransition();

  const borrar = () =>
    startTransition(async () => {
      const r = await borrarCierre(cierre.id, slug);
      if (r.error) toast.error(r.error);
      else toast.success("Cierre eliminado — esos días vuelven a estar disponibles");
    });

  const unDia = cierre.start_date === cierre.end_date;

  return (
    <div className="flex items-center gap-3 px-5 py-3">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-slate-900">
          {unDia
            ? fechaLarga(cierre.start_date)
            : `Del ${fechaLarga(cierre.start_date)} al ${fechaLarga(cierre.end_date)}`}
        </p>
        {cierre.reason && (
          <p className="truncate text-xs text-slate-500">{cierre.reason}</p>
        )}
      </div>
      <Button
        size="icon"
        variant="ghost"
        disabled={pending}
        onClick={borrar}
        aria-label="Eliminar cierre"
      >
        <Trash2 size={16} className="text-slate-400" />
      </Button>
    </div>
  );
}
