// Temas de color listos para la página pública de reservas. Compartido
// entre el onboarding (elección inicial) y Ajustes → Apariencia (cambiarlo
// después). `primary` = botones y acentos; `secondary` = cabecera pública.
export interface Tema {
  nombre: string;
  primary: string;
  secondary: string;
}

export const TEMAS: Tema[] = [
  { nombre: "Azul", primary: "#2563EB", secondary: "#0F172A" },
  { nombre: "Verde", primary: "#059669", secondary: "#052E2B" },
  { nombre: "Coral", primary: "#F97316", secondary: "#431407" },
  { nombre: "Púrpura", primary: "#7C3AED", secondary: "#2E1065" },
  { nombre: "Rosa", primary: "#EC4899", secondary: "#4A044E" },
  { nombre: "Grafito", primary: "#334155", secondary: "#0B1120" },
];
