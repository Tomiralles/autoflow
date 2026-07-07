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

### Fase 3 — Reservas públicas ✅ (2026-07-06)
- [x] Página pública `/{slug}` con toggles (`public_page_settings`: precios,
      teléfono, dirección, hero/logo, redes, texto de políticas) y colores
      del negocio. Slugs de rutas de la app reservados en el onboarding.
- [x] Wizard de reserva: servicio → día (14 días, `working_hours` con
      fallback L-S 9-19) → hueco (duración del servicio, ocupados fuera) →
      datos → éxito. Reintento limpio si el hueco se ocupa entre medias.
- [x] DECISIÓN DE ARQUITECTURA (sustituye al "service role en rutas de
      servidor" del plan original): el acceso anónimo va por 3 RPCs
      SECURITY DEFINER (migración 0005): `get_public_business` (columnas
      seguras + servicios), `get_booked_slots` (solo horas) y
      `book_appointment` (valida negocio/servicio/fecha, crea lead + cita
      pendiente + tarea de confirmación atómicamente, maneja el índice
      anti-doble-reserva devolviendo `hueco_ocupado` y limpia el lead).
      RLS intacto, sin service role en el servidor web, superficie mínima.
      Los advisors marcarán estas 3 funciones como definer ejecutables por
      anon: es intencional, son la API pública.
- [x] Email de reserva SIEMPRE sale (texto de la automatización
      `cita_confirmacion` si está activa + contador), con **.ics adjunto
      real** (`src/lib/ics.ts` portado; adiós al enlace de storage del viejo)
- [x] Confirmación del dueño (Fase 2) ya envía email + WhatsApp al cliente
- [x] Verificado E2E anónimo: reserva desde /peluqueria-la-prueba → panel
      "Por confirmar" → Confirmar → confirmada + lead en cita_confirmada.
      Doble reserva del mismo hueco → error limpio y sin lead huérfano.
      plan_status='inactive' apaga la página (gate de cobro manual).
- Nota: WhatsApp en la reserva anónima se envía SOLO al confirmar el dueño
  (los tokens del negocio no pueden viajar por la RPC pública). El quiz por
  servicio (`quiz_questions`) queda fuera — se decidirá si se porta.

### Fase 4 — Motor de automatizaciones ✅ (2026-07-06)
- [x] Plantillas y `renderTemplate` ya portados en fases anteriores (única copia)
- [x] `/api/cron/reminders` (cada hora): recordatorio 24h por negocio según su
      Automation (ventana por condition_days, texto propio, email + WhatsApp,
      `reminder_sent` se marca antes de contar). Horas calculadas en
      Europe/Madrid aunque Vercel corra en UTC.
- [x] `/api/cron/automations` (diario): las 5 rutinas portadas 1:1 con
      queries filtradas en BD (no fetch-all como el viejo): lead_inactivo,
      cliente_inactivo, post_venta, factura_vencida, no_contesto
- [x] Lógica en `src/lib/cron/{reminders,automations}.ts` recibiendo el
      cliente como parámetro (testeable); las rutas usan `createAdminClient()`
- [x] Gate `Authorization: Bearer CRON_SECRET`; sin secreto → 501 (cerrado)
- [x] Verificado con harness real (`scripts/test-crons.ts`, sesión de usuario
      + RLS + NODE_OPTIONS=--conditions=react-server): las 6 rutinas
      dispararon 1 vez con datos preparados y 0 veces al repetir
      (idempotencia por sellos). Gate probado con curl: 401/401/pasa.
- PENDIENTE para que corran en producción (Tomi): pegar
  SUPABASE_SERVICE_ROLE_KEY en `.env.local` y en las env vars de Vercel,
  y crear CRON_SECRET en Vercel (con eso el 500 actual pasa a 200). (Vercel lo envía solo)

### Fase 5 — Panel admin + facturas + gastos ✅ (2026-07-06)
- [x] `/admin` (fuera del área (app): una cuenta admin no necesita negocio):
      lista todos los negocios vía RPC definer `admin_list_businesses`
      (migración 0006; email del dueño desde auth.users, contadores; check
      de admin DENTRO de la función) y cambia plan/plan_status con selects
      (la policy "owner update" ya autoriza a is_admin; cobro manual SIN
      Stripe). Enlace "Administración" en Ajustes solo para admins.
- [x] `/dinero` (SIN entrada de menú — se llega desde el KPI "Ingresos del
      mes" de /hoy, respetando el máximo de 5): resumen del mes
      (cobrado/gastado/beneficio) + tabs Facturas (crear/cobrar/cancelar;
      alimenta el KPI y la automatización factura_vencida) y Gastos
      (apuntar/borrar por categoría)
- [x] Interacciones: botón "Registrar llamada" en cada fila de /clientes
      (contestó/no contestó/interesado/no interesado + notas) — actualiza
      last_contact_date (reloj de lead_inactivo) y alimenta no_contesto
- [x] Verificado E2E: admin cambia estado desde la UI (persistido),
      factura creada→cobrada actualiza el resumen, gasto apuntado,
      llamada registrada con last_contact_date al día
- DECISIÓN: no hay página de tareas separada — "Qué hacer hoy" en /hoy
  muestra las urgentes, que es lo que el dueño necesita (menú sigue en 5)
- Usuario de prueba tomiralles+fase1 promovido a admin (por SQL; un usuario
  no puede autopromoverse, la policy lo impide)

### Fase 6 — Paridad y corte (en curso, 2026-07-06)
- [x] Tests unitarios (vitest, 17): huecos horarios, horario del día,
      generación .ics (RFC 5545, cruce de día, escapado), renderTemplate.
      `npm test`. Refactor: lógica pura extraída a `lib/slots.ts` y
      `lib/templates.ts` para poder testearla.
- [x] Test de RLS entre negocios (`scripts/test-rls.sql`, ejecutado OK):
      un negocio no ve ni escribe datos de otro; los suyos sí.
- [x] Lógica de crons verificada (`scripts/test-crons.ts`, Fase 4)
- [x] `vercel.json`: reminders pasa a diario 07:30 UTC (plan Hobby de
      Vercel no permite crons horarios; la ventana de 24 h lo cubre).
      Mejora futura: ping horario externo (cron-job.org) o Vercel Pro.
- [x] README con guía completa de deploy (GitHub → Vercel → env vars →
      Site URL de Supabase)
- [x] DEPLOY EN VIVO (2026-07-07): https://autoflow-tonis-projects-baabf0b8.vercel.app
      Tomi hizo `vercel login` por email (device code) + añadió las env vars por
      su terminal PowerShell; deploy final vía `vercel deploy --prod` (CLI,
      sin GitHub — pendiente conectar el repo para deploys automáticos por push).
      Vercel Authentication (Deployment Protection) desactivada para que la
      página pública sea accesible a clientes reales.
      BUG CAZADO Y RESUELTO: las 3 env vars puestas desde PowerShell quedaron
      GUARDADAS COMO CADENAS VACÍAS pese a que `vercel env ls` las mostraba
      "Added"/"Encrypted" — causa exacta no confirmada al 100% (se sospechó
      encoding UTF-16 del pipe de PowerShell, pero el mismo fallo con
      `printf` en Git Bash apuntaba a otra cosa — posiblemente demora de
      propagación de Vercel en el primer build). Diagnosticado comparando la
      RPC llamada directa por curl (funcionaba) contra la página desplegada
      (404 limpio, sin error en logs — porque el código solo miraba `data`
      de la RPC, nunca `error`). Fix real: borrar + volver a crear las 3
      vars y REDESPLEGAR; verificado con curl contra la URL viva (200 con
      datos reales) antes de dar el asunto por cerrado — no fiarse de
      `vercel env pull` como prueba, mostraba vacío incluso después de
      arreglado. De paso, arreglado el bug real de fondo: `[slug]/page.tsx`
      ahora loguea el `error` de la RPC en vez de tragárselo como 404.
      Verificado end-to-end contra la URL de producción: / (redirige a
      login), /login (200), /peluqueria-la-prueba (200, datos reales),
      slug inexistente (404 de verdad), /api/cron/reminders (401 sin auth,
      500 con auth+sin service role — esperado).
- [ ] Conectar el repo a GitHub para deploys automáticos (hoy es CLI manual)
- [ ] Dominio propio (decisión de Tomi; el subdominio .vercel.app vale
      para empezar)
- [ ] Negocio demo: "Peluquería La Prueba" ya sirve; pulir datos antes de
      visitas comerciales si hace falta
- [ ] Verificación lado a lado con Base44 → cancelar suscripción

#### Checklist de paridad con Base44 (todo portado y verificado en local)
| Funcionalidad | Base44 | Rebuild |
|---|---|---|
| Auth + onboarding con sembrado de automatizaciones | ✓ | ✓ (F1) |
| Panel del día (confirmar, materiales, faena terminada) | ✓ | ✓ (F2) |
| Agenda + alta manual de citas | ✓ | ✓ (F2) |
| Clientes/pipeline + interacciones | ✓ | ✓ (F2+F5) |
| Página pública con reserva y anti-doble-reserva | ✓ | ✓ (F3, mejor: atómico en BD) |
| Email de reserva con .ics | enlace storage | ✓ adjunto real (F3) |
| Recordatorio 24h (cron) | ✓ horario | ✓ diario en Hobby (F4) |
| 5 rutinas diarias (cron) | ✓ | ✓ (F4, idempotencia verificada) |
| Cron protegido | pendiente (gate secreto sin resolver) | ✓ Bearer CRON_SECRET |
| Panel admin cobro manual | ✗ (pendiente) | ✓ (F5) |
| Facturas + gastos | ✓ | ✓ (F5) |
| Multi-tenancy | filtros en app | ✓ RLS en BD + test |
| Nombre unificado | NexoCRM/AutoFlow mezclados | ✓ AutoFlow AI |
| Quiz por servicio en reserva pública | ✓ | ✗ (decisión pendiente — único gap) |

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
