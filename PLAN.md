# AutoFlow AI — Plan de reconstrucción (Base44 → stack propio)

Decisión tomada el 2026-07-03: reconstruir el SaaS fuera de Base44 por fiabilidad,
propiedad del código y vendibilidad. Sin prisa — se hace bien, con seguridad y tests
desde el día 1. El proyecto Base44 (`C:\Users\HP\Documents\saas ia`) se mantiene vivo
como referencia hasta alcanzar paridad; entonces se cancela la suscripción.

## Stack

| Pieza | Elección | Por qué |
|---|---|---|
| App | Next.js (App Router, TS) en Vercel | Frontend + API + cron con logs reales |
| BD/Auth/Storage | Supabase | Postgres real, auth seria, RLS multi-tenant, storage para .ics |
| Email | Resend | Adjuntos, dominio propio, métricas de entrega |
| WhatsApp | UltraMsg | Ya en uso en el proyecto viejo |
| UI | Tailwind + shadcn/ui | Mismo sistema que el proyecto viejo → port directo |

Coste: 0 €/mes en capas gratuitas hasta tener tracción.

## Fases

### Fase 0 — Cimientos ✅ (2026-07-03)
- [x] Esqueleto Next.js + TS + Tailwind
- [x] Esquema SQL completo (`supabase/migrations/0001_initial_schema.sql`):
      10 tablas + profiles, RLS multi-tenant, índice anti-doble-reserva,
      trigger de perfil al registrarse, toggles de página pública ya en el modelo
- [x] `vercel.json` con los 2 crons (recordatorios cada hora, automatizaciones diarias 07:00 UTC)
- [x] `.env.example` con todas las variables
- [x] Crear proyecto en Supabase y aplicar la migración (2026-07-04):
      proyecto "autoflow" (ref `ezwfrcbcikicpzphbsyi`, eu-central-1), migración
      `initial_schema` aplicada vía MCP — 11 tablas, RLS activo en todas.
      `.env.local` creado; falta pegar service role key + claves Resend/UltraMsg
- [x] Instalar shadcn/ui + dependencias (supabase-js, @supabase/ssr, resend) (2026-07-04)
      shadcn 4.x, base radix, preset Nova; 14 componentes base en `src/components/ui`
- [x] Clientes Supabase + middleware de auth (2026-07-04):
      `src/lib/supabase/client.ts` (navegador), `server.ts` (RSC/actions),
      `admin.ts` (service role, salta RLS, con `server-only`),
      `src/proxy.ts` (en Next 16 el middleware se llama proxy) — refresca sesión
      y protege /hoy /citas /clientes /automatico /ajustes /onboarding /admin

### Fase 1 — Auth + Onboarding ✅ (2026-07-04)
- [x] Registro/login/logout (Supabase Auth, server actions, en español) +
      ruta `/auth/confirm` para el enlace de confirmación por email
- [x] Onboarding 3 pasos portado (negocio → servicios → listo) con
      `seedEssentialAutomations` (las 4 esenciales, upsert idempotente)
- [x] Plantillas portadas a `src/lib/automation-templates.ts` (única copia)
- [x] `/hoy` placeholder + raíz que despacha según sesión
- [x] Verificado E2E en navegador: registro → confirmación → login →
      onboarding completo → panel. Datos comprobados en BD (negocio,
      servicio, 4 automatizaciones activas, perfil por trigger).
- Migraciones añadidas durante la fase:
  - 0002: índice único de automations sin WHERE (el parcial rompía el upsert de PostgREST)
  - 0003: policy "owner select" en businesses (el INSERT...RETURNING fallaba:
    is_business_member no ve la fila nueva en el snapshot del propio statement)
  - 0004: hardening de funciones (search_path fijo; SECURITY DEFINER sin RPC
    público: handle_new_user solo supabase_auth_admin, helpers RLS solo authenticated)
- PENDIENTE de decisión (Tomi): la confirmación por email está activada y el
  SMTP integrado de Supabase solo envía ~2 correos/hora — inviable en producción.
  Opciones: desactivar "Confirm email" (razonable con onboarding done-for-you)
  o configurar SMTP propio con Resend en Auth. También recomendable activar
  "Leaked password protection" (advisor de Supabase).

### Fase 2 — Núcleo operativo ✅ (2026-07-06)
- [x] Shell de la app: sidebar escritorio + barra inferior móvil, menú de 5
      (Hoy, Citas, Clientes, Automático, Ajustes) — `(app)/layout.tsx` + `app-nav.tsx`
- [x] Panel del día (`/hoy`): KPIs, reservas por confirmar (botón Confirmar con
      aviso al cliente), citas de hoy con materiales, "Faena terminada" con
      checkbox de aviso premarcado por sector, "Qué hacer hoy" (tareas), badge
      de automatizaciones activas
- [x] `/citas`: agenda agrupada por día + alta manual (copia materiales/duración
      del servicio; nace confirmada) + cancelar
- [x] `/clientes`: lista sin jerga CRM (en seguimiento / ganados y perdidos),
      alta/edición, cambio de etapa por select (sin kanban)
- [x] `/automatico`: las 9 plantillas por categoría con interruptor (upsert al
      activar una no sembrada) y contador de ejecuciones
