// src/constants/subscriptions.ts

export interface PlanFeature {
  text: string;
  included: boolean;
}

export interface SubscriptionPlan {
  id: number;
  nombre: string;
  descripcion: string;
  precioARS: number;
  precioUSD: number;
  mercadopagoId: string; // ID para pagos únicos (opcional)
  mercadopagoPlanId: string; // ID del Plan de Suscripción en MP
  paypalId: string;
  features: string[];
  popular?: boolean;
}

export const SUBSCRIPTION_PLANS: SubscriptionPlan[] = [
  {
    id: 1,
    nombre: "Básico",
    descripcion: "Ideal para pequeños negocios empezando su gestión.",
    precioARS: 60000,
    precioUSD: 42,
    mercadopagoId: "PLAN_MP_BASICO",
    mercadopagoPlanId: "PLAN_MP_RECURRENTE_BASICO",
    paypalId: "P-3TM41802V62105043NGNYG6Q",
    features: [
      `Hasta 60 productos`,
      "Ventas ilimitadas",
      "Reportes básicos",
      "Soporte vía email",
    ],
  },
  {
    id: 2,
    nombre: "Pro",
    descripcion: "Para negocios en crecimiento con múltiples consignaciones.",
    precioARS: 80000,
    precioUSD: 60,
    mercadopagoId: "PLAN_MP_PRO",
    mercadopagoPlanId: "PLAN_MP_RECURRENTE_PRO",
    paypalId: "P-5LK73578H31864518NGNYHEQ",
    popular: true,
    features: [
      "Productos ilimitados",
      "Ventas ilimitadas",
      "Gestión de consignaciones",
      "Reportes avanzados",
      "Soporte prioritario",
    ],
  },
  {
    id: 3,
    nombre: "Enterprise",
    descripcion:
      "Solución completa con soporte prioritario y análisis avanzado.",
    precioARS: 150000,
    precioUSD: 115,
    mercadopagoId: "PLAN_MP_ENTERPRISE",
    mercadopagoPlanId: "PLAN_MP_RECURRENTE_ENTERPRISE",
    paypalId: "P-2HR79781N0698231MNGNYHJQ",
    features: [
      "Todo lo de Pro",
      "Múltiples sucursales",
      "Carga de facturas con IA (400/mes)",
      "API de acceso",
      "Soporte 24/7 dedicado",
    ],
  },
];

export const getPlanById = (id: number) =>
  SUBSCRIPTION_PLANS.find((p) => p.id === id);
export const getPlanByExternalId = (extId: string) =>
  SUBSCRIPTION_PLANS.find(
    (p) =>
      p.mercadopagoId === extId ||
      p.mercadopagoPlanId === extId ||
      p.paypalId === extId,
  );

export const PLAN_LIMITS_DEFAULTS: Record<
  number,
  {
    maxProductos: number;
    maxUsuarios: number;
    maxFacturasOcr: number;
    allowConsignaciones: boolean;
    allowSucursales: boolean;
  }
> = {
  1: {
    maxProductos: 60,
    maxUsuarios: 5,
    maxFacturasOcr: 0, // Sin acceso a OCR
    allowConsignaciones: false,
    allowSucursales: false,
  },
  2: {
    maxProductos: -1, // Ilimitado
    maxUsuarios: 15,
    maxFacturasOcr: 0, // Sin acceso a OCR
    allowConsignaciones: true,
    allowSucursales: false,
  },
  3: {
    maxProductos: -1, // Ilimitado
    maxUsuarios: 100,
    maxFacturasOcr: 400, // 400 escaneos de factura por mes
    allowConsignaciones: true,
    allowSucursales: true,
  },
};
