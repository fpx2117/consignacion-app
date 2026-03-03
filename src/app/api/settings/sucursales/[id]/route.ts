/* eslint-disable */
// @ts-nocheck
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/requireAuth";

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
    const auth = await requireAuth();
    if (!auth.ok) return auth.res;

    if ((auth.user as any).rol !== "ADMIN") {
        return NextResponse.json({ error: "Permisos insuficientes" }, { status: 403 });
    }

    try {
        const { id } = await params;
        const { nombre, activa } = await req.json();

        const sucursalId = parseInt(id, 10);
        if (isNaN(sucursalId)) return NextResponse.json({ error: "ID Inválido" }, { status: 400 });

        const existing = await prisma.sucursal.findUnique({ where: { id: sucursalId } });
        if (!existing) return NextResponse.json({ error: "Sucursal no encontrada" }, { status: 404 });

        // No se puede desactivar la principal
        if (existing.esPrincipal && activa === false) {
            return NextResponse.json({ error: "No se puede desactivar la Sede Principal." }, { status: 400 });
        }

        const updated = await prisma.sucursal.update({
            where: { id: sucursalId },
            data: {
                ...(nombre !== undefined ? { nombre: nombre.trim() } : {}),
                ...(activa !== undefined ? { activa } : {})
            }
        });

        return NextResponse.json({ data: updated });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
    const auth = await requireAuth();
    if (!auth.ok) return auth.res;

    if ((auth.user as any).rol !== "ADMIN") {
        return NextResponse.json({ error: "Permisos insuficientes" }, { status: 403 });
    }

    try {
        const { id } = await params;
        const sucursalId = parseInt(id, 10);
        if (isNaN(sucursalId)) return NextResponse.json({ error: "ID Inválido" }, { status: 400 });

        const existing = await prisma.sucursal.findUnique({
            where: { id: sucursalId },
            include: {
                _count: {
                    select: {
                        usuarios: true,
                        ventas: true,
                        consignaciones: true,
                        stockProductos: true
                    }
                }
            }
        });

        if (!existing) return NextResponse.json({ error: "Sucursal no encontrada" }, { status: 404 });

        // No se puede eliminar la principal
        if (existing.esPrincipal) {
            return NextResponse.json({ error: "La Sede Principal no puede ser eliminada." }, { status: 400 });
        }

        // Si tiene datos asociados, advertir al usuario que debe desactivarla en lugar de eliminarla
        const hasRelations = (existing as any)._count.usuarios > 0 ||
            (existing as any)._count.ventas > 0 ||
            (existing as any)._count.consignaciones > 0 ||
            (existing as any)._count.stockProductos > 0;

        if (hasRelations) {
            return NextResponse.json({
                error: "No se puede eliminar la sucursal porque tiene datos asociados (usuarios, ventas o stock). Te recomendamos desactivarla en su lugar."
            }, { status: 400 });
        }

        await prisma.sucursal.delete({ where: { id: sucursalId } });

        return NextResponse.json({ message: "Sucursal eliminada correctamente" });
    } catch (error: any) {
        return NextResponse.json({ error: "Error al eliminar la sucursal. Verifique que no tenga datos vinculados." }, { status: 500 });
    }
}
