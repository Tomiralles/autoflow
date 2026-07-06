"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Plus } from "lucide-react";
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
import { crearCita, type NuevaCitaInput } from "./actions";

export interface ServiceOption {
  id: string;
  name: string;
}

const VACIA: NuevaCitaInput = {
  client_name: "",
  client_phone: "",
  client_email: "",
  service_id: "",
  date: "",
  time: "",
  notes: "",
};

export function NuevaCitaDialog({
  businessId,
  services,
  hoy,
}: {
  businessId: string;
  services: ServiceOption[];
  hoy: string;
}) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<NuevaCitaInput>({ ...VACIA, date: hoy });
  const [pending, startTransition] = useTransition();

  const set = (field: keyof NuevaCitaInput, value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const guardar = () =>
    startTransition(async () => {
      const r = await crearCita(businessId, form);
      if (r.error) toast.error(r.error);
      else {
        toast.success("Cita creada");
        setForm({ ...VACIA, date: hoy });
        setOpen(false);
      }
    });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus size={16} />
          Nueva cita
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Nueva cita</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="nc-nombre">Cliente *</Label>
            <Input
              id="nc-nombre"
              placeholder="Nombre del cliente"
              value={form.client_name}
              onChange={(e) => set("client_name", e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="nc-tel">Teléfono</Label>
              <Input
                id="nc-tel"
                type="tel"
                placeholder="600 000 000"
                value={form.client_phone}
                onChange={(e) => set("client_phone", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="nc-email">Email</Label>
              <Input
                id="nc-email"
                type="email"
                placeholder="opcional"
                value={form.client_email}
                onChange={(e) => set("client_email", e.target.value)}
              />
            </div>
          </div>
          {services.length > 0 && (
            <div className="space-y-2">
              <Label>Servicio</Label>
              <Select
                value={form.service_id}
                onValueChange={(v) => set("service_id", v)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Elige un servicio" />
                </SelectTrigger>
                <SelectContent>
                  {services.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="nc-fecha">Fecha *</Label>
              <Input
                id="nc-fecha"
                type="date"
                value={form.date}
                onChange={(e) => set("date", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="nc-hora">Hora *</Label>
              <Input
                id="nc-hora"
                type="time"
                value={form.time}
                onChange={(e) => set("time", e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="nc-notas">Notas</Label>
            <Textarea
              id="nc-notas"
              rows={2}
              className="resize-none"
              placeholder="Opcional"
              value={form.notes}
              onChange={(e) => set("notes", e.target.value)}
            />
          </div>
          <Button
            className="w-full"
            onClick={guardar}
            disabled={pending || !form.client_name.trim()}
          >
            {pending ? "Guardando..." : "Crear cita"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
