// src/lib/mercadopago.ts
import { MercadoPagoConfig, Preference } from "mercadopago";
import { paymentConfig } from "./paymentConfig";
import { getPlanByExternalId } from "@/constants/subscriptions";
import { prisma } from "./prisma";

// Initialize Mercado Pago client
const client = new MercadoPagoConfig({
    accessToken: paymentConfig.mp.accessToken,
    options: { timeout: 5000 }
});

export async function createMercadoPagoPreference(planId: string, userId: string) {
    const basePlan = getPlanByExternalId(planId);

    if (!basePlan) {
        throw new Error(`Plan local no encontrado para: ${planId}`);
    }

    const plan = await prisma.plan.findUnique({
        where: { id: basePlan.id }
    });

    if (!plan || !plan.precioARS) {
        throw new Error(`Plan con ID ${planId} no encontrado en la base de datos o sin precio ARS`);
    }

    const preference = new Preference(client);

    try {
        const response = await preference.create({
            body: {
                items: [
                    {
                        id: basePlan.mercadopagoId,
                        title: `Suscripción ${plan.nombre || basePlan.nombre}`,
                        unit_price: Number(plan.precioARS),
                        quantity: 1,
                        currency_id: "ARS",
                    }
                ],
                back_urls: {
                    success: `${process.env.NEXT_PUBLIC_APP_URL}/settings/subscriptions?status=success`,
                    failure: `${process.env.NEXT_PUBLIC_APP_URL}/settings/subscriptions?status=failure`,
                    pending: `${process.env.NEXT_PUBLIC_APP_URL}/settings/subscriptions?status=pending`,
                },
                auto_return: "approved",
                external_reference: JSON.stringify({ userId, planId }),
                notification_url: `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/mercadopago`,
            }
        });

        return response;
    } catch (error: any) {
        console.error("Mercado Pago Preference Creation Error:", error);
        throw new Error(error.message || "Error al crear la preferencia de Mercado Pago");
    }
}

export async function updateMercadoPagoSubscriptionPrice(preapprovalId: string, newPriceARS: number) {
    try {
        const response = await fetch(`https://api.mercadopago.com/preapproval/${preapprovalId}`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${paymentConfig.mp.accessToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                auto_recurring: {
                    transaction_amount: newPriceARS
                }
            })
        });

        const data = await response.json();

        if (!response.ok) {
            console.error("MP Update Preapproval Error Response:", data);
            throw new Error(data.message || "Error al actualizar la suscripción en Mercado Pago");
        }

        return data;
    } catch (error: any) {
        console.error("Mercado Pago Subscription Update Error:", error);
        throw new Error(error.message || "Error de red al actualizar la suscripción");
    }
}
