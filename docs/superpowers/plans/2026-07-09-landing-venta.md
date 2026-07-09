# Landing de venta de AutoFlow AI — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construir una landing de venta (artifact HTML autocontenido) que Tomi use con prospectos de AutoFlow AI, con capturas reales del producto tomadas de un negocio de demostración limpio creado para este fin.

**Architecture:** No es código de la app (vive fuera de `src/`, no se despliega a Vercel). Cinco pasos secuenciales: (1) crear datos de demo reales en Supabase, (2-3) capturar pantallas reales del producto en producción con esos datos, (4) escribir el HTML/copy de la landing con placeholders de imagen, (5) fusionar las capturas como `data:` URIs (sin que el contenido base64 pase por el contexto del agente — se hace con un script Node ejecutado por bash) y publicar con la herramienta Artifact.

**Tech Stack:** SQL directo vía MCP de Supabase (`execute_sql`, project_id `ezwfrcbcikicpzphbsyi`), automatización de navegador real vía `claude-in-chrome` (no el preview local — necesitamos la app desplegada en producción con datos reales), Node.js para la fusión de imágenes, herramienta `Artifact` para publicar.

Spec de referencia: `docs/superpowers/specs/2026-07-09-landing-venta-design.md`

---

### Task 1: Crear el negocio de demostración "Peluquería Nova"

**Files:** ninguno (todo vía SQL directo contra Supabase, proyecto `ezwfrcbcikicpzphbsyi`)

Usa el owner ya existente `tomiralles+fase1@gmail.com` (id `739f4299-dafe-47a3-aa81-45702a4c51c9`, cuenta de prueba sin negocio desde la limpieza anterior de esta sesión; contraseña ya puesta: `PruebaAF2026!`) — evita crear una cuenta de auth nueva.

- [ ] **Step 1: Insertar el negocio, con horario de apertura completo**

Ejecutar vía el MCP de Supabase (`execute_sql`, `project_id: ezwfrcbcikicpzphbsyi`):

```sql
insert into businesses (
  owner_id, name, slug, primary_color, secondary_color,
  sector, phone, email, address, description,
  onboarding_completed, plan_status, working_hours
) values (
  '739f4299-dafe-47a3-aa81-45702a4c51c9',
  'Peluquería Nova',
  'peluqueria-nova',
  '#EC4899',
  '#4A044E',
  'peluqueria',
  '965 123 456',
  'hola@peluquerianova.es',
  'Calle Mayor 12, Alicante',
  'Peluquería de barrio con más de 10 años de experiencia. Cortes, coloración y tratamientos capilares.',
  true,
  'active',
  '{
    "lunes":{"open":true,"start":"09:00","end":"19:00"},
    "martes":{"open":true,"start":"09:00","end":"19:00"},
    "miercoles":{"open":true,"start":"09:00","end":"19:00"},
    "jueves":{"open":true,"start":"09:00","end":"19:00"},
    "viernes":{"open":true,"start":"09:00","end":"19:00"},
    "sabado":{"open":true,"start":"10:00","end":"14:00"},
    "domingo":{"open":false}
  }'::jsonb
)
returning id;
```

Guarda el `id` devuelto (lo necesitas en los pasos siguientes) — llámalo `<BUSINESS_ID>` en el resto del plan.

- [ ] **Step 2: Insertar 2 servicios**

```sql
insert into services (business_id, name, description, price, duration_minutes, is_active, sort_order) values
  ('<BUSINESS_ID>', 'Corte y peinado', 'Corte a medida y peinado final', 25.00, 45, true, 0),
  ('<BUSINESS_ID>', 'Coloración completa', 'Color de raíz a puntas con productos profesionales', 55.00, 90, true, 1)
returning id, name;
```

Guarda el `id` de "Corte y peinado" — lo necesitas en el Step 3. Llámalo `<SERVICE_ID>`.

- [ ] **Step 3: Insertar un lead + cita confirmada para HOY**

