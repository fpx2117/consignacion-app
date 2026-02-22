import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// PATCH: Actualizar nombre y/o color de una categoría
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const categoriaId = Number(id);
    const body = await req.json();
    const { nombre, color } = body;

    const data: Record<string, string> = {};
    if (nombre) data.nombre = nombre.trim();
    if (color) data.color = color;

    if (Object.keys(data).length === 0) {
      return NextResponse.json(
        { error: "No hay datos para actualizar" },
        { status: 400 }
      );
    }

    const updated = await prisma.categoria.update({
      where: { id: categoriaId },
      data,
    });

    return NextResponse.json(updated);
  } catch (error) {
    return NextResponse.json(
      { error: "Error al actualizar la categoría" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const categoriaId = Number(id);

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