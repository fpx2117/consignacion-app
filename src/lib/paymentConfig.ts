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
});

export type PaymentConfig = z.infer<typeof paymentConfigSchema>;

function loadPaymentConfig(): PaymentConfig {
    const result = paymentConfigSchema.safeParse({
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
    });

    if (!result.success) {
        console.error("❌ Invalid payment configuration:", result.error.format());
        // In dev, we might want to throw or just log. In prod, this should probably be fatal.
        if (process.env.NODE_ENV === "production") {
            throw new Error("Invalid payment configuration");
        }
    }

    return result.success
        ? result.data
        : (result.error as any); // Fallback for dev if not total failure
}

export const paymentConfig = loadPaymentConfig();
