/* eslint-disable */
// @ts-nocheck
// src/app/api/setup/create-preference/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { SUBSCRIPTION_PLANS } from "@/constants/subscriptions";
import { MercadoPagoConfig, Preference } from "mercadopago";
import { paymentConfig } from "@/lib/paymentConfig";

const client = new MercadoPagoConfig({
    accessToken: paymentConfig.mp.accessToken,
    options: { timeout: 5000 }
});

export async function POST(req: Request) {
    try {
        const { planId } = await req.json();

        const plan = SUBSCRIPTION_PLANS.find(p => p.id === planId);
        if (!plan) {
            return NextResponse.json({ error: "Plan no encontrado" }, { status: 404 });
        }

        const preference = new Preference(client);

        // Note: For SETUP, we don't have a userId yet. 
        // We'll use a placeholder or specific flag in external_reference.
        const { fetchDolarBlue } = await import("@/lib/dolarBlue");
        const exchangeRate = await fetchDolarBlue();
        const precioARS = plan.precioUSD * exchangeRate;

        const response = await preference.create({
            body: {
                items: [
                    {
                        id: String(plan.id),
                        title: `Activación Ecosistema: ${plan.nombre}`,
                        unit_price: precioARS,
                        quantity: 1,
                        currency_id: "ARS",
                    }
                ],
                back_urls: {
                    success: `${process.env.NEXT_PUBLIC_APP_URL}/setup?status=success`,
                    failure: `${process.env.NEXT_PUBLIC_APP_URL}/setup?status=failure`,
                    pending: `${process.env.NEXT_PUBLIC_APP_URL}/setup?status=pending`,
                },
                auto_return: "approved",
                external_reference: JSON.stringify({ flow: "setup", planId: plan.id }),
                // Webhook will still fire to api/webhooks/mercadopago if needed
                notification_url: `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/mercadopago`,
            }
        });

        return NextResponse.json({
            id: response.id,
            initPoint: response.init_point
        });

    } catch (error: any) {
        console.error("SETUP_CREATE_PREFERENCE_ERROR:", error);
        return NextResponse.json({ error: "Error al crear preferencia de pago" }, { status: 500 });
    }
}
