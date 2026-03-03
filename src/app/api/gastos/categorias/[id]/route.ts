import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/requireAuth";

export async function DELETE(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const auth = await requireAuth();
    if (!auth.ok) return auth.res;

    // Solo ADMIN puede eliminar categorías de gastos
    if (auth.user?.rol !== "ADMIN") {
        return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    try {
        const { id: idParam } = await params;
        const id = Number(idParam);

        if (!id) {
            return NextResponse.json(
                { error: "ID de categoría inválido" },
                { status: 400 }
            );
        }

        // Verificar si la categoría pertenece a la sucursal activa
        const categoria = await prisma.categoriaGasto.findUnique({
            where: { id },
        });

        if (!categoria) {
            return NextResponse.json(
                { error: "Categoría no encontrada" },
                { status: 404 }
            );
        }

        if (categoria.sucursalId !== auth.activeSucursalId) {
            return NextResponse.json(
                { error: "No autorizado para esta sucursal" },
                { status: 403 }
            );
        }

        // Verificar si hay gastos asociados (opcional, podrías hacer cascada o denegar)
        const gastosAsociados = await prisma.gasto.count({
            where: { categoriaGastoId: id },
        });

        if (gastosAsociados > 0) {
            return NextResponse.json(
                { error: "No se puede eliminar una categoría que tiene gastos asociados. Elimina o reasigna los gastos primero." },
                { status: 400 }
            );
        }

        await prisma.categoriaGasto.delete({
            where: { id },
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("DELETE CATEGORIA ERROR:", error);
        return NextResponse.json(
            { error: "Error al eliminar la categoría" },
            { status: 500 }
        );
    }
}
