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
