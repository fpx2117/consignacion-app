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

    const response = await fetch(`${base}/v1/oauth2/token`, {
        method: "POST",
        body: "grant_type=client_credentials",
        headers: {
            Authorization: `Basic ${auth}`,
            "Content-Type": "application/x-www-form-urlencoded",
        },
    });

    const data = await response.json();
    return data.access_token;
}

/**
 * Creates a subscription manually via PayPal REST API.
 */
export async function createPayPalSubscription(planId: string) {
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
                locale: "es-AR",
                shipping_preference: "NO_SHIPPING",
                user_action: "SUBSCRIBE_NOW",
                return_url: `${process.env.NEXT_PUBLIC_APP_URL}/settings/subscriptions?status=success`,
                cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/settings/subscriptions?status=cancel`,
            },
        }),
    });

    if (!response.ok) {
        const error = await response.json();
        console.error("PayPal Subscription Error:", error);
        throw new Error(error.message || "Error creating PayPal subscription");
    }

    return await response.json();
}
