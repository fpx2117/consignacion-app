import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const categoriaId = Number(id);

    // Verificamos si hay productos vinculados antes de borrar
    const productosVinculados = await prisma.producto.count({
      where: { categoriaId: categoriaId },
    });

    if (productosVinculados > 0) {
      return NextResponse.json(
        { error: "No se puede eliminar: hay productos usando esta categoría" },
        { status: 400 }
      );
    }

    await prisma.categoria.delete({
      where: { id: categoriaId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: "Error al eliminar la categoría" },
      { status: 500 }
    );
  }
}