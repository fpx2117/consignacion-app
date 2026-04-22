import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth/require-auth";
import { isGlobalSucursalView } from "@/lib/sucursalScope";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Auth: Requiere usuario autenticado
  const auth = await requireAuth();
  if (!auth.ok) return auth.res;
  if (isGlobalSucursalView(auth)) {
    return NextResponse.json({ error: "Vista global en modo solo lectura. Selecciona una sucursal para editar subcategorías." }, { status: 409 });
  }

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

    // Invalidar caché del catálogo público (los descuentos por tiers afectan la tienda)
    revalidateTag("public-catalog", "default");

    return NextResponse.json(subcategoria);
  } catch {
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
  if (isGlobalSucursalView(auth)) {
    return NextResponse.json({ error: "Vista global en modo solo lectura. Selecciona una sucursal para eliminar subcategorías." }, { status: 409 });
  }

  try {
    const { id: rawId } = await params;
    const id = parseInt(rawId, 10);

    await prisma.subcategoria.delete({
      where: { id },
    });

    // Invalidar caché del catálogo público tras eliminar subcategoría
    revalidateTag("public-catalog", "default");

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Delete subcategory error:", err);
    return NextResponse.json(
      { error: "Error al eliminar la subcategoría" },
      { status: 500 }
    );
  }
}
