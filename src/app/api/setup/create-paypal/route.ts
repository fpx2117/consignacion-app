import { NextResponse } from "next/server";
import { createPayPalSubscription } from "@/lib/payments/paypal";
import { SUBSCRIPTION_PLANS } from "@/constants/subscriptions";
import { createSetupPaymentReference } from "../setup-payment-reference";

type CreatePayPalBody = {
  planId?: number;
  adminEmail?: string;
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
  try {
    const { planId, adminEmail } = (await req.json()) as CreatePayPalBody;

    if (!planId) {
      return NextResponse.json(
        { error: "No se proporcionó un ID de plan" },
        { status: 400 },
      );
    }
    const plan = SUBSCRIPTION_PLANS.find((p) => p.id === planId);
    if (!plan) {
      return NextResponse.json(
        { error: "Plan no encontrado" },
        { status: 404 },
      );
    }
    if (typeof adminEmail !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(adminEmail))
      return NextResponse.json({ error: "Email inválido" }, { status: 400 });

    const returnUrl = `${process.env.NEXT_PUBLIC_APP_URL}/setup?status=success&provider=paypal`;
    const cancelUrl = `${process.env.NEXT_PUBLIC_APP_URL}/setup?status=cancel&provider=paypal`;

    const result = (await createPayPalSubscription(
      plan.paypalId,
      returnUrl,
      cancelUrl,
      createSetupPaymentReference(plan.id, adminEmail),
    )) as PayPalSubscriptionResponse;

    const approveLink = result.links?.find((link) => link.rel === "approve");
    return NextResponse.json({
      id: result.id,
      status: result.status,
      approveUrl: approveLink?.href,
    });
  } catch (error) {
    console.error("API_SETUP_PAYPAL_CREATE_ERROR:", error);
    return NextResponse.json(
      { error: "Error al crear la suscripción en PayPal" },
      { status: 500 },
    );
  }
}
