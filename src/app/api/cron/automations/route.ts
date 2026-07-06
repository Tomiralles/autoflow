import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { runDailyAutomations } from "@/lib/cron/automations";

// Cron diario de Vercel (07:00 UTC, vercel.json). Mismo gate que reminders.
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
    const result = await runDailyAutomations(createAdminClient());
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    console.error("[cron/automations] fallo:", e);
    return NextResponse.json({ error: "Fallo interno" }, { status: 500 });
  }
}
