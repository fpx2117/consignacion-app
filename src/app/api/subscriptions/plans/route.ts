import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  SUBSCRIPTION_PLANS,
  PLAN_LIMITS_DEFAULTS,
} from "@/constants/subscriptions";
import { fetchDolarBlue } from "@/lib/integrations/dolarBlue";

export async function GET() {
  try {
    let plans = await prisma.plan.findMany({
      orderBy: { id: "asc" },
    });

    // SELF-HEALING: Auto-seed planes en caso de clientes que ya tenían la app funcionando desde antes
    // y se saltaron la pantalla inicial de /setup.
    if (plans.length === 0) {
      const exchangeRate = await fetchDolarBlue();

      await prisma.$transaction(async (tx) => {
        for (const p of SUBSCRIPTION_PLANS) {
          const calculatedPrecioARS = p.precioUSD * exchangeRate;

          await tx.plan.upsert({
            where: { id: p.id },
            update: {}, // No sobreescribir aleatoriamente
            create: {
              id: p.id,
              nombre: p.nombre,
              descripcion: p.descripcion,
              precioARS: calculatedPrecioARS,
              precioUSD: p.precioUSD,
              mercadopagoId: p.mercadopagoId,
              paypalId: p.paypalId,
            },
          });

          const limits = PLAN_LIMITS_DEFAULTS[p.id];
          if (limits) {
            await tx.planLimit.upsert({
              where: { planId: p.id },
              update: {},
              create: {
                planId: p.id,
                maxProductos: limits.maxProductos,
                maxUsuarios: limits.maxUsuarios,
                allowConsignaciones: limits.allowConsignaciones,
                allowSucursales: limits.allowSucursales,
              },
            });
          }
        }
      });

      // Re-fetch luego del seed
      plans = await prisma.plan.findMany({
        orderBy: { id: "asc" },
      });
    }

    return NextResponse.json({ plans });
  } catch (error) {
    console.error("Error fetching/seeding plans:", error);
    return NextResponse.json(
      { error: "No se pudieron obtener los planes" },
      { status: 500 },
    );
  }
}
