import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { CancelarWidget } from "./cancelar-widget";

// Página pública de cancelación: el cliente llega desde el enlace de su
// email/WhatsApp. Se muestra la cita y un botón — la cancelación real va
// por server action (nunca por GET: los escáneres de enlaces del correo
// cancelarían citas solos).
export default async function CancelarPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  // UUID mal formado → 404 directo sin tocar la BD
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(token)) {
    notFound();
  }

  const supabase = await createClient();
  const { data } = await supabase.rpc("get_appointment_by_token", {
    p_token: token,
  });

  const cita = data as {
    client_name?: string;
    service_name?: string | null;
    date?: string;
    time?: string;
    status?: string;
    business_name?: string;
    business_phone?: string | null;
    cancelable?: boolean;
  } | null;

  if (!cita?.client_name) notFound();

  const fecha = new Intl.DateTimeFormat("es-ES", {
    timeZone: "Europe/Madrid",
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date(`${cita.date}T12:00:00`));
  const hora = cita.time?.slice(0, 5);

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
      <div className="w-full max-w-sm space-y-5 rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
        <div className="space-y-1 text-center">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            {cita.business_name}
          </p>
          <h1 className="text-xl font-bold text-slate-900">Tu cita</h1>
        </div>

        <div className="space-y-1 rounded-xl bg-slate-50 p-4 text-center">
          <p className="text-sm font-semibold text-slate-900">
            {cita.client_name}
          </p>
          {cita.service_name && (
            <p className="text-sm text-slate-600">{cita.service_name}</p>
          )}
          <p className="text-sm text-slate-600 first-letter:uppercase">
            {fecha} · {hora}
          </p>
        </div>

        {cita.status === "cancelada" ? (
          <p className="text-center text-sm text-slate-500">
            Esta cita ya está cancelada.
          </p>
        ) : cita.cancelable ? (
          <>
            <p className="text-center text-sm text-slate-500">
              ¿No puedes venir? Sin problema — cancela aquí y el hueco queda
              libre para otra persona.
            </p>
            <CancelarWidget token={token} />
          </>
        ) : (
          <p className="text-center text-sm text-slate-500">
            Esta cita ya no se puede cancelar desde aquí.
            {cita.business_phone
              ? ` Si lo necesitas, llama al ${cita.business_phone}.`
              : ""}
          </p>
        )}
      </div>
    </main>
  );
}
