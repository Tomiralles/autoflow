# Landing de venta de AutoFlow AI — diseño

## Objetivo

Página de venta para que Tomi la use con un prospecto (dueño de peluquería, taller o negocio de estética) **antes** de que diga que sí a contratar AutoFlow AI. Vende el valor del servicio, no explica cómo se usa el panel — eso ya lo cubre el onboarding done-for-you posterior.

## Contexto de uso

Se usa en dos momentos, y el diseño tiene que servir para ambos:

- **En persona**: Tomi la enseña en el móvil/tablet durante la visita al negocio.
- **Por WhatsApp**: se manda el enlace antes o después de la conversación, para que el prospecto la lea solo, sin nadie delante para resolver dudas.

Por eso el CTA de contacto va siempre visible (arriba y al final), y hay una sección de "cómo funciona" con detalle suficiente para convencer sin acompañamiento.

## Audiencia y tono

Dueño de un negocio de barrio (peluquería/taller/estética), sin conocimientos técnicos. Copy generado en español, cercano, sin jerga de software — se habla de "tu negocio", no de "la plataforma". Nada de tecnicismos (APIs, dashboards, "onboarding") en el copy visible; esos términos son nuestros, no del cliente.

Página **genérica para cualquier negocio de barrio** (no específica de un sector) — los ejemplos deben poder aplicar a una peluquería, un taller o un centro de estética sin sonar forzados en ninguno.

## Estructura (aprobada: "historia" — problema → solución)

1. **Hero** — titular de dolor (ej. "¿Cuántas citas se te escapan por no contestar el WhatsApp a tiempo?") + subtítulo con la promesa + botones de contacto (WhatsApp primario, Llamar secundario) visibles desde el primer scroll.
2. **Problema** — 3-4 puntos de dolor reconocibles y concretos: citas perdidas por tardar en contestar, horas al teléfono confirmando una a una, clientes que se olvidan y no avisan (hueco perdido), sensación de que el negocio controla al dueño y no al revés.
3. **Solución** — presentación de AutoFlow AI como respuesta directa a cada punto anterior (mismo orden que el problema, para que se lea como "esto soluciona exactamente lo que te acabo de describir").
4. **Cómo funciona** — 3 pasos: (1) Tomi lo instala y configura todo, el dueño no toca nada técnico; (2) el dueño solo mira su panel del día cada mañana; (3) el cliente reserva solo desde su móvil, sin llamar.
5. **Capturas reales** — 2-3 capturas del producto en producción: la página pública de reservas y el panel "Hoy". Deben ser capturas reales de la app funcionando, no mockups ni ilustraciones — es la prueba de que el producto ya existe y funciona.
6. **Precio** — "Desde 45€/mes", una frase de qué incluye, sin letra pequeña ni condiciones confusas.
7. **CTA final** — WhatsApp y Llamar repetidos, mismo tratamiento visual que el hero.

## CTA — mecánica

- **WhatsApp**: enlace `https://wa.me/34626786207?text=...` con un mensaje precargado tipo "Hola, quiero saber más sobre AutoFlow AI para mi negocio". Botón primario (coral, el color de acento de marca).
- **Llamar**: enlace `tel:+34626786207`. Botón secundario, menos protagonismo visual.
- Número: **+34 626 78 62 07** (confirmado con Tomi).

## Precio

Mostrado explícitamente en la página: **"Desde 45€/mes"**. Sin desglose de tiers ni comparativas — el cierre exacto lo negocia Tomi caso a caso en la conversación de venta.

## Marca y estilo visual

- Navy (`#0F172A` / `#1E293B`) + Coral (`#FF6B4A`) — misma paleta que el chrome del producto real (dashboard, login), estilo Gusto/Intercom.
- Capturas reales del producto (no iconos ni ilustraciones abstractas) — decisión explícita tras comparar ambas opciones visualmente.
- Theme-aware (light/dark) y responsive — se va a ver tanto en móvil (uso típico: enseñado en el teléfono de Tomi o leído en el móvil del prospecto) como en pantallas más grandes.

## Dependencia: datos de demo para las capturas

**Antes de tomar las capturas** hace falta crear un negocio de demostración limpio en la base de datos de producción (o en local, pero las capturas deben verse como reales):

- Nombre concreto y verosímil, no una etiqueta tipo "Ejemplo" o "Prueba" (que se vería como plantilla vacía en una captura de venta) — ej. "Peluquería Nova".
- Al menos 1 servicio con precio y duración realistas.
- Al menos 1 cliente/cita de ejemplo con datos ficticios (nunca datos de un cliente real de Tomi, como ya se evitó antes con "ABAD PINTURAS S.L.").
- Horario de apertura configurado (para que la página pública de reservas se vea completa al capturarla).

Las capturas se toman de: (a) la página pública de reservas de ese negocio demo, (b) el panel "Hoy" con esa cita/cliente de ejemplo visible.

## Entrega técnica

Un único artifact HTML autocontenido (vía la herramienta Artifact), sin dependencias externas, con las capturas incrustadas como imágenes. No es parte del código fuente de la app — vive fuera del árbol de `src/`, no se despliega a Vercel.

## Fuera de alcance (explícitamente)

- Rediseño de la pantalla de login del producto real — se acordó dejarlo para más adelante, es un trabajo aparte.
- Guía de "cómo usar tu panel" para clientes ya firmados (onboarding post-venta) — es el otro documento que Tomi mencionó, pero se decidió priorizar este primero.
- Versión específica por sector (peluquería vs. taller vs. estética) — la página es genérica; verticalizar queda para cuando haya datos de qué sector convierte mejor (coherente con la decisión ya tomada de no verticalizar el producto todavía).
- Formulario de contacto o captación de leads en la propia página — el único mecanismo de contacto es WhatsApp/llamada directa a Tomi.
