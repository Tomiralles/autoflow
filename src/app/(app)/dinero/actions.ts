"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { hoyISO } from "@/lib/dates";
import { parsearImporte } from "@/lib/importe";

export interface ActionResult {
  ok?: true;
  error?: string;
}

export interface FacturaInput {
  client_name: string;
  concepto: string;
  total: string;
  due_date: string;
}

export async function crearFactura(
  businessId: string,
  input: FacturaInput
): Promise<ActionResult> {
  if (!input.client_name.trim()) return { error: "El cliente es obligatorio." };
  const total = parsearImporte(input.total);
  if (total === null) return { error: "El importe debe ser mayor que 0." };

  const supabase = await createClient();
  const { error } = await supabase.from("invoices").insert({
    business_id: businessId,
    client_name: input.client_name.trim(),
    items: [{ description: input.concepto.trim() || "Servicios", amount: total }],
    total,
    status: "enviada",
    due_date: input.due_date || null,
  });
  if (error) return { error: "No se pudo crear la factura." };

  revalidatePath("/dinero");
  return { ok: true };
}

export async function marcarFacturaCobrada(
  invoiceId: string
): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("invoices")
    .update({ status: "cobrada", paid_date: hoyISO() })
    .eq("id", invoiceId);
  if (error) return { error: "No se pudo marcar como cobrada." };

  revalidatePath("/dinero");
  revalidatePath("/hoy");
  return { ok: true };
}

export async function cancelarFactura(invoiceId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("invoices")
    .update({ status: "cancelada" })
    .eq("id", invoiceId);
  if (error) return { error: "No se pudo cancelar la factura." };

  revalidatePath("/dinero");
  return { ok: true };
}

export interface GastoInput {
  category: string;
  description: string;
  amount: string;
  date: string;
}

export async function crearGasto(
  businessId: string,
  input: GastoInput
): Promise<ActionResult> {
  if (!input.description.trim())
    return { error: "La descripción es obligatoria." };
  const amount = parsearImporte(input.amount);
  if (amount === null) return { error: "El importe debe ser mayor que 0." };

  const supabase = await createClient();
  const { error } = await supabase.from("expenses").insert({
    business_id: businessId,
    category: input.category,
    description: input.description.trim(),
    amount,
    date: input.date || hoyISO(),
  });
  if (error) return { error: "No se pudo guardar el gasto." };

  revalidatePath("/dinero");
  return { ok: true };
}

export async function borrarGasto(expenseId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("expenses").delete().eq("id", expenseId);
  if (error) return { error: "No se pudo borrar el gasto." };

  revalidatePath("/dinero");
  return { ok: true };
}
