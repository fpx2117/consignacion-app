/* eslint-disable */
// @ts-nocheck
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/requireAuth";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Auth: Requiere usuario autenticado
  const auth = await requireAuth();
  if (!auth.ok) return auth.res;

  try {
    const { id: rawId } = await params;
    const id = parseInt(rawId, 10);
    const body = await req.json();
    const { nombre, descuentos } = body;

    if (!nombre) {
      return NextResponse.json(
        { error: "El nombre es obligatorio" },
        { status: 400 }
      );
    }

    const subcategoria = await prisma.subcategoria.update({
      where: { id },
      data: {
        nombre: nombre?.trim(),
        ...(descuentos !== undefined && { descuentos })
      },
    });

    return NextResponse.json(subcategoria);
  } catch (error) {
    return NextResponse.json(
      { error: "Error al actualizar la subcategoría" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Auth: Requiere usuario autenticado
  const auth = await requireAuth();
  if (!auth.ok) return auth.res;

  try {
    const { id: rawId } = await params;
    const id = parseInt(rawId, 10);

    await prisma.subcategoria.delete({
      where: { id },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Delete subcategory error:", error);
    return NextResponse.json(
      { error: "Error al eliminar la subcategoría" },
      { status: 500 }
    );
  }
}
