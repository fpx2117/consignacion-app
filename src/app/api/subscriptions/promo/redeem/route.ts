import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth/require-auth";
import { seedPlanLimits } from "@/lib/subscriptions/require-subscription";
import { EstadoSuscripcion, ProveedorSuscripcion } from "@prisma/client";

type RedeemPromoBody = {
  code?: string;
};

export async function POST(req: Request) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.res;

  const userId = parseInt(auth.user.sub);

  try {
    const body = (await req.json().catch(() => null)) as RedeemPromoBody | null;
    const code = body?.code?.trim()?.toUpperCase();

    if (!code) {
      return NextResponse.json(
        { error: "El código es requerido." },
        { status: 400 },
      );
    }

    // 1. Buscar el código
    const promo = await prisma.promoCode.findUnique({
      where: { code },
      include: { plan: true },
    });

    if (!promo || !promo.activo) {
      return NextResponse.json(
        { error: "Código inválido o expirado." },
        { status: 404 },
      );
    }

    // 2. Validar usos
    if (promo.usedCount >= promo.maxUses) {
      return NextResponse.json(
        { error: "Este código ya alcanzó el máximo de usos." },
        { status: 410 },
      );
    }

    // 3. Validar fecha de expiración
    if (promo.expiresAt && new Date() > promo.expiresAt) {
      return NextResponse.json(
        { error: "Este código ha expirado." },
        { status: 410 },
      );
    }

    // 4. Verificar que no haya otra suscripción activa (cualquier estado)
    //    La restricción @unique en Subscription.userId impide tener más de una fila,
    //    así que si hay una suscripción cancelada/vencida debemos eliminarla primero.
    const existing = await prisma.subscription.findFirst({
      where: { userId },
    });

    if (existing) {
      if (
        existing.status === EstadoSuscripcion.ACTIVO ||
        existing.status === EstadoSuscripcion.PRUEBA
      ) {
        return NextResponse.json(
          {
            error:
              "Ya tenés una suscripción activa. No podés canjear un código ahora.",
          },
          { status: 409 },
        );
      }
      // Si está CANCELADO / VENCIDO / ATRASADO / INCOMPLETO →
      // se eliminará dentro de la transacción antes de crear la nueva.
    }

    // 5. Crear suscripción con trial
    const trialEndsAt = new Date();
    trialEndsAt.setDate(trialEndsAt.getDate() + promo.durationDays);

    const subscription = await prisma.$transaction(async (tx) => {
      // Eliminar suscripción vieja (cancelada/vencida) si existe
      //    Usamos deleteMany para tolerar condiciones de carrera: si otro request
      //    ya la borró, no queremos que falle la transacción.
      if (existing) {
        await tx.subscription.deleteMany({
          where: { userId, id: existing.id },
        });
      }

      // Incrementar uso del código
      await tx.promoCode.update({
        where: { id: promo.id },
        data: { usedCount: { increment: 1 } },
      });

      // Crear suscripción
      return tx.subscription.create({
        data: {
          userId,
          planId: promo.planId,
          status: EstadoSuscripcion.PRUEBA,
          provider: ProveedorSuscripcion.PROMO,
          externalId: `PROMO-${code}-${userId}-${Date.now()}`,
          trialEndsAt,
        },
        include: { plan: true },
      });
    });

    // 6. Auto-seed de límites del plan
    await seedPlanLimits(promo.planId);

    return NextResponse.json({
      ok: true,
      data: {
        planNombre: subscription.plan.nombre,
        trialEndsAt: subscription.trialEndsAt,
        durationDays: promo.durationDays,
      },
      message: `¡Código canjeado! Tenés ${promo.durationDays} días de ${subscription.plan.nombre} gratis.`,
    });
  } catch (error) {
    console.error("PROMO_REDEEM_ERROR:", error);
    return NextResponse.json(
      { error: "Error interno al canjear el código." },
      { status: 500 },
    );
  }
}
