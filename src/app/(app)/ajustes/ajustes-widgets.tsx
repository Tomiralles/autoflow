"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Check, Copy, ExternalLink, Pencil, Plus } from "lucide-react";
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
import { Textarea } from "@/components/ui/textarea";
import { logout } from "@/app/(auth)/actions";
import {
  crearServicio,
  editarServicio,
  guardarNegocio,
  toggleServicio,
  type NegocioInput,
  type ServicioInput,
} from "./actions";

// ---------- URL pública ----------

// El origen (protocolo+dominio) lo calcula el servidor a partir del host
// real de la petición (ver ajustes/page.tsx) — así no depende de
// NEXT_PUBLIC_APP_URL ni hay riesgo de desajuste en la hidratación.
function UrlPublica({ url }: { url: string }) {
  const [copiado, setCopiado] = useState(false);

  const copiar = async () => {
    await navigator.clipboard.writeText(url);
    setCopiado(true);
    toast.success("Enlace copiado");
    setTimeout(() => setCopiado(false), 2000);
  };

  return (
    <div className="flex items-center gap-2">
      <p className="min-w-0 flex-1 truncate rounded-md border bg-slate-50 px-3 py-2 text-sm text-slate-700">
        {url}
      </p>
      <Button
        type="button"
        variant="outline"
        size="icon"
        onClick={copiar}
        title="Copiar enlace"
      >
        {copiado ? <Check size={15} /> : <Copy size={15} />}
      </Button>
      <Button type="button" variant="outline" size="icon" asChild>
        <a href={url} target="_blank" rel="noopener noreferrer" title="Ver página">
          <ExternalLink size={15} />
        </a>
      </Button>
    </div>
  );
}

// ---------- Datos del negocio ----------

