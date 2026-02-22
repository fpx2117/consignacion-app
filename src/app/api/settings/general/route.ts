import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/requireAuth";

// GET: Obtener la configuración actual
export async function GET() {
    const auth = await requireAuth();
    if (!auth.ok) return auth.res;

    try {
        const config = await prisma.configuracion.findUnique({
            where: { id: 1 },
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

    // Opcional: Validar que el usuario sea ADMIN si lo deseas
    // if (auth.user.rol !== "ADMIN") return NextResponse.json({ error: "No autorizado" }, { status: 403 });

    try {
        const body = await req.json();

        // Extraemos todos los campos posibles de la configuración
        const {
            minStockGlobal,
            diasAnticipacionVencimiento,
            notificarVencimientos,
            notificarStockBajo,
            notificarVentas,
            usarControlDeCaja // <--- Nuestro nuevo campo estrella
        } = body;

        // Actualizamos el registro único (id: 1)
        const configActualizada = await prisma.configuracion.upsert({
            where: { id: 1 },
            update: {
                ...(minStockGlobal !== undefined && { minStockGlobal }),
                ...(diasAnticipacionVencimiento !== undefined && { diasAnticipacionVencimiento }),
                ...(notificarVencimientos !== undefined && { notificarVencimientos }),
                ...(notificarStockBajo !== undefined && { notificarStockBajo }),
                ...(notificarVentas !== undefined && { notificarVentas }),
                ...(usarControlDeCaja !== undefined && { usarControlDeCaja }),
            },
            create: {
                id: 1,
                minStockGlobal: minStockGlobal ?? 5,
                diasAnticipacionVencimiento: diasAnticipacionVencimiento ?? 7,
                notificarVencimientos: notificarVencimientos ?? true,
                notificarStockBajo: notificarStockBajo ?? true,
                notificarVentas: notificarVentas ?? true,
                usarControlDeCaja: usarControlDeCaja ?? true,
            }
        });

        return NextResponse.json({ data: configActualizada, message: "Configuración actualizada" });
    } catch (error: any) {
        console.error("Error actualizando configuración:", error);
        return NextResponse.json({ error: "Error al actualizar la configuración" }, { status: 500 });
    }
}