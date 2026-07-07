import Link from "next/link";
import { TrendingDown, TrendingUp, Wallet } from "lucide-react";
import { getBusinessOrRedirect } from "@/lib/business";
import { createClient } from "@/lib/supabase/server";
import { hoyISO } from "@/lib/dates";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  FilaFactura,
  FilaGasto,
  NuevaFacturaDialog,
  NuevoGastoDialog,
  type FacturaRow,
  type GastoRow,
} from "./dinero-widgets";

// Facturas y gastos. No está en el menú (máximo 5 entradas): se llega
// desde el KPI "Ingresos del mes" del panel del día.
export default async function DineroPage() {
  const business = await getBusinessOrRedirect();
  const supabase = await createClient();
  const hoy = hoyISO();
  const mes = hoy.slice(0, 7);

  const [facturasRes, gastosRes] = await Promise.all([
    supabase
      .from("invoices")
      .select("id, client_name, total, status, due_date, paid_date, created_at")
      .eq("business_id", business.id)
      .order("created_at", { ascending: false })
      .limit(100),
    supabase
      .from("expenses")
      .select("id, category, description, amount, date")
      .eq("business_id", business.id)
      .order("date", { ascending: false })
      .limit(100),
  ]);

  const facturas = (facturasRes.data ?? []) as FacturaRow[];
  const gastos = (gastosRes.data ?? []) as GastoRow[];

  const ingresosMes = facturas
    .filter((f) => f.status === "cobrada" && f.paid_date?.startsWith(mes))
    .reduce((s, f) => s + (f.total || 0), 0);
  const gastosMes = gastos
    .filter((g) => g.date.startsWith(mes))
    .reduce((s, g) => s + (g.amount || 0), 0);
  const beneficio = ingresosMes - gastosMes;

  const pendientes = facturas.filter((f) =>
    ["borrador", "enviada", "vencida"].includes(f.status)
  );
  const resto = facturas.filter(
    (f) => !["borrador", "enviada", "vencida"].includes(f.status)
  );

  const resumen = [
    {
      label: "Cobrado este mes",
      value: `${ingresosMes.toLocaleString("es")}€`,
      icon: TrendingUp,
      color: "text-green-600",
      bg: "bg-green-50",
    },
    {
      label: "Gastado este mes",
      value: `${gastosMes.toLocaleString("es")}€`,
      icon: TrendingDown,
      color: "text-red-600",
      bg: "bg-red-50",
    },
    {
      label: "Beneficio",
      value: `${beneficio.toLocaleString("es")}€`,
      icon: Wallet,
      color: beneficio >= 0 ? "text-brand" : "text-red-600",
      bg: beneficio >= 0 ? "bg-brand-soft" : "bg-red-50",
    },
  ];

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-4 md:p-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Dinero</h1>
        <p className="mt-1 text-sm text-slate-500">
          Facturas y gastos ·{" "}
          <Link href="/hoy" className="text-coral hover:underline">
            volver al panel
          </Link>
        </p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {resumen.map(({ label, value, icon: Icon, color, bg }) => (
          <div
            key={label}
            className="rounded-xl border border-slate-100 bg-white p-4 shadow-sm"
          >
            <div
              className={`mb-2 flex h-9 w-9 items-center justify-center rounded-lg ${bg}`}
            >
              <Icon size={18} className={color} />
            </div>
            <p className="text-xl font-bold text-slate-900">{value}</p>
            <p className="mt-0.5 text-xs text-slate-500">{label}</p>
          </div>
        ))}
      </div>

      <Tabs defaultValue="facturas">
        <TabsList>
          <TabsTrigger value="facturas">
            Facturas{pendientes.length > 0 ? ` (${pendientes.length})` : ""}
          </TabsTrigger>
          <TabsTrigger value="gastos">Gastos</TabsTrigger>
        </TabsList>

        <TabsContent value="facturas" className="space-y-4">
          <div className="flex justify-end">
            <NuevaFacturaDialog businessId={business.id} hoy={hoy} />
          </div>
          <div className="rounded-xl border border-slate-100 bg-white shadow-sm">
            <div className="divide-y divide-slate-50">
              {facturas.length === 0 ? (
                <p className="p-8 text-center text-sm text-slate-400">
                  Aún no hay facturas
                </p>
              ) : (
                [...pendientes, ...resto].map((f) => (
                  <FilaFactura key={f.id} factura={f} />
                ))
              )}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="gastos" className="space-y-4">
          <div className="flex justify-end">
            <NuevoGastoDialog businessId={business.id} hoy={hoy} />
          </div>
          <div className="rounded-xl border border-slate-100 bg-white shadow-sm">
            <div className="divide-y divide-slate-50">
              {gastos.length === 0 ? (
                <p className="p-8 text-center text-sm text-slate-400">
                  Aún no hay gastos apuntados
                </p>
              ) : (
                gastos.map((g) => <FilaGasto key={g.id} gasto={g} />)
              )}
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
