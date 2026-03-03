/* eslint-disable */
// @ts-nocheck
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/requireAuth";

export async function GET(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const auth = await requireAuth();
    if (!auth.ok) return auth.res;

    const { id } = await params;

    try {
        const gasto = await prisma.gasto.findUnique({
            where: { id: Number(id) },
            include: {
                categoria: true,
                user: {
                    select: { id: true, nombre: true }
                }
            }
        });

        if (!gasto || gasto.sucursalId !== auth.activeSucursalId) {
            return NextResponse.json({ error: "Gasto no encontrado" }, { status: 404 });
        }

        return NextResponse.json({ data: gasto });
    } catch (error) {
        return NextResponse.json(
            { error: "Error al obtener el gasto" },
            { status: 500 }
        );
    }
}

export async function PUT(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const auth = await requireAuth();
    if (!auth.ok) return auth.res;

    if (auth.user?.rol !== "ADMIN") {
        return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    const { id } = await params;

    try {
        const body = await req.json();
        const {
            monto,
            motivo,
            fecha,
            fechaVencimiento,
            estado,
            esRecurrente,
            frecuencia,
            categoriaGastoId
        } = body;

        const existing = await prisma.gasto.findUnique({
            where: { id: Number(id) }
        });

        if (!existing || existing.sucursalId !== auth.activeSucursalId) {
            return NextResponse.json({ error: "Gasto no encontrado" }, { status: 404 });
        }

        const updated = await prisma.gasto.update({
            where: { id: Number(id) },
            data: {
                ...(monto !== undefined && { monto: Number(monto) }),
                ...(motivo !== undefined && { motivo }),
                ...(fecha !== undefined && { fecha: new Date(fecha) }),
                ...(fechaVencimiento !== undefined && { fechaVencimiento: fechaVencimiento ? new Date(fechaVencimiento) : null }),
                ...(estado !== undefined && { estado }),
                ...(esRecurrente !== undefined && { esRecurrente: !!esRecurrente }),
                ...(frecuencia !== undefined && { frecuencia }),
                ...(categoriaGastoId !== undefined && { categoriaGastoId: Number(categoriaGastoId) }),
            },
            include: {
                categoria: true
            }
        });

        return NextResponse.json({ data: updated });
    } catch (error) {
        return NextResponse.json(
            { error: "Error al actualizar el gasto" },
            { status: 500 }
        );
    }
}

export async function DELETE(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const auth = await requireAuth();
    if (!auth.ok) return auth.res;

    if (auth.user?.rol !== "ADMIN") {
        return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    const { id } = await params;

    try {
        const existing = await prisma.gasto.findUnique({
            where: { id: Number(id) }
        });

        if (!existing || existing.sucursalId !== auth.activeSucursalId) {
            return NextResponse.json({ error: "Gasto no encontrado" }, { status: 404 });
        }

        await prisma.gasto.delete({
            where: { id: Number(id) }
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        return NextResponse.json(
            { error: "Error al eliminar el gasto" },
            { status: 500 }
        );
    }
}
