"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export interface ActionResult {
  ok?: true;
  error?: string;
}

// Cobro manual: el admin activa/desactiva negocios a mano tras cobrar
// por Bizum/transferencia. La policy "owner update" (or is_admin())
// autoriza el update; un no-admin recibe cero filas afectadas.
export async function adminActualizarNegocio(
  businessId: string,
  patch: { plan?: string; plan_status?: string }
): Promise<ActionResult> {
  const valido =
    (!patch.plan || ["free", "pro", "enterprise"].includes(patch.plan)) &&
    (!patch.plan_status ||
      ["trial", "active", "inactive"].includes(patch.plan_status));
  if (!valido) return { error: "Valor no válido." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("businesses")
    .update(patch)
    .eq("id", businessId)
    .select("id");

  if (error || !data?.length) {
    return { error: "No se pudo actualizar el negocio." };
  }

  revalidatePath("/admin");
  return { ok: true };
}
