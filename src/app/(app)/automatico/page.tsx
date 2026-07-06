import { getBusinessOrRedirect } from "@/lib/business";
import { createClient } from "@/lib/supabase/server";
import { TEMPLATES } from "@/lib/automation-templates";
import { FilaAutomatizacion } from "./fila-automatizacion";

const CATEGORIAS = [
  "Citas",
  "Ventas",
  "Seguimiento",
  "Retención",
  "Finanzas",
] as const;

export default async function AutomaticoPage() {
  const business = await getBusinessOrRedirect();
  const supabase = await createClient();

  const { data } = await supabase
    .from("automations")
    .select("template_key, is_active, runs_count")
    .eq("business_id", business.id);

  const porKey = new Map(
    (data ?? []).map((a) => [a.template_key, a] as const)
  );
  const activas = (data ?? []).filter((a) => a.is_active).length;

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-4 md:p-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Automático</h1>
        <p className="mt-1 text-sm text-slate-500">
          {activas} automatizaciones trabajando por ti. Los textos de los
          mensajes se podrán personalizar pronto.
        </p>
      </div>

      {CATEGORIAS.map((cat) => {
        const templates = TEMPLATES.filter((t) => t.category === cat);
        if (templates.length === 0) return null;
        return (
          <div
            key={cat}
            className="rounded-xl border border-slate-100 bg-white shadow-sm"
          >
            <div className="border-b border-slate-100 px-5 py-3">
              <h2 className="text-sm font-bold text-slate-700">{cat}</h2>
            </div>
            <div className="divide-y divide-slate-50">
              {templates.map((t) => {
                const fila = porKey.get(t.key);
                return (
                  <FilaAutomatizacion
                    key={t.key}
                    businessId={business.id}
                    template={t}
                    activa={fila?.is_active ?? false}
                    runsCount={fila?.runs_count ?? 0}
                  />
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
