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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  cambiarEtapa,
  crearCliente,
  editarCliente,
  type ClienteInput,
} from "./actions";

// Etapas del pipeline con etiquetas sin jerga (decisión de diseño)
export const ETAPAS = [
  { id: "nuevo_lead", label: "Nuevo" },
  { id: "contactado", label: "Contactado" },
  { id: "cita_confirmada", label: "Cita confirmada" },
  { id: "propuesta_enviada", label: "Propuesta enviada" },
  { id: "en_negociacion", label: "En negociación" },
  { id: "cerrado_ganado", label: "Ganado ✓" },
  { id: "cerrado_perdido", label: "Perdido" },
] as const;

export interface ClienteRow {
  id: string;
  full_name: string;
  phone: string | null;
  email: string | null;
  pipeline_stage: string;
  status: string;
  notes: string | null;
  service_name: string | null;
}

const VACIO: ClienteInput = { full_name: "", phone: "", email: "", notes: "" };

function FormCliente({
  inicial,
  pending,
  onSave,
}: {
  inicial: ClienteInput;
  pending: boolean;
  onSave: (form: ClienteInput) => void;
}) {
  const [form, setForm] = useState(inicial);
  const set = (field: keyof ClienteInput, value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="cl-nombre">Nombre *</Label>
        <Input
          id="cl-nombre"
          placeholder="Nombre y apellidos"
          value={form.full_name}
          onChange={(e) => set("full_name", e.target.value)}
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor="cl-tel">Teléfono</Label>
          <Input
            id="cl-tel"
            type="tel"
            value={form.phone}
            onChange={(e) => set("phone", e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="cl-email">Email</Label>
          <Input
            id="cl-email"
            type="email"
            value={form.email}
            onChange={(e) => set("email", e.target.value)}
          />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="cl-notas">Notas</Label>
        <Textarea
          id="cl-notas"
          rows={2}
          className="resize-none"
          value={form.notes}
          onChange={(e) => set("notes", e.target.value)}
        />
      </div>
      <Button
        className="w-full"
        disabled={pending || !form.full_name.trim()}
        onClick={() => onSave(form)}
      >
        {pending ? "Guardando..." : "Guardar"}
      </Button>
    </div>
  );
}

export function NuevoClienteDialog({ businessId }: { businessId: string }) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const guardar = (form: ClienteInput) =>
    startTransition(async () => {
      const r = await crearCliente(businessId, form);
      if (r.error) toast.error(r.error);
      else {
        toast.success("Cliente guardado");
        setOpen(false);
      }
    });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus size={16} />
          Nuevo cliente
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Nuevo cliente</DialogTitle>
        </DialogHeader>
        <FormCliente inicial={VACIO} pending={pending} onSave={guardar} />
      </DialogContent>
    </Dialog>
  );
}

export function FilaCliente({ cliente }: { cliente: ClienteRow }) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const guardar = (form: ClienteInput) =>
    startTransition(async () => {
      const r = await editarCliente(cliente.id, form);
      if (r.error) toast.error(r.error);
      else {
        toast.success("Cliente actualizado");
        setOpen(false);
      }
    });

  const moverEtapa = (etapa: string) =>
    startTransition(async () => {
      const r = await cambiarEtapa(cliente.id, etapa);
      if (r.error) toast.error(r.error);
    });

  return (
    <div className="flex items-center gap-3 p-4">
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-slate-900">
          {cliente.full_name}
        </p>
        <p className="truncate text-xs text-slate-500">
          {[cliente.phone, cliente.email, cliente.service_name]
            .filter(Boolean)
            .join(" · ") || "Sin datos de contacto"}
        </p>
      </div>
      <Select value={cliente.pipeline_stage} onValueChange={moverEtapa}>
        <SelectTrigger
          size="sm"
          className="w-[150px] shrink-0"
          disabled={pending}
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {ETAPAS.map((e) => (
            <SelectItem key={e.id} value={e.id}>
              {e.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
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
            <DialogTitle>Editar cliente</DialogTitle>
          </DialogHeader>
          <FormCliente
            inicial={{
              full_name: cliente.full_name,
              phone: cliente.phone ?? "",
              email: cliente.email ?? "",
              notes: cliente.notes ?? "",
            }}
            pending={pending}
            onSave={guardar}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
