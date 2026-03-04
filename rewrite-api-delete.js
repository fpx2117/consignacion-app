const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, 'src', 'app', 'api', 'categorias', '[id]', 'route.ts');
const content = `/* eslint-disable */
// @ts-nocheck
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
    const { nombre, color, descuentos } = body;

    const data: Record<string, any> = {};
    if (nombre) data.nombre = nombre.trim();
    if (color) data.color = color;
    if (descuentos !== undefined) data.descuentos = descuentos;

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

    // Set categoriaId to null for all associated products
    await prisma.producto.updateMany({
      where: { categoriaId: categoriaId },
      data: { categoriaId: null },
    });

    // Delete the category
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
`;

fs.writeFileSync(file, content);
console.log("API file overwritten");
