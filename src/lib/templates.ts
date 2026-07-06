// Render de plantillas con variables {{nombre}} {{fecha}} {{hora}}
// {{servicio}} {{negocio}} {{cliente}} {{importe}} {{dias}}.
// Lib pura (sin dependencias de servidor) para poder testearla.
export function renderTemplate(
  text: string | null | undefined,
  vars: Record<string, string | null | undefined>
): string {
  return Object.entries(vars).reduce(
    (acc, [key, value]) => acc.replaceAll(`{{${key}}}`, value || ""),
    text || ""
  );
}
