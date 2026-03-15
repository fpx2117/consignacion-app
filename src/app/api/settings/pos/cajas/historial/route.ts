import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, requireRole } from "@/lib/auth/require-auth";

export async function GET() {
  const auth = await requireAuth();
  if (!auth.ok) return auth.res;

  if (!requireRole(auth.user, ["ADMIN"])) {
    return NextResponse.json({ error: "No tienes permisos para ver el historial." }, { status: 403 });
  }

  try {
    const historial = await prisma.sesionCaja.findMany({
      where: { caja: { sucursalId: auth.activeSucursalId } },
      orderBy: { fechaApertura: "desc" },
      include: {
        usuario: { select: { nombre: true } },
        caja: { select: { nombre: true } },
      },
      take: 100,
    });

    return NextResponse.json({ data: historial });
  } catch (error) {
    console.error("Error al obtener historial de cajas:", error);
    return NextResponse.json({ error: "Error al obtener el historial de cajas" }, { status: 500 });
  }
}
