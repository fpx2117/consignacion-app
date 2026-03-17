// src/lib/requireSubscription.ts
import { cache } from "react";
import { prisma } from "@/lib/prisma";
import { PLAN_LIMITS_DEFAULTS } from "@/constants/subscriptions";

export interface PlanLimits {
    maxProductos: number;
    maxUsuarios: number;
    allowConsignaciones: boolean;
    allowSucursales: boolean;
    planId: number;
    planNombre: string;
}

type PlanLimitRecord = {
    maxProductos: number;
    maxUsuarios: number;
    allowConsignaciones: boolean;
    allowSucursales: boolean;
};

function getPlanLimitDelegate() {
    return (prisma as unknown as {
        planLimit?: {
            findUnique: (args: { where: { planId: number } }) => Promise<PlanLimitRecord | null>;
            upsert: (args: {
                where: { planId: number };
                create: { planId: number } & PlanLimitRecord;
                update: Record<string, never>;
            }) => Promise<unknown>;
        };
    }).planLimit;
}

/**
 * Obtiene los límites del plan activo. Si no hay suscripción activa,
 * retorna null (el caller debe decidir qué hacer: redirect, 403, etc.)
 */
export const getActivePlanLimits = cache(async (): Promise<PlanLimits | null> => {
    // Suscripción es a nivel programa: buscamos cualquiera activa
    const now = new Date();
    const subscription = await prisma.subscription.findFirst({
        where: {
            OR: [
                { status: { in: ["ACTIVO", "PRUEBA"] } },
                {
                    status: "CANCELADO",
                    OR: [
                        { currentPeriodEnd: { gt: now } },
                        { trialEndsAt: { gt: now } }
                    ]
                }
            ]
        },
        orderBy: { createdAt: "desc" },
        include: { plan: true },
    });

    if (!subscription) return null;

    // Cargar límites del plan por separado (evita dependencia de tipos generados)
    const limits = await getPlanLimitDelegate()?.findUnique({
        where: { planId: subscription.planId },
    }) ?? null;

    const defaults = PLAN_LIMITS_DEFAULTS[subscription.planId] ?? PLAN_LIMITS_DEFAULTS[1];

    return {
        maxProductos: limits?.maxProductos ?? defaults.maxProductos,
        maxUsuarios: limits?.maxUsuarios ?? defaults.maxUsuarios,
        allowConsignaciones: limits?.allowConsignaciones ?? defaults.allowConsignaciones,
        allowSucursales: limits?.allowSucursales ?? defaults.allowSucursales,
        planId: subscription.planId,
        planNombre: subscription.plan?.nombre ?? "Desconocido",
    };
});

/**
 * Verifica si se puede crear un nuevo producto.
 * Retorna { allowed: true } o { allowed: false, message, current, max }
 */
export async function checkProductLimit() {
    const limits = await getActivePlanLimits();
    if (!limits) return { allowed: false as const, message: "No hay suscripción activa.", current: 0, max: 0 };
    if (limits.maxProductos === -1) return { allowed: true as const };

    const count = await prisma.producto.count({ where: { activo: true } });

    if (count >= limits.maxProductos) {
        return {
            allowed: false as const,
            message: `Has alcanzado el límite de ${limits.maxProductos} productos del plan ${limits.planNombre}. Actualizá tu plan para seguir creando.`,
            current: count,
            max: limits.maxProductos,
        };
    }

    return { allowed: true as const, current: count, max: limits.maxProductos };
}

/**
 * Verifica si se puede crear un nuevo usuario.
 */
export async function checkUserLimit() {
    const limits = await getActivePlanLimits();
    if (!limits) return { allowed: false as const, message: "No hay suscripción activa.", current: 0, max: 0 };

    const count = await prisma.usuario.count({ where: { activo: true } });

    if (count >= limits.maxUsuarios) {
        return {
            allowed: false as const,
            message: `Has alcanzado el límite de ${limits.maxUsuarios} usuarios del plan ${limits.planNombre}.`,
            current: count,
            max: limits.maxUsuarios,
        };
    }

    return { allowed: true as const, current: count, max: limits.maxUsuarios };
}