Usa `current_date` para que la cita salga siempre en el panel "Hoy" el día que se ejecute este plan (no una fecha fija que quedaría obsoleta).

```sql
with nuevo_lead as (
  insert into leads (
    business_id, full_name, email, phone, service_id, service_name,
    score, score_label, pipeline_stage, status, source,
    appointment_date, appointment_time, last_contact_date, consent_at
  ) values (
    '<BUSINESS_ID>', 'Marta Sánchez', 'marta.sanchez@example.com', '612 345 678',
    '<SERVICE_ID>', 'Corte y peinado',
    80, 'caliente', 'nuevo_lead', 'activo', 'manual',
    current_date, '11:30', now(), now()
  )
  returning id
)
insert into appointments (
  business_id, lead_id, service_id, service_name,
  client_name, client_email, client_phone,
  date, time, duration_minutes, status
)
select '<BUSINESS_ID>', id, '<SERVICE_ID>', 'Corte y peinado',
  'Marta Sánchez', 'marta.sanchez@example.com', '612 345 678',
  current_date, '11:30', 45, 'confirmada'
from nuevo_lead
returning id;
```

- [ ] **Step 4: Verificar que todo quedó bien**

```sql
select b.name, b.slug, b.plan_status, b.onboarding_completed,
  (select count(*) from services where business_id = b.id) as servicios,
  (select count(*) from appointments where business_id = b.id and date = current_date) as citas_hoy
from businesses b where b.slug = 'peluqueria-nova';
```

Esperado: `plan_status = 'active'`, `onboarding_completed = true`, `servicios = 2`, `citas_hoy = 1`.

---

### Task 2: Capturar la página pública de reservas real

**Files:** Create: `marketing/landing-venta/screenshots/reservas.png` (o `.jpg`, según lo que devuelva la herramienta — comprobar la extensión real del archivo guardado)

- [ ] **Step 1: Cargar las herramientas de navegador si no están cargadas**

Si `mcp__claude-in-chrome__*` no aparece como herramienta ya disponible (schema cargado), usar `ToolSearch` con:
`select:mcp__claude-in-chrome__tabs_context_mcp,mcp__claude-in-chrome__navigate,mcp__claude-in-chrome__computer,mcp__claude-in-chrome__resize_window`

- [ ] **Step 2: Abrir un tab nuevo y navegar a la página pública del negocio demo**

```
tabs_context_mcp({ createIfEmpty: true })
navigate({ tabId: <tabId>, url: "https://autoflow-five-alpha.vercel.app/peluqueria-nova" })
```

- [ ] **Step 3: Ajustar el viewport a ancho móvil (la página pública está diseñada mobile-first, max-w-md)**

```
resize_window({ tabId: <tabId>, width: 430, height: 900 })
```

(Si `resize_window` no acepta `width`/`height` en su schema real, comprobar con `ToolSearch` el schema exacto y adaptar — no asumir ciegamente.)

- [ ] **Step 4: Esperar carga y capturar**

```
computer({ action: "wait", tabId: <tabId>, duration: 2 })
computer({ action: "screenshot", tabId: <tabId>, save_to_disk: true })
```

- [ ] **Step 5: Guardar el archivo en la ruta del proyecto**

La herramienta devuelve una ruta local temporal. Cópiala a `marketing/landing-venta/screenshots/reservas.<ext>` (usa la extensión real devuelta, no asumas `.png`):

```bash
cp "<ruta_temporal_devuelta>" "/c/Users/HP/Documents/autoflow/marketing/landing-venta/screenshots/reservas.<ext>"
```

- [ ] **Step 6: Verificar visualmente**

Lee la imagen guardada con la herramienta `Read` (soporta imágenes) y confirma que se ve: cabecera con el nombre "Peluquería Nova", tema rosa/magenta, y el servicio "Corte y peinado" visible. Si sale la pantalla de "servicio no disponible" o vacía, el negocio demo no se guardó bien — volver al Task 1.

