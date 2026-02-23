// src/lib/notificationes/notificaciones-types.ts

// 1. Enum con los tipos (Para usar en el código)
export enum NOTIFICATION_TYPE {
  // 📦 Inventario (Tus requerimientos)
  LOW_STOCK = "LOW_STOCK",
  OUT_OF_STOCK = "OUT_OF_STOCK",
  EXPIRATION_NEAR = "EXPIRATION_NEAR",
  PRODUCT_EXPIRED = "PRODUCT_EXPIRED",

  // 💳 Suscripciones
  SUBSCRIPTION_EXPIRING = "SUBSCRIPTION_EXPIRING", // Suscripción por vencer
  TRIAL_ENDING = "TRIAL_ENDING",                 // Trial por vencer
  SUBSCRIPTION_ACTIVE = "SUBSCRIPTION_ACTIVE",     // Suscripción activada

  // ⚙️ Sistema
  SYSTEM = "SYSTEM",

  // 🔮 Futuro (Sugerencias útiles)
  NEW_ORDER = "NEW_ORDER",           // Nueva venta (para que suene la caja)
  PAYMENT_RECEIVED = "PAYMENT_RECEIVED", // Pago confirmado
  PAYMENT_FAILED = "PAYMENT_FAILED",     // Error en pago
  EXPORT_READY = "EXPORT_READY",     // "Tu reporte PDF está listo"
  CLIENT_REGISTERED = "CLIENT_REGISTERED", // Nuevo cliente
  CONSIGNMENT_ALERT = "CONSIGNMENT_ALERT" // Alerta de tiempo en consignación
}

// 2. Configuración visual (Opcional, pero muy útil para el Frontend)
// Esto te ayuda a saber qué color o icono mostrar según el tipo
export const NOTIFICATION_CONFIG: Record<NOTIFICATION_TYPE, { label: string; severity: "info" | "warning" | "error" | "success" }> = {
  [NOTIFICATION_TYPE.LOW_STOCK]: {
    label: "Stock Bajo",
    severity: "warning", // Amarillo
  },
  [NOTIFICATION_TYPE.OUT_OF_STOCK]: {
    label: "Agotado",
    severity: "error", // Rojo
  },
  [NOTIFICATION_TYPE.EXPIRATION_NEAR]: {
    label: "Vencimiento Cercano",
    severity: "warning",
  },
  [NOTIFICATION_TYPE.PRODUCT_EXPIRED]: {
    label: "Producto Vencido",
    severity: "error",
  },
  [NOTIFICATION_TYPE.SYSTEM]: {
    label: "Sistema",
    severity: "info", // Azul
  },
  [NOTIFICATION_TYPE.SUBSCRIPTION_EXPIRING]: {
    label: "Suscripción por Vencer",
    severity: "warning",
  },
  [NOTIFICATION_TYPE.TRIAL_ENDING]: {
    label: "Trial por Vencer",
    severity: "warning",
  },
  [NOTIFICATION_TYPE.SUBSCRIPTION_ACTIVE]: {
    label: "Suscripción Activa",
    severity: "success",
  },
  [NOTIFICATION_TYPE.NEW_ORDER]: {
    label: "Nueva Venta",
    severity: "success", // Verde
  },
  [NOTIFICATION_TYPE.PAYMENT_RECEIVED]: {
    label: "Pago Recibido",
    severity: "success",
  },
  [NOTIFICATION_TYPE.PAYMENT_FAILED]: {
    label: "Pago Fallido",
    severity: "error",
  },
  [NOTIFICATION_TYPE.EXPORT_READY]: {
    label: "Exportación Lista",
    severity: "info",
  },
  [NOTIFICATION_TYPE.CLIENT_REGISTERED]: {
    label: "Nuevo Cliente",
    severity: "info",
  },
  [NOTIFICATION_TYPE.CONSIGNMENT_ALERT]: {
    label: "Atención",
    severity: "warning",
  },
};