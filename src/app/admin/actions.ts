"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { hoyISO } from "@/lib/dates";

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

// Cobro recibido: extiende "pagado hasta" un mes. Si ya tenía fecha futura,
// suma desde ahí (pagar antes de tiempo no regala días); si estaba vencido
// o sin fecha, suma desde hoy.
export async function adminRenovarMes(businessId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { data: negocio } = await supabase
    .from("businesses")
    .select("paid_until")
    .eq("id", businessId)
    .single();

  const hoy = hoyISO();
  const base =
    negocio?.paid_until && negocio.paid_until > hoy ? negocio.paid_until : hoy;
  const d = new Date(`${base}T12:00:00`);
  d.setMonth(d.getMonth() + 1);
  const nuevaFecha = d.toISOString().slice(0, 10);

  const { data, error } = await supabase
    .from("businesses")
    .update({ paid_until: nuevaFecha })
    .eq("id", businessId)
    .select("id");

  if (error || !data?.length) {
    return { error: "No se pudo renovar." };
  }

  revalidatePath("/admin");
  return { ok: true };
}
