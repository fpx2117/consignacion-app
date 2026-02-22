// src/app/api/webhooks/paypal/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { paymentConfig } from "@/lib/paymentConfig";
import { sendNotification } from "@/lib/socket-trigger";
import { NOTIFICATION_TYPE } from "@/lib/notificationes/notificaciones-types";
import { seedPlanLimits } from "@/lib/requireSubscription";

// PayPal Webhook Verification (Requires calling PayPal API)
async function verifyPayPalWebhook(headers: Headers, body: string) {
    const webhookId = paymentConfig.paypal.webhookId;
    const apiUrl = paymentConfig.paypal.apiUrl;

    // We need an OAuth2 token to verify the webhook
    const auth = Buffer.from(
        `${paymentConfig.paypal.clientId}:${paymentConfig.paypal.secret}`
    ).toString("base64");

    const tokenRes = await fetch(`${apiUrl}/v1/oauth2/token`, {
        method: "POST",
        headers: {
            Authorization: `Basic ${auth}`,
            "Content-Type": "application/x-www-form-urlencoded",
        },
        body: "grant_type=client_credentials",
    });

    const { access_token } = await tokenRes.json();

    const verificationRes = await fetch(
        `${apiUrl}/v1/notifications/verify-webhook-signature`,
        {
            method: "POST",
            headers: {
                Authorization: `Bearer ${access_token}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                auth_algo: headers.get("paypal-auth-algo"),
                cert_url: headers.get("paypal-cert-url"),
                transmission_id: headers.get("paypal-transmission-id"),
                transmission_sig: headers.get("paypal-transmission-sig"),
                transmission_time: headers.get("paypal-transmission-time"),
                webhook_id: webhookId,
                webhook_event: JSON.parse(body),
            }),
        }
    );

    const verificationData = await verificationRes.json();
    return verificationData.verification_status === "SUCCESS";
}

export async function POST(request: Request) {
    const rawBody = await request.text();

    // 1. Signature Validation via PayPal API
    const isValid = await verifyPayPalWebhook(request.headers, rawBody);

    if (!isValid) {
        console.warn("⚠️ Invalid PayPal Webhook Signature");
        return NextResponse.json({ error: "Invalid signature" }, { status: 403 });
    }

    const event = JSON.parse(rawBody);
    const eventType = event.event_type;

    console.log(`[PayPal Webhook] Event: ${eventType}`, event.resource.id);

    try {
        // 2. Handle Subscription Related Events
        if (eventType === "BILLING.SUBSCRIPTION.ACTIVATED" || eventType === "BILLING.SUBSCRIPTION.CREATED") {
            const externalId = event.resource.id;

            const subscription = await prisma.subscription.findUnique({
                where: { externalId },
                include: { user: true }
            });

            if (subscription) {
                await prisma.subscription.update({
                    where: { externalId },
                    data: {
                        status: "ACTIVO",
                        updatedAt: new Date(),
                    }
                });

                await sendNotification({
                    type: NOTIFICATION_TYPE.SUBSCRIPTION_ACTIVE,
                    title: "Suscripción Activa (PayPal)",
                    message: `El plan de ${subscription.user.nombre} se ha activado correctamente.`,
                    data: { userId: subscription.userId }
                });

                // Auto-seed de límites del plan
                await seedPlanLimits(subscription.planId);
            }
        }

        if (eventType === "BILLING.SUBSCRIPTION.CANCELLED" || eventType === "BILLING.SUBSCRIPTION.EXPIRED") {
            const externalId = event.resource.id;
            await prisma.subscription.updateMany({
                where: { externalId },
                data: { status: "CANCELADO" }
            });
        }

        return NextResponse.json({ received: true });
    } catch (error) {
        console.error("[PayPal Webhook Error]:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
