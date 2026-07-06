"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
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
import {
  borrarGasto,
  cancelarFactura,
  crearFactura,
  crearGasto,
  marcarFacturaCobrada,
  type FacturaInput,
  type GastoInput,
} from "./actions";

// ---------- Facturas ----------

export interface FacturaRow {
  id: string;
  client_name: string;
  total: number;
  status: string;
  due_date: string | null;
  paid_date: string | null;
  created_at: string;
}

const ESTADO_FACTURA: Record<string, { label: string; className: string }> = {
  borrador: { label: "Borrador", className: "bg-slate-100 text-slate-600" },
  enviada: { label: "Pendiente", className: "bg-amber-100 text-amber-700" },
  cobrada: { label: "Cobrada", className: "bg-green-100 text-green-700" },
  vencida: { label: "Vencida", className: "bg-red-100 text-red-700" },
  cancelada: { label: "Cancelada", className: "bg-slate-100 text-slate-400" },
};

export function NuevaFacturaDialog({
  businessId,
  hoy,
}: {
  businessId: string;
  hoy: string;
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [form, setForm] = useState<FacturaInput>({
    client_name: "",
    concepto: "",
    total: "",
    due_date: hoy,
  });

  const guardar = () =>
    startTransition(async () => {
      const r = await crearFactura(businessId, form);
      if (r.error) toast.error(r.error);
      else {
        toast.success("Factura creada");
        setForm({ client_name: "", concepto: "", total: "", due_date: hoy });
        setOpen(false);
      }
    });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus size={15} />
          Nueva factura
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Nueva factura</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="fa-cliente">Cliente *</Label>
            <Input
              id="fa-cliente"
              placeholder="Nombre del cliente"
              value={form.client_name}
              onChange={(e) =>
                setForm({ ...form, client_name: e.target.value })
              }
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="fa-concepto">Concepto</Label>
            <Input
              id="fa-concepto"
              placeholder="Ej: Tratamiento completo"
              value={form.concepto}
              onChange={(e) => setForm({ ...form, concepto: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="fa-total">Importe € *</Label>
              <Input
                id="fa-total"
                type="number"
                value={form.total}
                onChange={(e) => setForm({ ...form, total: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="fa-venc">Vencimiento</Label>
              <Input
                id="fa-venc"
                type="date"
                value={form.due_date}
                onChange={(e) => setForm({ ...form, due_date: e.target.value })}
              />
            </div>
          </div>
          <Button
            className="w-full"
            disabled={pending || !form.client_name.trim() || !form.total}
            onClick={guardar}
          >
            {pending ? "Guardando..." : "Crear factura"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function FilaFactura({ factura }: { factura: FacturaRow }) {
  const [pending, startTransition] = useTransition();
  const abierta = ["borrador", "enviada", "vencida"].includes(factura.status);
  const estado = ESTADO_FACTURA[factura.status] ?? ESTADO_FACTURA.enviada;

  const cobrar = () =>
    startTransition(async () => {
      const r = await marcarFacturaCobrada(factura.id);
      if (r.error) toast.error(r.error);
      else toast.success(`${factura.total}€ cobrados`);
    });

  const cancelar = () =>
    startTransition(async () => {
      const r = await cancelarFactura(factura.id);
      if (r.error) toast.error(r.error);
    });

  return (
    <div className="flex items-center gap-3 p-4">
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-slate-900">
          {factura.client_name}
        </p>
        <p className="text-xs text-slate-500">
          {factura.due_date
            ? `Vence ${new Date(factura.due_date).toLocaleDateString("es-ES")}`
            : "Sin vencimiento"}
          {factura.paid_date &&
            ` · cobrada ${new Date(factura.paid_date).toLocaleDateString("es-ES")}`}
        </p>
      </div>
      <span className="shrink-0 text-sm font-bold text-slate-900">
        {factura.total}€
      </span>
      <Badge className={estado.className}>{estado.label}</Badge>
      {abierta && (
        <div className="flex shrink-0 gap-1.5">
          <Button size="sm" onClick={cobrar} disabled={pending}>
            Cobrada
          </Button>
          <button
            onClick={cancelar}
            disabled={pending}
            className="text-xs font-medium text-slate-400 hover:text-red-500"
          >
            Cancelar
          </button>
        </div>
      )}
    </div>
  );
}

// ---------- Gastos ----------

export interface GastoRow {
  id: string;
  category: string;
  description: string;
  amount: number;
  date: string;
}

const CATEGORIAS = [
  { id: "gastos_fijos", label: "Gastos fijos" },
  { id: "material", label: "Material" },
  { id: "personal", label: "Personal" },
  { id: "marketing", label: "Marketing" },
  { id: "otros", label: "Otros" },
];

export function NuevoGastoDialog({
  businessId,
  hoy,
}: {
  businessId: string;
  hoy: string;
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [form, setForm] = useState<GastoInput>({
    category: "material",
    description: "",
    amount: "",
    date: hoy,
  });

  const guardar = () =>
    startTransition(async () => {
      const r = await crearGasto(businessId, form);
      if (r.error) toast.error(r.error);
      else {
        toast.success("Gasto apuntado");
        setForm({ category: "material", description: "", amount: "", date: hoy });
        setOpen(false);
      }
    });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <Plus size={15} />
          Apuntar gasto
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Apuntar gasto</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="ga-desc">Descripción *</Label>
            <Input
              id="ga-desc"
              placeholder="Ej: Tinte y material de peluquería"
              value={form.description}
              onChange={(e) =>
                setForm({ ...form, description: e.target.value })
              }
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Categoría</Label>
              <Select
                value={form.category}
                onValueChange={(v) => setForm({ ...form, category: v })}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIAS.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="ga-importe">Importe € *</Label>
              <Input
                id="ga-importe"
                type="number"
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="ga-fecha">Fecha</Label>
            <Input
              id="ga-fecha"
              type="date"
              value={form.date}
              onChange={(e) => setForm({ ...form, date: e.target.value })}
            />
          </div>
          <Button
            className="w-full"
            disabled={pending || !form.description.trim() || !form.amount}
            onClick={guardar}
          >
            {pending ? "Guardando..." : "Apuntar gasto"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function FilaGasto({ gasto }: { gasto: GastoRow }) {
  const [pending, startTransition] = useTransition();
  const categoria =
    CATEGORIAS.find((c) => c.id === gasto.category)?.label ?? gasto.category;

  const borrar = () =>
    startTransition(async () => {
      const r = await borrarGasto(gasto.id);
      if (r.error) toast.error(r.error);
    });

  return (
    <div className="flex items-center gap-3 p-4">
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-slate-900">
          {gasto.description}
        </p>
        <p className="text-xs text-slate-500">
          {categoria} · {new Date(gasto.date).toLocaleDateString("es-ES")}
        </p>
      </div>
      <span className="shrink-0 text-sm font-bold text-slate-900">
        -{gasto.amount}€
      </span>
      <button
        onClick={borrar}
        disabled={pending}
        title="Borrar"
        className="shrink-0 rounded-lg p-1.5 text-slate-300 transition-colors hover:bg-red-50 hover:text-red-500"
      >
        <Trash2 size={15} />
      </button>
    </div>
  );
}
