import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { runReminders } from "@/lib/cron/reminders";

// Cron horario de Vercel (vercel.json). Vercel añade el header
// "Authorization: Bearer <CRON_SECRET>" automáticamente si la variable
// existe en el proyecto. Sin secreto configurado: cerrado (501), nunca
// abierto por accidente.
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "CRON_SECRET sin configurar" },
      { status: 501 }
    );
  }
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    const result = await runReminders(createAdminClient());
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    console.error("[cron/reminders] fallo:", e);
    return NextResponse.json({ error: "Fallo interno" }, { status: 500 });
  }
}
