"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { adminActualizarNegocio } from "./actions";

export interface AdminBusinessRow {
  id: string;
  name: string;
  slug: string;
  sector: string | null;
  plan: string;
  plan_status: string;
  created_at: string;
  owner_email: string | null;
  citas: number;
  clientes: number;
}

const ESTADO: Record<string, { label: string; className: string }> = {
  active: { label: "Activo", className: "bg-green-100 text-green-700" },
  trial: { label: "Prueba", className: "bg-blue-100 text-blue-700" },
  inactive: { label: "Apagado", className: "bg-red-100 text-red-700" },
};

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

  const estado = ESTADO[negocio.plan_status] ?? ESTADO.trial;

  return (
    <div className="flex flex-wrap items-center gap-3 p-4">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate text-sm font-semibold text-slate-900">
            {negocio.name}
          </p>
          <Badge className={estado.className}>{estado.label}</Badge>
        </div>
        <p className="truncate text-xs text-slate-500">
          /{negocio.slug} · {negocio.owner_email ?? "sin dueño"} ·{" "}
          {negocio.citas} citas · {negocio.clientes} clientes · alta{" "}
          {new Date(negocio.created_at).toLocaleDateString("es-ES")}
        </p>
      </div>
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
