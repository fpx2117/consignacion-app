// src/lib/mercadopago.ts
import { MercadoPagoConfig, Preference } from "mercadopago";
import { paymentConfig } from "./paymentConfig";
import { SUBSCRIPTION_PLANS } from "@/constants/subscriptions";

// Initialize Mercado Pago client
const client = new MercadoPagoConfig({
    accessToken: paymentConfig.mp.accessToken,
    options: { timeout: 5000 }
});

export async function createMercadoPagoPreference(planId: string, userId: string) {
    const plan = SUBSCRIPTION_PLANS.find(p => p.mercadopagoId === planId);

    if (!plan) {
        throw new Error(`Plan with ID ${planId} not found`);
    }

    const preference = new Preference(client);

    try {
        const response = await preference.create({
            body: {
                items: [
                    {
                        id: plan.mercadopagoId,
                        title: `Suscripción ${plan.nombre}`,
                        unit_price: plan.precioARS,
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
