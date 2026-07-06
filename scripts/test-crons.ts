// Harness de desarrollo: ejecuta la lógica de los crons con una sesión de
// usuario real (RLS limita a su negocio) para verificarla sin service role.
// Uso:
//   NODE_OPTIONS=--conditions=react-server \
//   TEST_EMAIL=... TEST_PASSWORD=... npx tsx scripts/test-crons.ts
// (--conditions=react-server hace inofensivo el import de "server-only")

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { runReminders } from "../src/lib/cron/reminders";
import { runDailyAutomations } from "../src/lib/cron/automations";

// Carga .env.local a mano (fuera de Next no hay carga automática)
for (const line of readFileSync(".env.local", "utf-8").split("\n")) {
  const m = line.match(/^([A-Z_]+)=(.+)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
}

async function main() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const { error } = await supabase.auth.signInWithPassword({
    email: process.env.TEST_EMAIL!,
    password: process.env.TEST_PASSWORD!,
  });
  if (error) throw new Error(`login: ${error.message}`);

  console.log("— runReminders —");
  console.log(await runReminders(supabase));

  console.log("— runDailyAutomations —");
  console.log(await runDailyAutomations(supabase));
}

main().then(
  () => process.exit(0),
  (e) => {
    console.error(e);
    process.exit(1);
  }
);
