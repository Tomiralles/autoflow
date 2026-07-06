"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import type { AutomationTemplate } from "@/lib/automation-templates";
import { toggleAutomation } from "./actions";

export function FilaAutomatizacion({
  businessId,
  template,
  activa,
  runsCount,
}: {
  businessId: string;
  template: AutomationTemplate;
  activa: boolean;
  runsCount: number;
}) {
  const [pending, startTransition] = useTransition();

  const toggle = (nueva: boolean) =>
    startTransition(async () => {
      const r = await toggleAutomation(businessId, template.key, nueva);
      if (r.error) toast.error(r.error);
      else
        toast.success(
          nueva ? `"${template.name}" activada` : `"${template.name}" apagada`
        );
    });

  return (
    <div className="flex items-center gap-4 p-4">
      <span className="shrink-0 text-2xl">{template.icon}</span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-slate-900">{template.name}</p>
        <p className="mt-0.5 text-xs text-slate-500">{template.description}</p>
        {activa && runsCount > 0 && (
          <p className="mt-1 text-xs font-medium text-green-600">
            ✓ Ejecutada {runsCount} {runsCount === 1 ? "vez" : "veces"}
          </p>
        )}
      </div>
      <Switch checked={activa} onCheckedChange={toggle} disabled={pending} />
    </div>
  );
}
