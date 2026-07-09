import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { runReminders } from "@/lib/cron/reminders";

// Llamado cada hora por un job de pg_cron+pg_net dentro de Supabase
// (migración 0012) en vez del cron de Vercel: el plan Hobby solo
// permite crons diarios y esto necesita granularidad horaria. El
// secreto se compara igual que si lo llamara Vercel. Sin CRON_SECRET
// configurado: cerrado (501), nunca abierto por accidente.
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