export function FormNegocio({
  businessId,
  inicial,
  slug,
  origen,
}: {
  businessId: string;
  inicial: NegocioInput;
  slug: string;
  origen: string;
}) {
  const [form, setForm] = useState(inicial);
  const [pending, startTransition] = useTransition();
  const set = (field: keyof NegocioInput, value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const guardar = () =>
    startTransition(async () => {
      const r = await guardarNegocio(businessId, form);
      if (r.error) toast.error(r.error);
      else toast.success("Cambios guardados");
    });

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="aj-nombre">Nombre del negocio</Label>
        <Input
          id="aj-nombre"
          value={form.name}
          onChange={(e) => set("name", e.target.value)}
        />
      </div>
      <div className="space-y-2">
        <Label>Tu página de reservas</Label>
        <p className="text-xs text-slate-500">
          Compártela con tus clientes: Instagram, WhatsApp, un cartel...
        </p>
        <UrlPublica url={`${origen}/${slug}`} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor="aj-tel">Teléfono</Label>
          <Input
            id="aj-tel"
            type="tel"
            value={form.phone}
            onChange={(e) => set("phone", e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="aj-email">Email</Label>
          <Input
            id="aj-email"
            type="email"
            value={form.email}
            onChange={(e) => set("email", e.target.value)}
          />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="aj-dir">Dirección</Label>
        <Input
          id="aj-dir"
          value={form.address}
          onChange={(e) => set("address", e.target.value)}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="aj-desc">Descripción</Label>
        <Textarea
          id="aj-desc"
          rows={2}
          className="resize-none"
          placeholder="Se muestra en tu página pública"
          value={form.description}
          onChange={(e) => set("description", e.target.value)}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="aj-color">Color principal</Label>
        <div className="flex items-center gap-2 rounded-md border border-input px-3 py-2">
          <input
            id="aj-color"
            type="color"
            className="h-8 w-8 cursor-pointer rounded border-0"
            value={form.primary_color}
            onChange={(e) => set("primary_color", e.target.value)}
          />
          <span className="text-sm text-slate-600">{form.primary_color}</span>
        </div>
      </div>
      <Button onClick={guardar} disabled={pending || !form.name.trim()}>
        {pending ? "Guardando..." : "Guardar cambios"}
      </Button>
    </div>
  );
}

// ---------- Servicios ----------

export interface ServicioRow {
  id: string;
  name: string;
  description: string | null;
  price: number | null;
  duration_minutes: number | null;
  materials_notes: string | null;
  is_active: boolean;
}

const SERVICIO_VACIO: ServicioInput = {
  name: "",
  description: "",
  price: "",
  duration_minutes: 60,
  materials_notes: "",
};

function FormServicio({
  inicial,
  pending,
  onSave,
}: {
  inicial: ServicioInput;
  pending: boolean;
  onSave: (form: ServicioInput) => void;
}) {
  const [form, setForm] = useState(inicial);
  const set = (field: keyof ServicioInput, value: string | number) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="sv-nombre">Nombre *</Label>
        <Input
          id="sv-nombre"
          placeholder="Ej: Corte y peinado"
          value={form.name}
          onChange={(e) => set("name", e.target.value)}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="sv-desc">Descripción</Label>
        <Textarea
          id="sv-desc"
          rows={2}
          className="resize-none"
          value={form.description}
          onChange={(e) => set("description", e.target.value)}
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor="sv-precio">Precio €</Label>
          <Input
            id="sv-precio"
            type="number"
            value={form.price}
            onChange={(e) => set("price", e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="sv-dur">Duración (min)</Label>
          <Input
            id="sv-dur"
            type="number"
            value={form.duration_minutes}
            onChange={(e) =>
              set("duration_minutes", parseInt(e.target.value) || 0)
            }
          />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="sv-mat">Materiales a preparar</Label>
        <Textarea
          id="sv-mat"
          rows={2}
          className="resize-none"
          placeholder="Ej: tinte rubio ceniza, papel de aluminio... Se muestra en el panel del día."
          value={form.materials_notes}
          onChange={(e) => set("materials_notes", e.target.value)}
        />
      </div>
      <Button
        className="w-full"
        disabled={pending || !form.name.trim()}
        onClick={() => onSave(form)}
      >
        {pending ? "Guardando..." : "Guardar"}
      </Button>
    </div>
  );
}

export function NuevoServicioDialog({ businessId }: { businessId: string }) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const guardar = (form: ServicioInput) =>
    startTransition(async () => {
      const r = await crearServicio(businessId, form);
      if (r.error) toast.error(r.error);
      else {
        toast.success("Servicio creado");
        setOpen(false);
      }
    });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Plus size={15} />
          Añadir servicio
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Nuevo servicio</DialogTitle>
        </DialogHeader>
        <FormServicio
          inicial={SERVICIO_VACIO}
          pending={pending}
          onSave={guardar}
        />
      </DialogContent>
    </Dialog>
  );
}

export function FilaServicio({ servicio }: { servicio: ServicioRow }) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const guardar = (form: ServicioInput) =>
    startTransition(async () => {
      const r = await editarServicio(servicio.id, form);
      if (r.error) toast.error(r.error);
      else {
        toast.success("Servicio actualizado");
        setOpen(false);
      }
    });

  const toggle = (activo: boolean) =>
    startTransition(async () => {
      const r = await toggleServicio(servicio.id, activo);
      if (r.error) toast.error(r.error);
    });

  return (
    <div className="flex items-center gap-3 p-4">
      <div className="min-w-0 flex-1">
        <p
          className={`truncate text-sm font-medium ${servicio.is_active ? "text-slate-900" : "text-slate-400 line-through"}`}
        >
          {servicio.name}
        </p>
        <p className="truncate text-xs text-slate-500">
          {[
            servicio.price != null ? `${servicio.price}€` : null,
            servicio.duration_minutes
              ? `${servicio.duration_minutes} min`
              : null,
          ]
            .filter(Boolean)
            .join(" · ")}
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
            <DialogTitle>Editar servicio</DialogTitle>
          </DialogHeader>
          <FormServicio
            inicial={{
              name: servicio.name,
              description: servicio.description ?? "",
              price: servicio.price != null ? String(servicio.price) : "",
              duration_minutes: servicio.duration_minutes ?? 60,
              materials_notes: servicio.materials_notes ?? "",
            }}
            pending={pending}
            onSave={guardar}
          />
        </DialogContent>
      </Dialog>
      <Switch
        checked={servicio.is_active}
        onCheckedChange={toggle}
        disabled={pending}
      />
    </div>
  );
}

// ---------- Sesión ----------

export function BotonSalir() {
  return (
    <form action={logout}>
      <Button variant="outline" type="submit">
        Cerrar sesión
      </Button>
    </form>
  );
}
