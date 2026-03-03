/* eslint-disable */
// @ts-nocheck
// src/lib/paypal.ts
import { paymentConfig } from "./paymentConfig";

const base = paymentConfig.paypal.apiUrl;

/**
 * Gets a PayPal access token using Client ID and Secret.
 */
export async function getPayPalAccessToken() {
    const auth = Buffer.from(
        `${paymentConfig.paypal.clientId}:${paymentConfig.paypal.secret}`
    ).toString("base64");

    try {
        const response = await fetch(`${base}/v1/oauth2/token`, {
            method: "POST",
            body: "grant_type=client_credentials",
            headers: {
                Authorization: `Basic ${auth}`,
                "Content-Type": "application/x-www-form-urlencoded",
            },
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            console.error("❌ PayPal Auth Error:", {
                status: response.status,
                statusText: response.statusText,
                details: errorData,
                mode: paymentConfig.paypal.mode,
                apiUrl: base,
                clientIdPrefix: paymentConfig.paypal.clientId.substring(0, 5) + "..."
            });
            throw new Error(`PayPal Auth Failed: ${response.status} ${response.statusText}. Check server logs for details.`);
        }

        const data = await response.json();
        console.log("✅ PayPal Access Token retrieved successfully [Mode: %s]", paymentConfig.paypal.mode);
        return data.access_token;
    } catch (error: any) {
        console.error("❌ PayPal request failed:", error.message);
        throw error;
    }
}

/**
 * Creates a subscription manually via PayPal REST API.
 */
export async function createPayPalSubscription(planId: string, returnUrl?: string, cancelUrl?: string) {
    const accessToken = await getPayPalAccessToken();

    const response = await fetch(`${base}/v1/billing/subscriptions`, {
        method: "POST",
        headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
            Accept: "application/json",
            "Prefer": "return=representation"
        },
        body: JSON.stringify({
            plan_id: planId,
            application_context: {
                brand_name: "Consignaciones POS",
                locale: "es-ES", // es-AR isn't always supported for billing
                shipping_preference: "NO_SHIPPING",
                user_action: "SUBSCRIBE_NOW",
                return_url: returnUrl || `${process.env.NEXT_PUBLIC_APP_URL}/settings/subscriptions?status=success`,
                cancel_url: cancelUrl || `${process.env.NEXT_PUBLIC_APP_URL}/settings/subscriptions?status=cancel`,
            },
        }),
    });

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error("❌ PayPal Subscription Error Details:", JSON.stringify(errorData, null, 2));

        // Extraer mensaje detallado si existe
        const detailedMessage = errorData.details?.[0]?.description || errorData.message || "Error desconocido";
        throw new Error(`PayPal API Error: ${detailedMessage}`);
    }

    return await response.json();
}
