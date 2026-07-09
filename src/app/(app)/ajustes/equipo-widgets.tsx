"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Pencil, Plus } from "lucide-react";
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
import { Switch } from "@/components/ui/switch";
import {
  HorarioEditor,
  HORARIO_POR_DEFECTO,
  type Horario,
} from "@/components/horario-editor";
import {
  crearTrabajador,
  editarTrabajador,
  toggleTrabajador,
  type TrabajadorInput,
} from "./actions";

export interface TrabajadorRow {
  id: string;
  name: string;
  working_hours: Horario | null;
  is_active: boolean;
}

function FormTrabajador({
  inicial,
  horarioNegocio,
  pending,
  onSave,
}: {
  inicial: TrabajadorInput;
  horarioNegocio: Horario | null;
  pending: boolean;
  onSave: (form: TrabajadorInput) => void;
}) {
  const [name, setName] = useState(inicial.name);
  const [horarioPropio, setHorarioPropio] = useState(
    inicial.working_hours !== null
  );
  // Al activar "horario propio" se parte del horario del negocio para
  // que solo haya que retocar las diferencias
  const [horario, setHorario] = useState<Horario>(
    inicial.working_hours ??
      (horarioNegocio && Object.keys(horarioNegocio).length > 0
        ? horarioNegocio
        : HORARIO_POR_DEFECTO)
  );

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="tr-nombre">Nombre *</Label>
        <Input
          id="tr-nombre"
          placeholder="Ej: Ana"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </div>
      <label className="flex cursor-pointer items-center justify-between rounded-xl bg-slate-50 px-3 py-2.5">
        <span className="text-sm font-medium text-slate-700">
          Tiene su propio horario
        </span>
        <Switch checked={horarioPropio} onCheckedChange={setHorarioPropio} />
      </label>
      {horarioPropio ? (
        <div className="max-h-72 overflow-y-auto pr-1">
          <HorarioEditor value={horario} onChange={setHorario} />
        </div>
      ) : (
        <p className="text-xs text-slate-500">
          Trabaja en el horario de apertura del negocio.
        </p>
      )}
      <Button
        className="w-full"
        disabled={pending || !name.trim()}
        onClick={() =>
          onSave({ name, working_hours: horarioPropio ? horario : null })
        }
      >
        {pending ? "Guardando..." : "Guardar"}
      </Button>
    </div>
  );
}

export function NuevoTrabajadorDialog({
  businessId,
  slug,
  horarioNegocio,
}: {
  businessId: string;
  slug: string;
  horarioNegocio: Horario | null;
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const guardar = (form: TrabajadorInput) =>
    startTransition(async () => {
      const r = await crearTrabajador(businessId, slug, form);
      if (r.error) toast.error(r.error);
      else {
        toast.success("Persona añadida al equipo");
        setOpen(false);
      }
    });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Plus size={15} />
          Añadir persona
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Nueva persona</DialogTitle>
        </DialogHeader>
        <FormTrabajador
          inicial={{ name: "", working_hours: null }}
          horarioNegocio={horarioNegocio}
          pending={pending}
          onSave={guardar}
        />
      </DialogContent>
    </Dialog>
  );
}

export function FilaTrabajador({
  trabajador,
  slug,
  horarioNegocio,
}: {
  trabajador: TrabajadorRow;
  slug: string;
  horarioNegocio: Horario | null;
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const guardar = (form: TrabajadorInput) =>
    startTransition(async () => {
      const r = await editarTrabajador(trabajador.id, slug, form);
      if (r.error) toast.error(r.error);
      else {
        toast.success("Cambios guardados");
        setOpen(false);
      }
    });

  const toggle = (activo: boolean) =>
    startTransition(async () => {
      const r = await toggleTrabajador(trabajador.id, slug, activo);
      if (r.error) toast.error(r.error);
    });

  return (
    <div className="flex items-center gap-3 p-4">
      <div className="min-w-0 flex-1">
        <p
          className={`truncate text-sm font-medium ${trabajador.is_active ? "text-slate-900" : "text-slate-400 line-through"}`}
        >
          {trabajador.name}
        </p>
        <p className="truncate text-xs text-slate-500">
          {trabajador.working_hours
            ? "Horario propio"
            : "Horario del negocio"}
        </p>
      </div>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <button
            title="Editar"
            className="shrink-0 rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
          >
            <Pencil size={15} />
          </button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Editar persona</DialogTitle>
          </DialogHeader>
          <FormTrabajador
            inicial={{
              name: trabajador.name,
              working_hours: trabajador.working_hours,
            }}
            horarioNegocio={horarioNegocio}
            pending={pending}
            onSave={guardar}
          />
        </DialogContent>
      </Dialog>
      <Switch
        checked={trabajador.is_active}
        onCheckedChange={toggle}
        disabled={pending}
      />
    </div>
  );
}
