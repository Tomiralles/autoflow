<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# AutoFlow AI — contexto del proyecto

SaaS B2B2C para negocios de barrio (peluquerías, talleres, estética): reservas,
confirmaciones y recordatorios automáticos, seguimiento de leads. Reconstrucción con
código propio del proyecto Base44 que vive en `C:\Users\HP\Documents\saas ia`
(mantener aquel INTACTO como referencia hasta paridad — sigue en producción en
https://gabby-smart-flow-go.base44.app).

**Lee PLAN.md antes de trabajar**: fases, mapa de porting y decisiones de producto
que no se reabren.

## Stack
Next.js App Router + TypeScript + Tailwind + shadcn/ui, en Vercel.
Supabase (Postgres + Auth + Storage, RLS multi-tenant). Resend (email).
UltraMsg (WhatsApp). Cron via `vercel.json` → rutas `/api/cron/*` protegidas
con `Authorization: Bearer CRON_SECRET`.

## Reglas del proyecto
- Idioma del dominio y del UI: español (enums en español: 'pendiente',
  'confirmada', sector 'peluqueria'... — igual que el esquema SQL).
- Nombre de producto: **AutoFlow AI**, en todas las pantallas.
- Multi-tenancy sagrado: toda query de negocio filtra por `business_id`;
  la RLS es la red de seguridad, no la única barrera.
- La página pública de reservas se sirve con la service role key desde el
  servidor (sin acceso anónimo directo a la BD) y valida el slug.
- El usuario (Tomi) no es programador: verificar todo antes de dar por hecho,
  explicar en claro, no pedirle pasos técnicos salvo los inevitables
  (crear proyectos en Supabase/Vercel, pegar claves en .env).

## Comandos
- `npm run dev` — desarrollo local
- `npm run build` — build de producción
- `npm run lint` — eslint
- Migraciones: aplicar el SQL de `supabase/migrations/` en el SQL Editor de
  Supabase (o `npx supabase db push` si se vincula el CLI).