---

### Task 3: Capturar el panel "Hoy" real

**Files:** Create: `marketing/landing-venta/screenshots/panel-hoy.png` (o la extensión real)

- [ ] **Step 1: Navegar a login y autenticar**

```
navigate({ tabId: <tabId>, url: "https://autoflow-five-alpha.vercel.app/login" })
```

Usa `find` para localizar los campos y `form_input` para rellenarlos (patrón ya usado en esta sesión):

```
find({ tabId: <tabId>, query: "campo de email de login" })
form_input({ tabId: <tabId>, ref: "<ref_email>", value: "tomiralles+fase1@gmail.com" })
find({ tabId: <tabId>, query: "campo de contraseña" })
form_input({ tabId: <tabId>, ref: "<ref_pass>", value: "PruebaAF2026!" })
find({ tabId: <tabId>, query: "botón de entrar/login" })
computer({ action: "left_click", tabId: <tabId>, ref: "<ref_boton>" })
```

- [ ] **Step 2: Confirmar que aterriza en /hoy**

```
computer({ action: "wait", tabId: <tabId>, duration: 2 })
```

Comprobar con `read_page` o mirando la URL de la respuesta de `navigate`/`computer` que la ruta es `/hoy`. Si no, algo falló en el login — revisar credenciales (deberían seguir siendo válidas, se pusieron en esta misma sesión).

- [ ] **Step 3: Ajustar a viewport de escritorio (el panel usa sidebar, se ve mejor ancho)**

```
resize_window({ tabId: <tabId>, width: 1280, height: 800 })
computer({ action: "wait", tabId: <tabId>, duration: 1 })
```

- [ ] **Step 4: Capturar**

```
computer({ action: "screenshot", tabId: <tabId>, save_to_disk: true })
```

- [ ] **Step 5: Guardar el archivo en la ruta del proyecto**

```bash
cp "<ruta_temporal_devuelta>" "/c/Users/HP/Documents/autoflow/marketing/landing-venta/screenshots/panel-hoy.<ext>"
```

- [ ] **Step 6: Verificar visualmente**

Lee la imagen con `Read` y confirma que se ve la cita de "Marta Sánchez" a las 11:30 en el panel del día.

---

### Task 4: Escribir la plantilla HTML de la landing (sin imágenes fundidas todavía)

**Files:** Create: `marketing/landing-venta/landing-template.html`

- [ ] **Step 1: Cargar la skill `artifact-design` antes de escribir**

Invocar `Skill({ skill: "artifact-design" })` y seguir su guía de módulo CSS/tema para que la página quede coherente con el resto de artifacts (variables CSS, dark/light, responsive).

- [ ] **Step 2: Escribir el archivo con las 7 secciones de la spec y placeholders de imagen**

Usa placeholders literales `{{IMG_RESERVAS}}` y `{{IMG_HOY}}` en los atributos `src` — el Task 5 los sustituye por los `data:` URIs reales sin que el agente tenga que manejar el base64 en su contexto.

Contenido completo (copy ya aprobado, en español, tono cercano sin jerga técnica):

