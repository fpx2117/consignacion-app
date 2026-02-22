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
    mercadopagoId: string;
    paypalId: string;
    features: string[];
    popular?: boolean;
}

export const SUBSCRIPTION_PLANS: SubscriptionPlan[] = [
    {
        id: 1,
        nombre: process.env.NEXT_PUBLIC_PLAN_1_NOMBRE || "Básico",
        descripcion: "Ideal para pequeños negocios empezando su gestión.",
        precioARS: Number(process.env.NEXT_PUBLIC_PLAN_1_PRICE_ARS || 60000),
        precioUSD: Number(process.env.NEXT_PUBLIC_PLAN_1_PRICE_USD || 45),
        mercadopagoId: process.env.NEXT_PUBLIC_MP_PLAN_BASICO || "PLAN_MP_BASICO",
        paypalId: process.env.NEXT_PUBLIC_PAYPAL_PLAN_BASICO || "PLAN_PAYPAL_BASICO",
        features: [
            `Hasta ${process.env.NEXT_PUBLIC_PLAN_1_MAX_PRODUCTOS || 60} productos`,
            "Ventas ilimitadas",
            "Reportes básicos",
            "Soporte vía email",
        ],
    },
    {
        id: 2,
        nombre: process.env.NEXT_PUBLIC_PLAN_2_NOMBRE || "Pro",
        descripcion: "Para negocios en crecimiento con múltiples consignaciones.",
        precioARS: Number(process.env.NEXT_PUBLIC_PLAN_2_PRICE_ARS || 80000),
        precioUSD: Number(process.env.NEXT_PUBLIC_PLAN_2_PRICE_USD || 55),
        mercadopagoId: process.env.NEXT_PUBLIC_MP_PLAN_PRO || "PLAN_MP_PRO",
        paypalId: process.env.NEXT_PUBLIC_PAYPAL_PLAN_PRO || "PLAN_PAYPAL_PRO",
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
        nombre: process.env.NEXT_PUBLIC_PLAN_3_NOMBRE || "Enterprise",
        descripcion: "Solución completa con soporte prioritario y análisis avanzado.",
        precioARS: Number(process.env.NEXT_PUBLIC_PLAN_3_PRICE_ARS || 150000),
        precioUSD: Number(process.env.NEXT_PUBLIC_PLAN_3_PRICE_USD || 105),
        mercadopagoId: process.env.NEXT_PUBLIC_MP_PLAN_ENTERPRISE || "PLAN_MP_ENTERPRISE",
        paypalId: process.env.NEXT_PUBLIC_PAYPAL_PLAN_ENTERPRISE || "PLAN_PAYPAL_ENTERPRISE",
        features: [
            "Todo lo de Pro",
            "Múltiples sucursales",
            "API de acceso",
            "Soporte 24/7 dedicado",
        ],
    },
];

export const getPlanById = (id: number) => SUBSCRIPTION_PLANS.find(p => p.id === id);
export const getPlanByExternalId = (extId: string) =>
    SUBSCRIPTION_PLANS.find(p => p.mercadopagoId === extId || p.paypalId === extId);

// Límites por defecto para cada plan (se usan al crear PlanLimit en DB)
export const PLAN_LIMITS_DEFAULTS: Record<number, {
    maxProductos: number;
    maxUsuarios: number;
    allowConsignaciones: boolean;
    allowSucursales: boolean;
}> = {
    1: {
        maxProductos: Number(process.env.PLAN_1_MAX_PRODUCTOS ?? 60),
        maxUsuarios: Number(process.env.PLAN_1_MAX_USUARIOS ?? 5),
        allowConsignaciones: process.env.PLAN_1_ALLOW_CONSIGNACIONES === "true",
        allowSucursales: process.env.PLAN_1_ALLOW_SUCURSALES === "true",
    },
    2: {
        maxProductos: Number(process.env.PLAN_2_MAX_PRODUCTOS ?? -1),
        maxUsuarios: Number(process.env.PLAN_2_MAX_USUARIOS ?? 10),
        allowConsignaciones: process.env.PLAN_2_ALLOW_CONSIGNACIONES !== "false", // default true
        allowSucursales: process.env.PLAN_2_ALLOW_SUCURSALES === "true",
    },
    3: {
        maxProductos: Number(process.env.PLAN_3_MAX_PRODUCTOS ?? -1),
        maxUsuarios: Number(process.env.PLAN_3_MAX_USUARIOS ?? 100),
        allowConsignaciones: process.env.PLAN_3_ALLOW_CONSIGNACIONES !== "false", // default true
        allowSucursales: process.env.PLAN_3_ALLOW_SUCURSALES !== "false", // default true
    },
};
