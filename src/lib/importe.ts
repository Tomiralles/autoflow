// Parsea un importe escrito por el dueño ("12,50", "12.50", "12") a número.
// Acepta la coma decimal española. Devuelve null si está vacío o no es
// un número mayor que 0.
export function parsearImporte(texto: string): number | null {
  const limpio = texto.trim().replace(",", ".");
  if (!limpio) return null;
  const n = Number(limpio);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.round(n * 100) / 100;
}
