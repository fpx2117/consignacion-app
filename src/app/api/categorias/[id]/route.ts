import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth/require-auth";
import { isGlobalSucursalView } from "@/lib/security/sucursalScope";

// PATCH: Actualizar nombre y/o color de una categoría
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  // Auth: Requiere usuario autenticado
  const auth = await requireAuth();
  if (!auth.ok) return auth.res;
  if (isGlobalSucursalView(auth)) {
    return NextResponse.json(
      {
        error:
          "Vista global en modo solo lectura. Selecciona una sucursal para editar categorías.",
      },
      { status: 409 },
    );
  }

  try {
    const { id } = await params;
    const categoriaId = Number(id);
    const body = await req.json();
    const { nombre, color } = body;

    const data: { nombre?: string; color?: string } = {};
    if (nombre) data.nombre = String(nombre).trim();
    if (color) data.color = String(color);

    if (Object.keys(data).length === 0) {
      return NextResponse.json(
        { error: "No hay datos para actualizar" },
        { status: 400 },
      );
    }

    // Verificar pertenencia a la sucursal activa
    const existing = await prisma.categoria.findUnique({
      where: { id: categoriaId },
    });
    if (!existing || existing.sucursalId !== auth.activeSucursalId) {
      return NextResponse.json(
        { error: "Categoría no encontrada" },
        { status: 404 },
      );
    }

    const updated = await prisma.categoria.update({
      where: { id: categoriaId },
      data,
    });

    return NextResponse.json(updated);
  } catch {
    return NextResponse.json(
      { error: "Error al actualizar la categoría" },
      { status: 500 },
    );
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  // Auth: Requiere usuario autenticado
  const auth = await requireAuth();
  if (!auth.ok) return auth.res;
  if (isGlobalSucursalView(auth)) {
    return NextResponse.json(
      {
        error:
          "Vista global en modo solo lectura. Selecciona una sucursal para eliminar categorías.",
      },
      { status: 409 },
    );
  }

  try {
    const { id } = await params;
    const categoriaId = Number(id);

    // Verificar pertenencia a la sucursal activa
    const existing = await prisma.categoria.findUnique({
      where: { id: categoriaId },
    });
    if (!existing || existing.sucursalId !== auth.activeSucursalId) {
      return NextResponse.json(
        { error: "Categoría no encontrada" },
        { status: 404 },
      );
    }

    // Desasociar productos antes de eliminar
    await prisma.producto.updateMany({
      where: { categoriaId: categoriaId },
      data: { categoriaId: null },
    });

    await prisma.categoria.delete({
      where: { id: categoriaId },
    });

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { error: "Error al eliminar la categoría" },
      { status: 500 },
    );
  }
}
