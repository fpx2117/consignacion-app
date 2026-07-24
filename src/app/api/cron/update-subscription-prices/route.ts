import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { fetchDolarBlue } from "@/lib/integrations/dolarBlue";
import { updateMercadoPagoSubscriptionPrice } from "@/lib/payments/mercadopago";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  console.log("CRON INICIADO: Módulo update-subscription-prices");

  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || cronSecret.trim() === "") {
    console.error("CRON ERROR: CRON_SECRET no está configurado");
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${cronSecret}`) {
    console.error("CRON ERROR: No autorizado. Verifica tu CRON_SECRET");
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    console.log("CRON: Obteniendo cotización Dólar Blue...");
    // 1. Get the current dollar blue rate
    const exchangeRate = await fetchDolarBlue();
    console.log("CRON: Cotización Dólar Blue obtenida:", exchangeRate);

    if (!exchangeRate || exchangeRate <= 0) {
      console.error(
        "CRON_PRICE_UPDATE: Invalid dollar rate received:",
        exchangeRate,
      );
      return NextResponse.json(
        { error: "No se pudo obtener la cotización del dólar" },
        { status: 500 },
      );
    }

    // 2. Fetch all Plans and update their ARS price based on USD price
    const plans = await prisma.plan.findMany();
    let planUpdates = 0;
    console.log(
      `CRON: Se encontraron ${plans.length} planes. Iniciando actualización...`,
    );

    for (const plan of plans) {
      if (plan.precioUSD && Number(plan.precioUSD) > 0) {
        const newPlanPriceARS = Number(
          (Number(plan.precioUSD) * exchangeRate).toFixed(2),
        );
        if (Number(plan.precioARS) !== newPlanPriceARS) {
          await prisma.plan.update({
            where: { id: plan.id },
            data: { precioARS: newPlanPriceARS },
          });
          planUpdates++;
          console.log(
            `CRON: Plan ${plan.nombre} (ID: ${plan.id}) actualizado a ARS ${newPlanPriceARS}`,
          );
        }
      }
    }
    console.log(
      `CRON: Se actualizaron ${planUpdates} planes en la Base de Datos.`,
    );

    // 3. Fetch all active subscriptions with MP Preapproval IDs
    const activeSubscribers = await prisma.subscription.findMany({
      where: {
        status: "ACTIVO",
        provider: "MERCADOPAGO",
        mpPreapprovalId: {
          not: null,
        },
      },
      include: {
        plan: true,
      },
    });

    let updatedCount = 0;
    const errors = [];

    // 3. Iterate and calculate new price
    for (const sub of activeSubscribers) {
      try {
        if (!sub.mpPreapprovalId || !sub.plan || !sub.plan.precioUSD) continue;

        const newPriceARS = Number(
          (Number(sub.plan.precioUSD) * exchangeRate).toFixed(2),
        );

        // 4. Update the subscription price in Mercado Pago
        await updateMercadoPagoSubscriptionPrice(
          sub.mpPreapprovalId,
          newPriceARS,
        );

        updatedCount++;
      } catch (err: unknown) {
        console.error(`Error updating subscription ${sub.id}:`, err);
        errors.push({
          subscriptionId: sub.id,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    return NextResponse.json({
      success: true,
      dollarRateUsed: exchangeRate,
      plansUpdated: planUpdates,
      processed: activeSubscribers.length,
      updated: updatedCount,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    console.error("SUBSCRIPTION_PRICE_UPDATE_CRON_ERROR:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