```html
<!-- Sección 1: Hero -->
<header class="hero">
  <h1>¿Cuántas citas se te escapan por no contestar el WhatsApp a tiempo?</h1>
  <p class="subtitle">AutoFlow AI confirma, recuerda y hace seguimiento de tus citas solo — para que tú te dediques a tu negocio, no al teléfono.</p>
  <div class="cta-row">
    <a class="btn-primary" href="https://wa.me/34626786207?text=Hola%2C%20quiero%20saber%20m%C3%A1s%20sobre%20AutoFlow%20AI%20para%20mi%20negocio">💬 Escríbeme por WhatsApp</a>
    <a class="btn-secondary" href="tel:+34626786207">📞 Llamar</a>
  </div>
</header>

<!-- Sección 2: Problema -->
<section class="problema">
  <h2>Si esto te suena, no eres el único</h2>
  <ul>
    <li>Contestas el WhatsApp tarde y el cliente ya reservó en otro sitio.</li>
    <li>Pasas horas llamando uno a uno para confirmar las citas del día siguiente.</li>
    <li>Un cliente se olvida de su cita y pierdes ese hueco sin que nadie te avise.</li>
    <li>Sientes que el negocio te controla a ti, en vez de al revés.</li>
  </ul>
</section>

<!-- Sección 3: Solución -->
<section class="solucion">
  <h2>AutoFlow AI se encarga de todo eso por ti</h2>
  <ul>
    <li>Tu página de reservas está siempre abierta — el cliente reserva solo, a cualquier hora, sin esperar tu respuesta.</li>
    <li>Los recordatorios salen solos por WhatsApp y email 24h antes — sin que tengas que llamar a nadie.</li>
    <li>Si alguien no confirma, se lo recordamos automáticamente.</li>
    <li>Cada mañana ves tu día completo en un solo panel: quién viene, a qué hora y qué necesita.</li>
  </ul>
</section>

<!-- Sección 4: Cómo funciona -->
<section class="como-funciona">
  <h2>Empezar es más fácil de lo que crees</h2>
  <ol>
    <li>Yo lo instalo y lo configuro todo por ti — tú no tocas nada técnico.</li>
    <li>Cada mañana entras y ves tu panel del día: citas, avisos, todo listo.</li>
    <li>Tus clientes reservan solos desde el móvil, sin llamarte.</li>
  </ol>
</section>

<!-- Sección 5: Capturas reales -->
<section class="capturas">
  <h2>Así se ve de verdad</h2>
  <p class="subtitle">Sin maquetas, sin promesas — esto es lo que va a usar tu negocio desde el primer día.</p>
  <div class="capturas-grid">
    <figure>
      <img src="{{IMG_RESERVAS}}" alt="Página pública de reservas de un negocio real en AutoFlow AI" />
      <figcaption>Tu página de reservas</figcaption>
    </figure>
    <figure>
      <img src="{{IMG_HOY}}" alt="Panel del día de AutoFlow AI con una cita real" />
      <figcaption>Tu panel del día</figcaption>
    </figure>
  </div>
</section>

<!-- Sección 6: Precio -->
<section class="precio">
  <p class="precio-cifra">Desde 45€/mes</p>
  <p class="subtitle">Sin permanencia, sin letra pequeña, sin lío técnico. Todo incluido: reservas, recordatorios y seguimiento automático.</p>
</section>

<!-- Sección 7: CTA final -->
<footer class="cta-final">
  <h2>¿Hablamos de tu negocio?</h2>
  <div class="cta-row">
    <a class="btn-primary" href="https://wa.me/34626786207?text=Hola%2C%20quiero%20saber%20m%C3%A1s%20sobre%20AutoFlow%20AI%20para%20mi%20negocio">💬 Escríbeme por WhatsApp</a>
    <a class="btn-secondary" href="tel:+34626786207">📞 Llamar</a>
  </div>
</footer>
```

- [ ] **Step 3: Escribir el CSS**

Añade este bloque `<style>` al mismo archivo `landing-template.html` (antes o después del HTML de las secciones, es indiferente). Paleta fija de marca AutoFlow (no cambia con el tema oscuro/claro, es la identidad del producto): navy `#0F172A` de fondo en hero/CTA final, coral `#FF6B4A` de acento en botones y precio. El resto de colores (fondo de página, texto, tarjetas) sí respeta `prefers-color-scheme`/`data-theme`, siguiendo la guía de `artifact-design` cargada en el Step 1.

