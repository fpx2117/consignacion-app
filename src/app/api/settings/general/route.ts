import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/requireAuth";

// GET: Obtener la configuración actual
export async function GET() {
    const auth = await requireAuth();
    if (!auth.ok) return auth.res;

    try {
        const config = await prisma.configuracion.findUnique({
            where: { sucursalId: auth.activeSucursalId },
        });
        return NextResponse.json({ data: config });
    } catch (error: any) {
        return NextResponse.json({ error: "Error al obtener la configuración" }, { status: 500 });
    }
}

// PUT o PATCH: Actualizar la configuración
export async function PUT(req: Request) {
    const auth = await requireAuth();
    if (!auth.ok) return auth.res;

    try {
        const body = await req.json();

        const {
            minStockGlobal,
            diasAnticipacionVencimiento,
            notificarVencimientos,
            notificarStockBajo,
            notificarVentas,
            notificarLiquidaciones,
            notificarConsignacionesActivas,
            diasAvisoConsignacion,
            usarControlDeCaja
        } = body;

        const configActualizada = await prisma.configuracion.upsert({
            where: { sucursalId: auth.activeSucursalId },
            update: {
                ...(minStockGlobal !== undefined && { minStockGlobal }),
                ...(diasAnticipacionVencimiento !== undefined && { diasAnticipacionVencimiento }),
                ...(notificarVencimientos !== undefined && { notificarVencimientos }),
                ...(notificarStockBajo !== undefined && { notificarStockBajo }),
                ...(notificarVentas !== undefined && { notificarVentas }),
                ...(notificarLiquidaciones !== undefined && { notificarLiquidaciones }),
                ...(notificarConsignacionesActivas !== undefined && { notificarConsignacionesActivas }),
                ...(diasAvisoConsignacion !== undefined && { diasAvisoConsignacion }),
                ...(usarControlDeCaja !== undefined && { usarControlDeCaja }),
            },
            create: {
                sucursalId: auth.activeSucursalId,
                minStockGlobal: minStockGlobal ?? 5,
                diasAnticipacionVencimiento: diasAnticipacionVencimiento ?? 7,
                notificarVencimientos: notificarVencimientos ?? true,
                notificarStockBajo: notificarStockBajo ?? true,
                notificarVentas: notificarVentas ?? true,
                notificarLiquidaciones: notificarLiquidaciones ?? true,
                notificarConsignacionesActivas: notificarConsignacionesActivas ?? true,
                diasAvisoConsignacion: diasAvisoConsignacion ?? 15,
                usarControlDeCaja: usarControlDeCaja ?? true,
            }
        });

        return NextResponse.json({ data: configActualizada, message: "Configuración actualizada" });
    } catch (error: any) {
        console.error("Error actualizando configuración:", error);
        return NextResponse.json({ error: "Error al actualizar la configuración" }, { status: 500 });
    }
}
