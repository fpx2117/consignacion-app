/* eslint-disable */
// @ts-nocheck
// src/app/api/setup/validate-promo/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
    try {
        const { code, planId } = await req.json();

        if (!code) {
            return NextResponse.json({ error: "Código requerido" }, { status: 400 });
        }

        const promo = await (prisma as any).promoCode.findUnique({
            where: { code: code.toUpperCase() },
            include: { plan: true }
        });

        if (!promo || !promo.activo) {
            return NextResponse.json({ error: "Código inválido o expirado" }, { status: 400 });
        }

        if (promo.usedCount >= promo.maxUses) {
            return NextResponse.json({ error: "Código agotado" }, { status: 400 });
        }

        if (promo.expiresAt && new Date() > promo.expiresAt) {
            return NextResponse.json({ error: "Código expirado" }, { status: 400 });
        }

        // Plan compatibility check removed to allow license to override selection

        return NextResponse.json({
            valid: true,
            discountPercentage: 100,
            planId: promo.planId,
            planName: promo.plan.nombre,
            durationDays: promo.durationDays
        });

    } catch (error: any) {
        console.error("VALIDATE_PROMO_ERROR:", error);
        return NextResponse.json({ error: "Error de servidor" }, { status: 500 });
    }
}
