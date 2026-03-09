import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/requireAuth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  // Auth: Requiere usuario autenticado
  const auth = await requireAuth();
  if (!auth.ok) return auth.res;

  try {
    const { searchParams } = new URL(req.url);

    const mesRaw = searchParams.get("mes");
    const anioRaw = searchParams.get("anio");

    // ✅ Mes esperado 0..11 (por defecto: mes actual)
    const mes = Number.parseInt(mesRaw ?? String(new Date().getMonth()), 10);
    const anio = Number.parseInt(anioRaw ?? "2026", 10);

    if (!Number.isFinite(mes) || mes < 0 || mes > 11) {
      return NextResponse.json({ error: "Mes inválido (debe ser 0..11)" }, { status: 400 });
    }
    if (!Number.isFinite(anio) || anio < 2000 || anio > 2100) {
      return NextResponse.json({ error: "Año inválido" }, { status: 400 });
    }

    const fechaInicio = new Date(anio, mes, 1, 0, 0, 0);
    const fechaFin = new Date(anio, mes + 1, 0, 23, 59, 59);

    const movimientos = await prisma.movimientoStock.findMany({
      where: { createdAt: { gte: fechaInicio, lte: fechaFin } },
      include: {
        producto: { select: { nombre: true, codigoBarra: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(movimientos);
  } catch (error) {
    console.error("HISTORIAL INVENTARIO API ERROR:", error);
    return NextResponse.json({ error: "Error al obtener historial" }, { status: 500 });
  }
}
