"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { TEMPLATES } from "@/lib/automation-templates";

export interface ActionResult {
  ok?: true;
  error?: string;
}

// Enciende/apaga una automatización. Si el negocio aún no tiene la fila
// (plantilla no esencial), se crea al activarla por primera vez.
export async function toggleAutomation(
  businessId: string,
  templateKey: string,
  activar: boolean
): Promise<ActionResult> {
  const supabase = await createClient();
  const template = TEMPLATES.find((t) => t.key === templateKey);
  if (!template) return { error: "Plantilla desconocida." };

  const { error } = await supabase.from("automations").upsert(
    {
      business_id: businessId,
      template_key: template.key,
      name: template.name,
      description: template.description,
      trigger: template.trigger,
      action_type: template.action_type,
      condition_days: template.condition_days,
      email_subject: template.default_subject,
      email_body: template.default_body,
      task_title: template.task_title ?? "",
      is_active: activar,
    },
    { onConflict: "business_id,template_key", ignoreDuplicates: false }
  );
  if (error) return { error: "No se pudo cambiar la automatización." };

  revalidatePath("/automatico");
  revalidatePath("/hoy");
  return { ok: true };
}
