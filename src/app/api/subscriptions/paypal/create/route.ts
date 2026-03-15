import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/require-auth";
import { createPayPalSubscription } from "@/lib/payments/paypal";

type CreatePayPalBody = {
    planId?: string;
};

type PayPalSubscriptionLink = {
    rel?: string;
    href?: string;
};

type PayPalSubscriptionResponse = {
    id?: string;
    status?: string;
    links?: PayPalSubscriptionLink[];
};

export async function POST(req: Request) {
    const auth = await requireAuth();
    if (!auth.ok) return auth.res;

    try {
        const { planId } = (await req.json()) as CreatePayPalBody;

        if (!planId) {
            return NextResponse.json({ error: "No se proporcionó un ID de plan" }, { status: 400 });
        }

        // Llamamos a nuestro servicio de PayPal
        const result = (await createPayPalSubscription(planId)) as PayPalSubscriptionResponse;

        // Retornamos los links de aprobación para que el frontend pueda redireccionar
        const approveLink = result.links?.find((link) => link.rel === "approve");

        return NextResponse.json({
            id: result.id,
            status: result.status,
            approveUrl: approveLink?.href
        });

    } catch (error) {
        console.error("API_PAYPAL_CREATE_ERROR:", error);
        return NextResponse.json(
            { error: "Error al crear la suscripción en PayPal" },
            { status: 500 }
        );
    }
}
