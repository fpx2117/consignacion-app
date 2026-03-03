/* eslint-disable */
// @ts-nocheck
// src/app/api/webhooks/mercadopago/route.ts
import { NextResponse } from "next/server";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { paymentConfig } from "@/lib/paymentConfig";
import { sendNotification } from "@/lib/socket-trigger";
import { NOTIFICATION_TYPE } from "@/lib/notificationes/notificaciones-types";
import { seedPlanLimits } from "@/lib/requireSubscription";

// Mercado Pago Webhook Validation
function validateSignature(xSignature: string, xRequestId: string, body: string) {
    const secret = paymentConfig.mp.webhookSecret;

    // The signature format is often "ts=...,v1=..."
    // But for simpler V2 implementations or IPN it might differ.
    // Standard V2 validation using HMAC:
    const parts = xSignature.split(",");
    const tsPart = parts.find((p) => p.startsWith("ts="));
    const v1Part = parts.find((p) => p.startsWith("v1="));

    if (!tsPart || !v1Part) return false;

    const ts = tsPart.split("=")[1];
    const v1 = v1Part.split("=")[1];

    const manifest = `id:${xRequestId};request-id:${xRequestId};ts:${ts};`;
    const signature = crypto
        .createHmac("sha256", secret)
        .update(manifest)
        .digest("hex");

    return signature === v1;
}

export async function POST(request: Request) {
    const xSignature = request.headers.get("x-signature");
    const xRequestId = request.headers.get("x-request-id");
    const rawBody = await request.text();

    // 1. Signature Validation (Critical for Security)
    if (!xSignature || !xRequestId || !validateSignature(xSignature, xRequestId, rawBody)) {
        console.warn("⚠️ Invalid Mercado Pago Webhook Signature");
        // Return 200 to suggest reception but log the error (or 403 if we want to be strict)
        return NextResponse.json({ error: "Invalid signature" }, { status: 403 });
    }

    const data = JSON.parse(rawBody);
    const { action, data: eventData } = data;

    console.log(`[MercadoPago Webhook] Action: ${action}`, eventData);

    try {
        // 2. Handle Subscription Related Actions (PreApproval)
        if (action === "subscription_preapproval.created" || action === "subscription_preapproval.updated") {
            const externalId = eventData.id;

            const subscription = await prisma.subscription.findUnique({
                where: { externalId },
                include: { user: true, plan: true }
            });

            if (subscription) {
                // En un flujo real, consultaríamos a MP para ver el plan_id actual
                // Si el planId cambió (downgrade/upgrade), actualizamos
                // Por ahora, asumimos que si el webhook dispara, es para activar/extender

                await prisma.subscription.update({
                    where: { externalId },
                    data: {
                        status: "ACTIVO",
                        updatedAt: new Date(),
                        mpPreapprovalId: externalId
                    }
                });

                await sendNotification({
                    type: NOTIFICATION_TYPE.SUBSCRIPTION_ACTIVE,
                    title: "Suscripción Mercado Pago",
                    message: `La suscripción de ${subscription.user.nombre} está activa.`,
                    data: { userId: subscription.userId }
                });

                // Si es un downgrade, manejarlo
                // (Nota: En MP PreApproval el planId suele estar en el external_reference o metadata)
                // Por simplicidad en este MVP, si recibimos un cambio de plan, llamamos a:
                // await handlePlanDowngrade(newPlanId);

                await seedPlanLimits(subscription.planId);
            }
        }

        // 3. Handle Payment Related Actions (optional for trial logic)
        if (action === "payment.created") {
            // Lógica extra para registrar el pago si fuera necesario
        }

        return NextResponse.json({ received: true });
    } catch (error) {
        console.error("[MercadoPago Webhook Error]:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
