import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth/require-auth";
import { SUBSCRIPTION_PLANS } from "@/constants/subscriptions";
import { getActivePlanLimits } from "@/lib/subscriptions/require-subscription";

export async function GET() {
    const auth = await requireAuth();
    if (!auth.ok) return auth.res;

    try {
        const now = new Date();

        // 1) Intentar suscripcion del usuario actual
        let subscription = await prisma.subscription.findUnique({
            where: { userId: Number(auth.user.sub) },
            include: { plan: true },
        });

        // 2) Fallback a nivel sistema/programa: evita que admins secundarios queden "sin plan"
        // cuando la suscripcion esta asociada al admin principal.
        if (!subscription) {
            subscription = await prisma.subscription.findFirst({
                where: {
                    OR: [
                        { status: { in: ["ACTIVO", "PRUEBA"] } },
                        {
                            status: "CANCELADO",
                            OR: [
                                { currentPeriodEnd: { gt: now } },
                                { trialEndsAt: { gt: now } },
                            ],
                        },
                    ],
                },
                orderBy: { createdAt: "desc" },
                include: { plan: true },
            });
        }

        if (!subscription) {
            return NextResponse.json({
                hasSubscription: false,
                message: "El usuario no tiene una suscripción activa.",
            }, {
                headers: {
                    "Cache-Control": "private, max-age=30, stale-while-revalidate=120",
                },
            });
        }

        // Calcula días restantes usando la fecha más lejana disponible
        const targetDate = subscription.currentPeriodEnd || subscription.trialEndsAt;
        let daysRemaining = 0;

        if (targetDate) {
            const now = new Date();
            // Normalizar a medianoche para evitar que a las 23:59 falten "0 días" pero el usuario aún tenga acceso
            const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            const end = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate());

            const diffTime = end.getTime() - start.getTime();
            daysRemaining = Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
        }

        const planLimits = await getActivePlanLimits();

        // Buscamos la metadata del plan en nuestras constantes por si queremos mostrar features, etc.
        const planMeta = SUBSCRIPTION_PLANS.find(p => p.id === subscription.planId);

        return NextResponse.json({
            hasSubscription: true,
            subscription: {
                id: subscription.id,
                status: subscription.status, // PRUEBA, ACTIVO, etc.
                provider: subscription.provider,
                plan: {
                    id: subscription.planId,
                    nombre: subscription.plan.nombre,
                    precioARS: subscription.plan.precioARS,
                    precioUSD: subscription.plan.precioUSD,
                    ...planMeta,
                },
                trialEndsAt: subscription.trialEndsAt,
                currentPeriodEnd: subscription.currentPeriodEnd,
                daysRemaining,
                cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
            },
            planLimits,
        }, {
            headers: {
                "Cache-Control": "private, max-age=30, stale-while-revalidate=120",
            },
        });
    } catch (error) {
        console.error("API_CURRENT_SUBSCRIPTION_ERROR:", error);
        return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
    }
}
