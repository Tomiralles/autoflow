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
    default_subject: "¡Bienvenido/a! Gracias por confiar en nosotros",
    default_body:
      "Hola {{nombre}},\n\n¡Mil gracias por confiar en nosotros! Te damos la bienvenida: desde hoy ya eres de la casa.\n\nEsperamos que hayas quedado encantado/a. Y si hay cualquier cosa que podamos mejorar, cuéntanosla — nos ayuda muchísimo.\n\nUn abrazo,\n{{negocio}}",
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
    default_subject: "Te estamos guardando el hueco, {{nombre}} 😉",
    default_body:
      "Hola {{nombre}},\n\nNo queremos ser pesados (prometido 🤞), pero nos quedamos con las ganas de atenderte.\n\nSi le sigues dando vueltas, cuéntanos qué duda tienes y te la resolvemos en un minuto. Y si no es el momento, no pasa nada: te guardamos el sitio.\n\n{{negocio}}",
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
    default_subject: "Ya ha pasado un mes... ¿cómo lo llevas?",
    default_body:
      "Hola {{nombre}},\n\n¡Cómo pasa el tiempo! Ya hace un mes desde tu última visita y queríamos saber cómo estás.\n\nSi te hace falta un repaso o quieres tu próxima cita, resérvala aquí en un minuto:\n{{enlace}}\n\n¡Nos vemos pronto!\n\n{{negocio}}",
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
