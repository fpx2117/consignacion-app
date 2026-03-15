// src/app/api/cron/check-subscriptions/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendNotification } from "@/lib/notificaciones/socket-trigger";
import { NOTIFICATION_TYPE, NOTIFICATION_CONFIG } from "@/lib/notificaciones/types";

export async function GET(request: Request) {
    const cronSecret = process.env.CRON_SECRET;
    if (!cronSecret || cronSecret.trim() === "") {
        return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${cronSecret}`) {
        return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    try {
        const now = new Date();
        const in3Days = new Date(now.getTime() + (3 * 24 * 60 * 60 * 1000));

        // 1. Check trials ending in next 3 days
        const trialEndingSoon = await prisma.subscription.findMany({
            where: {
                status: "PRUEBA",
                trialEndsAt: {
                    gt: now,
                    lte: in3Days,
                }
            },
            include: { user: true }
        });

        for (const sub of trialEndingSoon) {
            const fingerprint = `TRIAL_END:${sub.id}:${sub.trialEndsAt?.toISOString().split('T')[0]}`;
            const exists = await prisma.notification.findUnique({ where: { fingerprint } });

            if (!exists) {
                const type = NOTIFICATION_TYPE.TRIAL_ENDING;
                const savedNotif = await prisma.notification.create({
                    data: {
                        type,
                        title: NOTIFICATION_CONFIG[type].label,
                        description: `Tu período de prueba termina pronto (${sub.trialEndsAt?.toLocaleDateString()}).`,
                        fingerprint,
                    }
                });

                await sendNotification({
                    type,
                    title: `🎁 ${NOTIFICATION_CONFIG[type].label}`,
                    message: `Atención ${sub.user.nombre}: Tu prueba gratuita termina el ${sub.trialEndsAt?.toLocaleDateString()}.`,
                    data: { id: savedNotif.id, userId: sub.userId }
                });
            }
        }

        // 2. Check active subscriptions expiring in next 3 days
        const expiringSoon = await prisma.subscription.findMany({
            where: {
                status: "ACTIVO",
                currentPeriodEnd: {
                    gt: now,
                    lte: in3Days,
                }
            },
            include: { user: true }
        });

        for (const sub of expiringSoon) {
            const fechaStr = sub.currentPeriodEnd?.toISOString().split('T')[0] || 'unknown';
            const fingerprint = `SUB_EXPIRING:${sub.id}:${fechaStr}`;
            const exists = await prisma.notification.findUnique({ where: { fingerprint } });

            if (!exists) {
                const type = NOTIFICATION_TYPE.SUBSCRIPTION_EXPIRING;
                const savedNotif = await prisma.notification.create({
                    data: {
                        type,
                        title: NOTIFICATION_CONFIG[type].label,
                        description: `Tu suscripción se renovará pronto (${sub.currentPeriodEnd?.toLocaleDateString()}).`,
                        fingerprint,
                    }
                });

                await sendNotification({
                    type,
                    title: `💳 ${NOTIFICATION_CONFIG[type].label}`,
                    message: `Hola ${sub.user.nombre}, recordá que tu suscripción vence el ${sub.currentPeriodEnd?.toLocaleDateString()}.`,
                    data: { id: savedNotif.id, userId: sub.userId }
                });
            }
        }

        return NextResponse.json({
            success: true,
            processed: { trials: trialEndingSoon.length, expiring: expiringSoon.length }
        });

    } catch (error) {
        console.error("SUBSCRIPTION_CRON_ERROR:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