/**
 * Verifica si una feature (consignaciones, sucursales) está habilitada.
 */
export async function checkFeature(feature: "consignaciones" | "sucursales") {
    const limits = await getActivePlanLimits();
    if (!limits) return { allowed: false as const, message: "No hay suscripción activa." };

    const featureMap: Record<string, boolean> = {
        consignaciones: limits.allowConsignaciones,
        sucursales: limits.allowSucursales,
    };

    if (!featureMap[feature]) {
        return {
            allowed: false as const,
            message: `La funcionalidad de ${feature} no está disponible en el plan ${limits.planNombre}. Actualizá tu plan.`,
        };
    }

    return { allowed: true as const };
}

/**
 * Auto-seed de PlanLimit cuando se activa una suscripción.
 * Usa upsert para no duplicar.
 */
export async function seedPlanLimits(planId: number) {
    const defaults = PLAN_LIMITS_DEFAULTS[planId] ?? PLAN_LIMITS_DEFAULTS[1];

    await getPlanLimitDelegate()?.upsert({
        where: { planId },
        create: {
            planId,
            maxProductos: defaults.maxProductos,
            maxUsuarios: defaults.maxUsuarios,
            allowConsignaciones: defaults.allowConsignaciones,
            allowSucursales: defaults.allowSucursales,
        },
        update: {}, // No sobreescribir si ya existe (el admin pudo haberlo editado)
    });
}

/**
 * Maneja el downgrade de plan: desactiva recursos excedentes.
 * Retorna un resumen de lo desactivado para notificar al usuario.
 */
export async function handlePlanDowngrade(newPlanId: number) {
    const defaults = PLAN_LIMITS_DEFAULTS[newPlanId] ?? PLAN_LIMITS_DEFAULTS[1];

    // Cargar límites custom si existen
    const customLimits = await getPlanLimitDelegate()?.findUnique({
        where: { planId: newPlanId },
    }) ?? null;

    const maxProductos = customLimits?.maxProductos ?? defaults.maxProductos;
    const maxUsuarios = customLimits?.maxUsuarios ?? defaults.maxUsuarios;

    const summary: string[] = [];

    // --- Desactivar productos excedentes ---
    if (maxProductos !== -1) {
        const totalProductos = await prisma.producto.count({ where: { activo: true } });
        if (totalProductos > maxProductos) {
            const exceso = totalProductos - maxProductos;
            // Desactivar los más antiguos (los primeros creados)
            const productosADesactivar = await prisma.producto.findMany({
                where: { activo: true },
                orderBy: { createdAt: "asc" },
                take: exceso,
                select: { id: true, nombre: true },
            });

            await prisma.producto.updateMany({
                where: { id: { in: productosADesactivar.map(p => p.id) } },
                data: { activo: false },
            });

            summary.push(
                `Se desactivaron ${exceso} productos (límite del plan: ${maxProductos}). Productos afectados: ${productosADesactivar.map(p => p.nombre).join(", ")}`
            );
        }
    }

    // --- Desactivar usuarios excedentes ---
    if (maxUsuarios > 0) {
        const totalUsuarios = await prisma.usuario.count({ where: { activo: true } });
        if (totalUsuarios > maxUsuarios) {
            const exceso = totalUsuarios - maxUsuarios;
            // Desactivar los más nuevos (preservar los más antiguos/originales)
            const usuariosADesactivar = await prisma.usuario.findMany({
                where: { activo: true, rol: "EMPLEADO" }, // Nunca desactivar ADMINs
                orderBy: { createdAt: "desc" },
                take: exceso,
                select: { id: true, nombre: true },
            });

            if (usuariosADesactivar.length > 0) {
                await prisma.usuario.updateMany({
                    where: { id: { in: usuariosADesactivar.map(u => u.id) } },
                    data: { activo: false },
                });

                summary.push(
                    `Se desactivaron ${usuariosADesactivar.length} usuarios (límite del plan: ${maxUsuarios}).`
                );
            }
        }
    }

    return summary;
}