```css
<style>
:root {
  --af-navy: #0F172A;
  --af-coral: #FF6B4A;
  --af-text: #1e293b;
  --af-text-muted: #64748b;
  --af-bg: #f8fafc;
  --af-card-bg: #ffffff;
}

:root[data-theme="dark"] {
  --af-bg: #0b1220;
  --af-card-bg: #111827;
  --af-text: #e2e8f0;
  --af-text-muted: #94a3b8;
}

@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {
    --af-bg: #0b1220;
    --af-card-bg: #111827;
    --af-text: #e2e8f0;
    --af-text-muted: #94a3b8;
  }
}

* { box-sizing: border-box; }

body {
  margin: 0;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  background: var(--af-bg);
  color: var(--af-text);
  line-height: 1.5;
}

.hero, .cta-final {
  background: var(--af-navy);
  color: white;
  padding: 48px 20px;
  text-align: center;
}

.hero h1, .cta-final h2 {
  font-size: 1.75rem;
  font-weight: 800;
  max-width: 640px;
  margin: 0 auto 12px;
  line-height: 1.25;
}

.hero .subtitle, .cta-final .subtitle {
  color: #cbd5e1;
  font-size: 1rem;
  max-width: 520px;
  margin: 0 auto 24px;
}

section .subtitle {
  color: var(--af-text-muted);
  text-align: center;
  max-width: 520px;
  margin: 0 auto 20px;
}

.cta-row {
  display: flex;
  gap: 12px;
  justify-content: center;
  flex-wrap: wrap;
}

.btn-primary, .btn-secondary {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 14px 24px;
  border-radius: 10px;
  font-weight: 700;
  font-size: 1rem;
  text-decoration: none;
  min-height: 44px;
}

.btn-primary { background: var(--af-coral); color: white; }
.btn-secondary { background: rgba(255,255,255,0.12); color: white; border: 1px solid rgba(255,255,255,0.3); }

section {
  max-width: 720px;
  margin: 0 auto;
  padding: 48px 20px;
}

section h2 {
  font-size: 1.4rem;
  font-weight: 800;
  color: var(--af-navy);
  margin-bottom: 16px;
  text-align: center;
}

:root[data-theme="dark"] section h2 { color: white; }
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) section h2 { color: white; }
}

.problema ul, .solucion ul, .como-funciona ol {
  background: var(--af-card-bg);
  border-radius: 12px;
  padding: 20px 20px 20px 44px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.08);
}

.problema li, .solucion li, .como-funciona li {
  margin-bottom: 12px;
  font-size: 1rem;
}

.capturas-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 20px;
  margin-top: 20px;
}

@media (min-width: 640px) {
  .capturas-grid { grid-template-columns: 1fr 1fr; }
}

.capturas-grid figure {
  margin: 0;
  background: var(--af-card-bg);
  border-radius: 12px;
  padding: 12px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.08);
}

.capturas-grid img {
  width: 100%;
  max-width: 100%;
  border-radius: 8px;
  display: block;
}

.capturas-grid figcaption {
  text-align: center;
  margin-top: 8px;
  font-size: 0.85rem;
  color: var(--af-text-muted);
}

.precio { text-align: center; }

.precio-cifra {
  font-size: 2.5rem;
  font-weight: 900;
  color: var(--af-coral);
  margin: 0 0 8px;
}
</style>
```

- [ ] **Step 4: Verificar que no falten los placeholders**

```bash
grep -c "{{IMG_RESERVAS}}\|{{IMG_HOY}}" "/c/Users/HP/Documents/autoflow/marketing/landing-venta/landing-template.html"
```

Esperado: `2` (una aparición de cada uno).

---

### Task 5: Fusionar las capturas y publicar el artifact

**Files:**
- Create: `marketing/landing-venta/merge-images.js` (script temporal, se puede borrar después de usarlo una vez)
- Create: `marketing/landing-venta/landing-final.html`

- [ ] **Step 1: Escribir el script de fusión**

Importante: este script existe para que el contenido base64 (potencialmente cientos de miles de caracteres) nunca tenga que pasar por el contexto del agente — se lee y se escribe directamente en disco.

