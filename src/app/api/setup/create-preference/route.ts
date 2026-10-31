import { NextResponse } from "next/server";
import { SUBSCRIPTION_PLANS } from "@/constants/subscriptions";
import { MercadoPagoConfig, Preference } from "mercadopago";
import { paymentConfig } from "@/lib/payments/config";
import { createSetupPaymentReference } from "../setup-payment-reference";

type CreatePreferenceBody = {
  planId?: number;
  adminEmail?: string;
};

const client = new MercadoPagoConfig({
  accessToken: paymentConfig.mp.accessToken,
  options: { timeout: 5000 },
});

export async function POST(req: Request) {
  try {
    const { planId, adminEmail } = (await req.json()) as CreatePreferenceBody;

    const plan = SUBSCRIPTION_PLANS.find((p) => p.id === planId);
    if (!plan) {
      return NextResponse.json(
        { error: "Plan no encontrado" },
        { status: 404 },
      );
    }
    if (typeof adminEmail !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(adminEmail))
      return NextResponse.json({ error: "Email inválido" }, { status: 400 });

    const preference = new Preference(client);

    const { fetchDolarBlue } = await import("@/lib/integrations/dolarBlue");
    const exchangeRate = await fetchDolarBlue();
    const precioARS = plan.precioUSD * exchangeRate;

    const response = await preference.create({
      body: {
        items: [
          {
            id: String(plan.id),
            title: `Activación Ecosistema: ${plan.nombre}`,
            unit_price: precioARS,
            quantity: 1,
            currency_id: "ARS",
          },
        ],
        back_urls: {
          success: `${process.env.NEXT_PUBLIC_APP_URL}/setup?status=success`,
          failure: `${process.env.NEXT_PUBLIC_APP_URL}/setup?status=failure`,
          pending: `${process.env.NEXT_PUBLIC_APP_URL}/setup?status=pending`,
        },
        auto_return: "approved",
        external_reference: createSetupPaymentReference(plan.id, adminEmail),
        notification_url: `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/mercadopago`,
      },
    });
    return NextResponse.json({
      id: response.id,
      initPoint: response.init_point,
    });
  } catch (error) {
    console.error("SETUP_CREATE_PREFERENCE_ERROR:", error);
    return NextResponse.json(
      { error: "Error al crear preferencia de pago" },
      { status: 500 },
    );
  }
}
