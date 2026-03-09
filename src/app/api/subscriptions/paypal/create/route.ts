/* eslint-disable */
// @ts-nocheck
// src/app/api/subscriptions/paypal/create/route.ts
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/requireAuth";
import { createPayPalSubscription } from "@/lib/paypal";

export async function POST(req: Request) {
    const auth = await requireAuth();
    if (!auth.ok) return auth.res;

    try {
        const { planId } = await req.json();

        if (!planId) {
            return NextResponse.json({ error: "No se proporcionó un ID de plan" }, { status: 400 });
        }

        // Llamamos a nuestro servicio de PayPal
        const result = await createPayPalSubscription(planId);

        // Retornamos los links de aprobación para que el frontend pueda redireccionar
        const approveLink = result.links.find((l: any) => l.rel === "approve");

        return NextResponse.json({
            id: result.id,
            status: result.status,
            approveUrl: approveLink?.href
        });

    } catch (error: any) {
        console.error("API_PAYPAL_CREATE_ERROR:", error);
        return NextResponse.json(
            { error: "Error al crear la suscripción en PayPal" },
            { status: 500 }
        );
    }
}
