// src/lib/paymentConfig.ts
import { z } from "zod";

const paymentConfigSchema = z.object({
    // MERCADO PAGO
    mp: z.object({
        accessToken: z.string().min(1, "MP_ACCESS_TOKEN is required"),
        publicKey: z.string().min(1, "MP_PUBLIC_KEY is required"),
        webhookSecret: z.string().min(1, "MP_WEBHOOK_SECRET is required"),
    }),

    // PAYPAL
    paypal: z.object({
        clientId: z.string().min(1, "PAYPAL_CLIENT_ID is required"),
        secret: z.string().min(1, "PAYPAL_SECRET is required"),
        webhookId: z.string().min(1, "PAYPAL_WEBHOOK_ID is required"),
        mode: z.enum(["sandbox", "live"]).default("sandbox"),
        apiUrl: z.string().url().optional(),
    }),

    // BUSINESS
    business: z.object({
        defaultTrialDays: z.coerce.number().default(7),
    }),

    // FEATURE FLAGS
    featureFlags: z.object({
        publicCheckoutV2: z.coerce.boolean().default(false),
    }),
});

export type PaymentConfig = z.infer<typeof paymentConfigSchema>;

function loadPaymentConfig(): PaymentConfig {
    const rawConfig = {
        mp: {
            accessToken: process.env.MP_ACCESS_TOKEN,
            publicKey: process.env.MP_PUBLIC_KEY,
            webhookSecret: process.env.MP_WEBHOOK_SECRET,
        },
        paypal: {
            clientId: process.env.PAYPAL_CLIENT_ID,
            secret: process.env.PAYPAL_SECRET,
            webhookId: process.env.PAYPAL_WEBHOOK_ID,
            mode: process.env.PAYPAL_MODE || "sandbox",
            apiUrl: process.env.PAYPAL_API_URL || (process.env.PAYPAL_MODE === "live" ? "https://api-m.paypal.com" : "https://api-m.sandbox.paypal.com"),
        },
        business: {
            defaultTrialDays: process.env.DEFAULT_TRIAL_DAYS,
        },
        featureFlags: {
            publicCheckoutV2: process.env.PUBLIC_CHECKOUT_V2,
        },
    };
    const result = paymentConfigSchema.safeParse(rawConfig);

    if (!result.success) {
        console.error("❌ Invalid payment configuration:", result.error.format());
        // In dev, we might want to throw or just log. In prod, this should probably be fatal.
        if (process.env.NODE_ENV === "production") {
            throw new Error("Invalid payment configuration");
        }
    }

    if (result.success) {
        return result.data;
    }

    return {
        mp: {
            accessToken: String(rawConfig.mp.accessToken ?? ""),
            publicKey: String(rawConfig.mp.publicKey ?? ""),
            webhookSecret: String(rawConfig.mp.webhookSecret ?? ""),
        },
        paypal: {
            clientId: String(rawConfig.paypal.clientId ?? ""),
            secret: String(rawConfig.paypal.secret ?? ""),
            webhookId: String(rawConfig.paypal.webhookId ?? ""),
            mode: rawConfig.paypal.mode === "live" ? "live" : "sandbox",
            apiUrl: rawConfig.paypal.apiUrl,
        },
        business: {
            defaultTrialDays: Number(rawConfig.business.defaultTrialDays ?? 7),
        },
        featureFlags: {
            publicCheckoutV2: String(rawConfig.featureFlags.publicCheckoutV2 ?? "").toLowerCase() === "true",
        },
    };
}

export const paymentConfig = loadPaymentConfig();
