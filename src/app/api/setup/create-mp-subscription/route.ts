/* eslint-disable */
// @ts-nocheck
// src/app/api/setup/create-mp-subscription/route.ts
import { NextResponse } from "next/server";
import { SUBSCRIPTION_PLANS } from "@/constants/subscriptions";
import { MercadoPagoConfig, PreApproval } from "mercadopago";
import crypto from "crypto";
import { paymentConfig } from "@/lib/paymentConfig";
import { prisma } from "@/lib/prisma";

const client = new MercadoPagoConfig({
    accessToken: paymentConfig.mp.accessToken,
    options: { timeout: 10000 }
});

export async function POST(req: Request) {
    try {
        const { planId } = await req.json();

        const basePlan = SUBSCRIPTION_PLANS.find(p => p.id === planId);
        if (!basePlan) {
            return NextResponse.json({ error: "Plan base no encontrado" }, { status: 404 });
        }

        if (!basePlan.mercadopagoPlanId) {
            return NextResponse.json({ error: "El plan seleccionado no soporta suscripción recurrente en Mercado Pago" }, { status: 400 });
        }

        const plan = await prisma.plan.findUnique({
            where: { id: planId }
        });

        if (!plan) {
            return NextResponse.json({ error: "Plan en BD no encontrado" }, { status: 404 });
        }

        const preApproval = new PreApproval(client);

        const { fetchDolarBlue } = await import("@/lib/dolarBlue");
        const exchangeRate = await fetchDolarBlue();
        const precioARS = Number(plan.precioUSD) * exchangeRate;

        // Creamos la suscripción basada en el PlanId de MP (o con esquema propio si no hay PlanId)
        // Usamos el esquema de "Plan" de MP si está disponible, o definimos la recurrencia aquí.
        const response = await preApproval.create({
            body: {
                reason: `Suscripción Ecosistema: ${plan.nombre}`,
                auto_recurring: {
                    frequency: 1,
                    frequency_type: "months",
                    transaction_amount: precioARS,
                    currency_id: "ARS",
                },
                back_url: `${process.env.NEXT_PUBLIC_APP_URL}/setup?status=success`,
                external_reference: JSON.stringify({ flow: "setup", planId: plan.id }),
                payer_email: "test_user_123@testuser.com", // En MP Subscriptions el email es obligatorio
                status: "pending",
            },
            requestOptions: {
                idempotencyKey: crypto.randomUUID()
            }
        });

        return NextResponse.json({
            id: response.id,
            initPoint: response.init_point
        });

    } catch (error: any) {
        console.error("SETUP_CREATE_MP_SUBSCRIPTION_ERROR:", error);
        return NextResponse.json({
            error: "Error al crear la suscripción de Mercado Pago"
        }, { status: 500 });
    }
}
