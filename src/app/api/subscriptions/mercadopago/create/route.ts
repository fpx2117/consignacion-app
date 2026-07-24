import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/require-auth";
import { createMercadoPagoPreference } from "@/lib/payments/mercadopago";

type CreateMercadoPagoBody = {
  planId?: string;
};

export async function POST(req: Request) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.res;

  try {
    const { planId } = (await req.json()) as CreateMercadoPagoBody;

    if (!planId) {
      return NextResponse.json(
        { error: "No se proporcionó un ID de plan" },
        { status: 400 },
      );
    }

    const preference = await createMercadoPagoPreference(
      planId as string,
      auth.user.sub,
    );

    return NextResponse.json({
      id: preference.id,
      initPoint: preference.init_point,
      sandboxInitPoint: preference.sandbox_init_point,
    });
  } catch (error) {
    console.error("API_MERCADOPAGO_CREATE_ERROR:", error);
    return NextResponse.json(
      { error: "Error al crear la preferencia en Mercado Pago" },
      { status: 500 },
    );
  }
}
