import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth/require-auth";

type RouteParams = { params: Promise<{ code: string }> };

export async function GET(_: Request, { params }: RouteParams) {
  try {
    const auth = await requireAuth();
    if (!auth.ok) return auth.res;

    const { code } = await params;

    if (!code) {
      return NextResponse.json(
        { error: "Código no proporcionado" },
        { status: 400 },
      );
    }

    const producto = await prisma.producto.findFirst({
      where: {
        codigoBarra: code,
        sucursalId: auth.activeSucursalId,
        activo: true, // Solo productos vigentes
      },
      include: {
        categoria: true,
      },
    });

    if (!producto) {
      return NextResponse.json(
        { error: "Producto no encontrado" },
        { status: 404 },
      );
    }

    return NextResponse.json({ data: producto });
  } catch (error) {
    console.error("Error en búsqueda por barcode:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
