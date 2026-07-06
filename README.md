# AutoFlow AI

SaaS de citas, recordatorios y seguimiento automático para negocios de barrio
(peluquerías, talleres, estética). Next.js 16 + Supabase + Resend + UltraMsg.

El estado del proyecto, las fases y las decisiones de producto viven en
[PLAN.md](PLAN.md).

## Desarrollo local

```bash
npm install
cp .env.example .env.local   # y rellenar claves
npm run dev                  # http://localhost:3000
npm test                     # tests unitarios (vitest)
npm run build && npx eslint . # verificación completa
```

Tests extra:
- `scripts/test-rls.sql` — aislamiento RLS entre negocios (SQL Editor de Supabase)
- `scripts/test-crons.ts` — lógica de los crons con sesión real:
  `NODE_OPTIONS=--conditions=react-server TEST_EMAIL=... TEST_PASSWORD=... npx tsx scripts/test-crons.ts`

## Deploy a Vercel (primera vez)

1. **Subir el repo a GitHub** (privado):
   ```bash
   gh repo create autoflow --private --source . --push
   # o crear el repo vacío en github.com y:
   # git remote add origin https://github.com/<usuario>/autoflow.git
   # git push -u origin master
   ```
2. **Importar en Vercel**: vercel.com → Add New → Project → elegir el repo.
   Framework: Next.js (auto). Los crons de `vercel.json` se registran solos.
3. **Variables de entorno** (Settings → Environment Variables), todas en
   Production:
   | Variable | Valor |
   |---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | `https://ezwfrcbcikicpzphbsyi.supabase.co` |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | la anon key (está en `.env.local`) |
   | `SUPABASE_SERVICE_ROLE_KEY` | dashboard Supabase → Settings → API keys → service_role |
   | `CRON_SECRET` | cualquier cadena larga aleatoria (Vercel la manda sola a los crons) |
   | `NEXT_PUBLIC_APP_URL` | la URL final (p. ej. `https://autoflow-xxx.vercel.app`) |
   | `RESEND_API_KEY` / `RESEND_FROM_EMAIL` | cuando se active Resend |
   | `ULTRAMSG_INSTANCE_ID` / `ULTRAMSG_TOKEN` | cuando se active WhatsApp |
4. **Supabase → Authentication → URL Configuration**: poner la URL de
   producción como Site URL (para que los enlaces de confirmación de email
   no apunten a localhost).
5. Probar: `https://<url>/peluqueria-la-prueba` (página pública) y login.

Notas:
- Plan Hobby de Vercel: los crons solo pueden ser diarios. `reminders` corre
  a las 07:30 UTC (ventana de 24 h → sigue funcionando). Si algún día se
  quiere precisión horaria: Vercel Pro, o un ping horario externo
  (cron-job.org) a `/api/cron/reminders` con header
  `Authorization: Bearer <CRON_SECRET>`.
- Sin `SUPABASE_SERVICE_ROLE_KEY` los crons devuelven 500 (el resto de la
  app funciona igual: la página pública usa RPCs, no la service role).
