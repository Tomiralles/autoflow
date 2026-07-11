"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { adminActualizarNegocio, adminRenovarMes } from "./actions";

export interface AdminBusinessRow {
  id: string;
  name: string;
  slug: string;
  sector: string | null;
  plan: string;
  plan_status: string;
  created_at: string;
  paid_until: string | null;
  owner_email: string | null;
  citas: number;
  clientes: number;
}

const ESTADO: Record<string, { label: string; className: string }> = {
  active: { label: "Activo", className: "bg-green-100 text-green-700" },
  trial: { label: "Prueba", className: "bg-blue-100 text-blue-700" },
  inactive: { label: "Apagado", className: "bg-red-100 text-red-700" },
};

// Semáforo de cobro: rojo vencido, ámbar vence en ≤7 días, verde al día
function badgePago(paidUntil: string | null) {
  if (!paidUntil) return null;
  const fecha = new Date(`${paidUntil}T23:59:59`);
  const dias = Math.ceil((fecha.getTime() - Date.now()) / 86400000);
  const fechaCorta = fecha.toLocaleDateString("es-ES", {
    day: "numeric",
    month: "short",
  });
  if (dias < 0)
    return { label: `Venció el ${fechaCorta}`, className: "bg-red-100 text-red-700" };
  if (dias <= 7)
    return { label: `Vence el ${fechaCorta}`, className: "bg-amber-100 text-amber-700" };
  return { label: `Pagado hasta ${fechaCorta}`, className: "bg-green-100 text-green-700" };
}

export function FilaNegocio({ negocio }: { negocio: AdminBusinessRow }) {
  const [pending, startTransition] = useTransition();

  const actualizar = (patch: { plan?: string; plan_status?: string }) =>
    startTransition(async () => {
      const r = await adminActualizarNegocio(negocio.id, patch);
      if (r.error) toast.error(r.error);
      else
        toast.success(
          patch.plan_status === "inactive"
            ? `${negocio.name} apagado — su página pública ya no responde`
            : `${negocio.name} actualizado`
        );
    });

  const renovar = () =>
    startTransition(async () => {
      const r = await adminRenovarMes(negocio.id);
      if (r.error) toast.error(r.error);
      else toast.success(`${negocio.name}: suscripción renovada 1 mes`);
    });

  const estado = ESTADO[negocio.plan_status] ?? ESTADO.trial;
  const pago = badgePago(negocio.paid_until);

  return (
    <div className="flex flex-wrap items-center gap-3 p-4">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate text-sm font-semibold text-slate-900">
            {negocio.name}
          </p>
          <Badge className={estado.className}>{estado.label}</Badge>
          {pago && <Badge className={pago.className}>{pago.label}</Badge>}
        </div>
        <p className="truncate text-xs text-slate-500">
          /{negocio.slug} · {negocio.owner_email ?? "sin dueño"} ·{" "}
          {negocio.citas} citas · {negocio.clientes} clientes · alta{" "}
          {new Date(negocio.created_at).toLocaleDateString("es-ES")}
        </p>
      </div>
      <Button
        size="sm"
        variant="outline"
        onClick={renovar}
        disabled={pending}
        title="Cobro recibido: extiende el pago un mes"
      >
        +1 mes
      </Button>
      <Select
        value={negocio.plan}
        onValueChange={(v) => actualizar({ plan: v })}
      >
        <SelectTrigger size="sm" className="w-[120px]" disabled={pending}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="free">Free</SelectItem>
          <SelectItem value="pro">Pro</SelectItem>
          <SelectItem value="enterprise">Enterprise</SelectItem>
        </SelectContent>
      </Select>
      <Select
        value={negocio.plan_status}
        onValueChange={(v) => actualizar({ plan_status: v })}
      >
        <SelectTrigger size="sm" className="w-[130px]" disabled={pending}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="trial">Prueba</SelectItem>
          <SelectItem value="active">Activo (pagado)</SelectItem>
          <SelectItem value="inactive">Apagado</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}
