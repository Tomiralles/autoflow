// Las 9 plantillas de automatización del producto, portadas 1:1 del
// proyecto Base44 (src/pages/Automations.jsx). Única copia compartida:
// la usan el onboarding (sembrado), la pantalla "Automático" y los crons.

export type AutomationTrigger =
  | "cita_reservada"
  | "venta_cerrada"
  | "lead_inactivo"
  | "factura_vencida"
  | "cliente_inactivo"
  | "no_contesto"
  | "post_venta";

export type AutomationActionType =
  | "enviar_email"
  | "crear_tarea"
  | "notificar_dueno";

export interface AutomationTemplate {
  key: string;
  name: string;
  description: string;
  trigger: AutomationTrigger;
  action_type: AutomationActionType;
  condition_days: number;
  icon: string;
  default_subject: string;
  default_body: string;
  task_title?: string;
  category: "Citas" | "Ventas" | "Seguimiento" | "Retención" | "Finanzas";
}

export const TEMPLATES: AutomationTemplate[] = [
  {
    key: "cita_confirmacion",
    name: "Confirmación de cita",
    description:
      "Email automático cuando un cliente reserva una cita desde tu página",
    trigger: "cita_reservada",
    action_type: "enviar_email",
    condition_days: 0,
    icon: "📅",
    default_subject: "Tu cita ha sido confirmada",
    default_body:
      "Hola {{nombre}},\n\nTe confirmamos tu cita para el {{fecha}} a las {{hora}}.\n\nServicio: {{servicio}}\n\n¡Te esperamos!\n\n{{negocio}}",
    category: "Citas",
  },
  {
    key: "recordatorio_cita",
    name: "Recordatorio 24h antes",
    description: "Recuerda al cliente su cita un día antes automáticamente",
    trigger: "cita_reservada",
    action_type: "enviar_email",
    condition_days: -1,
    icon: "⏰",
    default_subject: "Recuerda: tienes cita mañana",
    default_body:
      "Hola {{nombre}},\n\nTe recordamos que tienes cita mañana a las {{hora}}.\n\nServicio: {{servicio}}\n\nSi necesitas cancelar, contáctanos.\n\n{{negocio}}",
    category: "Citas",
  },
  {
    key: "bienvenida_primera_compra",
    name: "Bienvenida tras primera compra",
    description: "Email de gracias cuando se cierra una venta",
    trigger: "venta_cerrada",
    action_type: "enviar_email",
    condition_days: 0,
    icon: "🎉",
    default_subject: "¡Gracias por elegirnos!",
    default_body:
      "Hola {{nombre}},\n\nMuchas gracias por confiar en nosotros.\n\nTu servicio ha sido registrado y estamos aquí para cualquier consulta.\n\nUn saludo,\n{{negocio}}",
    category: "Ventas",
  },
  {
    key: "seguimiento_sin_contacto",
    name: "Seguimiento sin contacto (3 días)",
    description:
      "Crea una tarea de llamada urgente si el lead lleva 3 días sin contacto",
    trigger: "lead_inactivo",
    action_type: "crear_tarea",
    condition_days: 3,
    icon: "📞",
    default_subject: "",
    default_body: "",
    task_title: "Llamar urgente - {{nombre}}",
    category: "Seguimiento",
  },
  {
    key: "recordatorio_inactividad_cliente",
    name: "Recordatorio a cliente inactivo (2 días)",
    description:
      "Envía un email de seguimiento al cliente si su lead lleva 2 días sin avanzar en el pipeline",
    trigger: "lead_inactivo",
    action_type: "enviar_email",
    condition_days: 2,
    icon: "✉️",
    default_subject: "¿Sigues interesado/a?",
    default_body:
      "Hola {{nombre}},\n\nQueríamos saber si sigues interesado/a en continuar con nosotros. Si tienes alguna duda, estamos aquí para ayudarte.\n\nUn saludo,\n{{negocio}}",
    category: "Seguimiento",
  },
  {
    key: "reactivacion_cliente",
    name: "Reactivación a 30 días",
    description: "Email para clientes que no han comprado en 30 días",
    trigger: "cliente_inactivo",
    action_type: "enviar_email",
    condition_days: 30,
    icon: "🔄",
    default_subject: "¡Te echamos de menos!",
    default_body:
      "Hola {{nombre}},\n\nHace un tiempo que no sabemos de ti. ¿Podemos ayudarte con algo?\n\nTenemos novedades que te pueden interesar. ¡Contáctanos!\n\n{{negocio}}",
    category: "Retención",
  },
  {
    key: "upsell_post_venta",
    name: "Upsell 30 días post-venta",
    description: "Crea una tarea de upsell 30 días después de cerrar una venta",
    trigger: "post_venta",
    action_type: "crear_tarea",
    condition_days: 30,
    icon: "💰",
    task_title: "Hacer upsell - {{nombre}}",
    default_subject: "",
    default_body: "",
    category: "Ventas",
  },
  {
    key: "factura_vencida",
    name: "Aviso de factura vencida",
    description:
      "Notificación cuando una factura lleva más de 7 días vencida sin cobrar",
    trigger: "factura_vencida",
    action_type: "notificar_dueno",
    condition_days: 7,
    icon: "🚨",
    default_subject: "Factura vencida sin cobrar",
    default_body:
      "Tienes una factura de {{cliente}} por {{importe}}€ que lleva {{dias}} días sin cobrar.",
    category: "Finanzas",
  },
  {
    key: "no_contesto",
    name: "No contestó - Reintentar",
    description: "Tarea de rellamada 24h después si el cliente no contestó",
    trigger: "no_contesto",
    action_type: "crear_tarea",
    condition_days: 1,
    icon: "📲",
    task_title: "Volver a llamar - {{nombre}}",
    default_subject: "",
    default_body: "",
    category: "Seguimiento",
  },
];

// Se activan solas al terminar el onboarding: confirmación, recordatorio
// y seguimiento funcionan sin que el dueño pise la pantalla de automatizaciones.
export const ESSENTIAL_TEMPLATE_KEYS = [
  "cita_confirmacion",
  "recordatorio_cita",
  "seguimiento_sin_contacto",
  "recordatorio_inactividad_cliente",
];
