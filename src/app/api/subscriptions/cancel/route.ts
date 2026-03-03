/* eslint-disable */
// @ts-nocheck
// src/app/api/subscriptions/cancel/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/requireAuth";
import { ProveedorSuscripcion } from "@prisma/client";
import { MercadoPagoConfig, PreApproval } from "mercadopago";
import { paymentConfig } from "@/lib/paymentConfig";
import { getPayPalAccessToken } from "@/lib/paypal";

const mpClient = new MercadoPagoConfig({
    accessToken: paymentConfig.mp.accessToken
});

export async function POST(req: Request) {
    const auth = await requireAuth();
    if (!auth.ok) return auth.res;

    const userId = parseInt(auth.user.sub);

    try {
        const subscription = await prisma.subscription.findUnique({
            where: { userId },
            include: { plan: true }
        });

        if (!subscription || !subscription.externalId) {
            return NextResponse.json({ error: "Suscripción no encontrada" }, { status: 404 });
        }

        if (subscription.provider === ProveedorSuscripcion.PAYPAL) {
            // Cancelar en PayPal
            const accessToken = await getPayPalAccessToken();
            const res = await fetch(`${paymentConfig.paypal.apiUrl}/v1/billing/subscriptions/${subscription.externalId}/cancel`, {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ reason: "Cancelado por el usuario desde el panel" }),
            });

            if (!res.ok && res.status !== 204) {
                const err = await res.json();
                console.error("PayPal Cancel Error:", err);
                return NextResponse.json({ error: "No se pudo cancelar en PayPal" }, { status: 400 });
            }
        } else if (subscription.provider === ProveedorSuscripcion.MERCADOPAGO) {
            // Cancelar en Mercado Pago
            const preApproval = new PreApproval(mpClient);
            await preApproval.update({
                id: subscription.externalId,
                body: { status: "cancelled" }
            });
        }

        // Actualizar en base de datos
        await prisma.subscription.update({
            where: { id: subscription.id },
            data: { status: "CANCELADO" }
        });

        return NextResponse.json({ ok: true, message: "Suscripción cancelada exitosamente" });

    } catch (error: any) {
        console.error("CANCEL_SUBSCRIPTION_ERROR:", error);
        return NextResponse.json({ error: "Error interno al cancelar la suscripción" }, { status: 500 });
    }
}