- [x] `/ajustes`: datos del negocio + CRUD de servicios con `materials_notes`
      (desactivar en vez de borrar) + cerrar sesión
- [x] `src/lib/notifications.ts` portado (confirmAppointment, completeService,
      recordSaleClosed, renderTemplate) sobre `email.ts` (Resend) y
      `whatsapp.ts` (UltraMsg), ambos no-op silencioso sin claves
- [x] Verificado E2E: crear cita → aparece en panel → faena terminada →
      completada en BD; cliente creado; toggle de automatización persiste

### Fase 3 — Reservas públicas
- Página pública `/{slug}` con toggles de personalización (leer `public_page_settings`)
- Flujo de reserva: anti-doble-reserva (ya garantizado por índice único), creación de
  lead, email de confirmación con enlace .ics (portar `src/lib/ics.js` — ahora el .ics
  puede ir como ADJUNTO real con Resend, mejor que el enlace del proyecto viejo)
- WhatsApp de confirmación vía UltraMsg

### Fase 4 — Motor de automatizaciones
- Portar las 9 plantillas (`TEMPLATES` de `src/pages/Automations.jsx` del viejo)
- Portar `renderTemplate` (variables {{nombre}} {{fecha}} {{hora}} {{servicio}}
  {{negocio}} {{cliente}} {{importe}} {{dias}}) — aquí UNA sola copia compartida
- `/api/cron/reminders` (cada hora): recordatorio 24h por negocio según su Automation
- `/api/cron/automations` (diario): portar las 5 rutinas de
  `checkInactiveLeads/entry.ts` del viejo: runLeadInactivo, runClienteInactivo,
  runPostVenta, runFacturaVencida, runNoContesto
- Ambas rutas verifican `Authorization: Bearer CRON_SECRET` (Vercel lo envía solo)

### Fase 5 — Panel admin + facturas + gastos
- Panel admin (solo `profiles.role = 'admin'`): listar negocios, cambiar
  plan/plan_status a mano (cobro manual por Bizum/transferencia — SIN Stripe, decisión firme)
- Facturas, gastos, tareas, interacciones (port directo)

### Fase 6 — Paridad y corte
- Tests de los flujos críticos (reserva, recordatorio, RLS entre negocios)
- Dominio propio, deploy a Vercel, negocio demo para visitas comerciales
- Verificación lado a lado con Base44 → cancelar suscripción Base44

## Mapa de porting (proyecto viejo → nuevo)

| Viejo (`C:\Users\HP\Documents\saas ia`) | Nuevo |
|---|---|
| `base44/entities/*.jsonc` | `supabase/migrations/0001_initial_schema.sql` ✅ |
| `src/pages/Automations.jsx` (TEMPLATES) | `src/lib/automation-templates.ts` |
| `src/lib/notifications.js` (renderTemplate, recordSaleClosed) | `src/lib/notifications.ts` |
| `src/lib/ics.js` | `src/lib/ics.ts` (adjunto real con Resend) |
| `base44/functions/sendAppointmentReminders/entry.ts` | `src/app/api/cron/reminders/route.ts` |
| `base44/functions/checkInactiveLeads/entry.ts` (5 rutinas) | `src/app/api/cron/automations/route.ts` |
| `base44/functions/sendWhatsAppMessage/entry.ts` | `src/lib/whatsapp.ts` |
| `src/pages/PublicBooking.jsx` | `src/app/[slug]/page.tsx` |
| `src/pages/Onboarding.jsx` | `src/app/onboarding/page.tsx` |
| Componentes shadcn `src/components/ui` | se regeneran con `npx shadcn add` |

## Principios de diseño visual (acordados 2026-07-03)
- Una sola pantalla principal: "Hoy" (panel del día) — citas, por confirmar,
  materiales a preparar, ingresos previstos. El dueño no debería necesitar más.
- Menú de máximo 5 entradas: Hoy, Citas, Clientes, Automático, Ajustes.
  Sin submenús. Sin jerga CRM en el UI (no "leads" ni "pipeline": "clientes").
- Datos de un vistazo: números grandes, badges de estado con color semántico
  (verde confirmada / ámbar por confirmar / gris completada), una sola acción
  visible por fila y solo cuando procede (Confirmar, Faena terminada).
- Acento por negocio: usar `businesses.primary_color` en panel y página pública.
- Móvil primero: sidebar → barra inferior de iconos en pantallas pequeñas,
  filas de agenda → tarjetas apiladas. El dueño usa el móvil en el mostrador.
- Mostrar que la automatización trabaja: badge "Recordatorios activos",
  marca "recordatorio enviado ✓" en cada cita. El producto vende tranquilidad.
- Estética: flat, limpia, modo claro por defecto, tipografía grande y legible,
  shadcn/ui + Tailwind. Nada de gradientes/efectos; simple y fiable.

## Decisiones de producto vigentes (no reabrir)
- Cobro manual sin Stripe; admin activa/desactiva `plan_status` a mano
- Página pública: solo toggles simples, nunca constructor visual
- Materiales por servicio: texto libre
- El dueño usa la app como agenda; el cliente recibe .ics (sin OAuth de Google)
- Aviso "ya puedes recoger": checkbox premarcado por sector (taller/estética sí, peluquería no)
- Nombre único en todo el UI: **AutoFlow AI** (adiós NexoCRM)
