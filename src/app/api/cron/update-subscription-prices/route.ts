import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { fetchDolarBlue } from "@/lib/dolarBlue";
import { updateMercadoPagoSubscriptionPrice } from "@/lib/mercadopago";

export async function GET(request: Request) {
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    try {
        // 1. Get the current dollar blue rate
        const exchangeRate = await fetchDolarBlue();

        if (!exchangeRate || exchangeRate <= 0) {
            console.error("CRON_PRICE_UPDATE: Invalid dollar rate received:", exchangeRate);
            return NextResponse.json({ error: "No se pudo obtener la cotización del dólar" }, { status: 500 });
        }

        // 2. Fetch all Plans and update their ARS price based on USD price
        const plans = await prisma.plan.findMany();
        let planUpdates = 0;
        for (const plan of plans) {
            if (plan.precioUSD && Number(plan.precioUSD) > 0) {
                const newPlanPriceARS = Number((Number(plan.precioUSD) * exchangeRate).toFixed(2));
                if (Number(plan.precioARS) !== newPlanPriceARS) {
                    await prisma.plan.update({
                        where: { id: plan.id },
                        data: { precioARS: newPlanPriceARS }
                    });
                    planUpdates++;
                }
            }
        }

        // 3. Fetch all active subscriptions with MP Preapproval IDs
        const activeSubscribers = await prisma.subscription.findMany({
            where: {
                status: "ACTIVO",
                provider: "MERCADOPAGO",
                mpPreapprovalId: {
                    not: null
                }
            },
            include: {
                plan: true
            }
        });

        let updatedCount = 0;
        let errors = [];

        // 3. Iterate and calculate new price
        for (const sub of activeSubscribers) {
            try {
                if (!sub.mpPreapprovalId || !sub.plan || !sub.plan.precioUSD) continue;

                const newPriceARS = Number((Number(sub.plan.precioUSD) * exchangeRate).toFixed(2));

                // 4. Update the subscription price in Mercado Pago
                await updateMercadoPagoSubscriptionPrice(sub.mpPreapprovalId, newPriceARS);

                updatedCount++;
            } catch (err: any) {
                console.error(`Error updating subscription ${sub.id}:`, err);
                errors.push({ subscriptionId: sub.id, error: err.message });
            }
        }

        return NextResponse.json({
            success: true,
            dollarRateUsed: exchangeRate,
            plansUpdated: planUpdates,
            processed: activeSubscribers.length,
            updated: updatedCount,
            errors: errors.length > 0 ? errors : undefined
        });

    } catch (error) {
        console.error("SUBSCRIPTION_PRICE_UPDATE_CRON_ERROR:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
