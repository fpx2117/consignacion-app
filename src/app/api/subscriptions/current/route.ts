// src/app/api/subscriptions/current/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/requireAuth";
import { SUBSCRIPTION_PLANS, getPlanByExternalId } from "@/constants/subscriptions";

export async function GET() {
    const auth = await requireAuth();
    if (!auth.ok) return auth.res;

    try {
        const subscription = await prisma.subscription.findUnique({
            where: { userId: Number(auth.user.sub) },
            include: { plan: true },
        });

        if (!subscription) {
            return NextResponse.json({
                hasSubscription: false,
                message: "El usuario no tiene una suscripción activa.",
            });
        }

        // Calcula días restantes
        const targetDate = subscription.currentPeriodEnd || subscription.trialEndsAt;
        let daysRemaining = 0;
        if (targetDate) {
            const now = new Date();
            const diffTime = targetDate.getTime() - now.getTime();
            daysRemaining = Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
        }

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
        });
    } catch (error) {
        console.error("API_CURRENT_SUBSCRIPTION_ERROR:", error);
        return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
    }
}
