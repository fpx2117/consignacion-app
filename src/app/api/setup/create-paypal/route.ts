/* eslint-disable */
// @ts-nocheck
// src/app/api/setup/create-paypal/route.ts
import { NextResponse } from "next/server";
import { createPayPalSubscription } from "@/lib/paypal";
import { SUBSCRIPTION_PLANS } from "@/constants/subscriptions";

export async function POST(req: Request) {
    try {
        const { planId } = await req.json();

        if (!planId) {
            return NextResponse.json({ error: "No se proporcionó un ID de plan" }, { status: 400 });
        }

        // Buscamos el plan en nuestras constantes
        const plan = SUBSCRIPTION_PLANS.find(p => p.id === planId);
        if (!plan) {
            return NextResponse.json({ error: "Plan no encontrado" }, { status: 404 });
        }

        // Llamamos a nuestro servicio de PayPal con URLs de retorno para el setup
        const returnUrl = `${process.env.NEXT_PUBLIC_APP_URL}/setup?status=success&provider=paypal`;
        const cancelUrl = `${process.env.NEXT_PUBLIC_APP_URL}/setup?status=cancel&provider=paypal`;

        const result = await createPayPalSubscription(plan.paypalId, returnUrl, cancelUrl);

        // Retornamos los links de aprobación para que el frontend pueda redireccionar
        const approveLink = result.links.find((l: any) => l.rel === "approve");

        return NextResponse.json({
            id: result.id,
            status: result.status,
            approveUrl: approveLink?.href
        });

    } catch (error: any) {
        console.error("API_SETUP_PAYPAL_CREATE_ERROR:", error);
        return NextResponse.json(
            { error: error.message || "Error al crear la suscripción en PayPal" },
            { status: 500 }
        );
    }
}