```javascript
// marketing/landing-venta/merge-images.js
const fs = require("fs");
const path = require("path");

const dir = __dirname;
const templatePath = path.join(dir, "landing-template.html");
const outputPath = path.join(dir, "landing-final.html");
const screenshotsDir = path.join(dir, "screenshots");

function encontrarArchivo(nombreBase) {
  const candidatos = fs.readdirSync(screenshotsDir)
    .filter((f) => f.startsWith(nombreBase + "."));
  if (candidatos.length === 0) {
    throw new Error(`No se encontró ningún archivo ${nombreBase}.* en ${screenshotsDir}`);
  }
  return path.join(screenshotsDir, candidatos[0]);
}

function aDataUri(rutaArchivo) {
  const ext = path.extname(rutaArchivo).slice(1).toLowerCase();
  const mime = ext === "jpg" ? "jpeg" : ext; // jpg -> image/jpeg
  const base64 = fs.readFileSync(rutaArchivo).toString("base64");
  return `data:image/${mime};base64,${base64}`;
}

let html = fs.readFileSync(templatePath, "utf8");
html = html.replace("{{IMG_RESERVAS}}", aDataUri(encontrarArchivo("reservas")));
html = html.replace("{{IMG_HOY}}", aDataUri(encontrarArchivo("panel-hoy")));

fs.writeFileSync(outputPath, html);
console.log("OK — landing-final.html escrito,", html.length, "caracteres");
```

- [ ] **Step 2: Ejecutarlo**

```bash
cd "/c/Users/HP/Documents/autoflow/marketing/landing-venta" && node merge-images.js
```

Esperado: `OK — landing-final.html escrito, <N> caracteres` (sin volcar el base64 en la salida).

- [ ] **Step 3: Verificar que no quedan placeholders sin sustituir**

```bash
grep -c "{{IMG_" "/c/Users/HP/Documents/autoflow/marketing/landing-venta/landing-final.html"
```

Esperado: `0`.

- [ ] **Step 4: Publicar con la herramienta Artifact**

```
Artifact({
  file_path: "/c/Users/HP/Documents/autoflow/marketing/landing-venta/landing-final.html",
  favicon: "⚡",
  description: "Landing de venta de AutoFlow AI para enseñar a prospectos"
})
```

- [ ] **Step 5: Verificación final**

Abre la URL devuelta y comprueba con un vistazo: título correcto, botones de WhatsApp/Llamar con el número `+34 626 78 62 07`, las dos capturas reales visibles (no rotas), precio "Desde 45€/mes", se ve bien tanto en un viewport móvil como de escritorio (usar `preview_resize`-equivalente o simplemente redimensionar la ventana del artifact si la herramienta lo permite).

- [ ] **Step 6: Commit de los archivos fuente (no el HTML final con las imágenes incrustadas, que es un derivado pesado — decidir con el usuario si se commitea o se deja fuera vía .gitignore)**

```bash
cd "/c/Users/HP/Documents/autoflow" && git add marketing/landing-venta/landing-template.html marketing/landing-venta/merge-images.js && git status --short
```

Revisar con el usuario si además quiere commitear `landing-final.html` y las capturas (pesan más, pero documentan el resultado final) antes de hacer el commit definitivo.

---

## Notas para quien ejecute este plan

- El negocio demo "Peluquería Nova" queda en la base de datos de PRODUCCIÓN real (mismo proyecto Supabase que usa la app en vivo). Es intencional — así las capturas son 100% reales, no de un entorno aparte. No borrar este negocio después: si en el futuro hace falta rehacer las capturas (nuevo diseño de página pública, etc.), ya está listo para reutilizar.
- Las credenciales `tomiralles+fase1@gmail.com` / `PruebaAF2026!` ya existían de una sesión anterior — no hace falta crearlas ni resetear la contraseña.
- Si algún paso de captura falla por cambios en el DOM (los `ref` de `find`/`read_page` no son estables entre sesiones), volver a llamar `find` con una consulta en lenguaje natural en vez de asumir los mismos `ref` de este documento — son ilustrativos, no literales.
