import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const mes = parseInt(searchParams.get("mes") || String(new Date().getMonth()));
    const anio = parseInt(searchParams.get("anio") || "2026");

    const fechaInicio = new Date(anio, mes, 1);
    const fechaFin = new Date(anio, mes + 1, 0, 23, 59, 59);

    const movimientos = await prisma.movimientoStock.findMany({
      where: {
        createdAt: { gte: fechaInicio, lte: fechaFin },
      },
      include: {
        producto: {
          select: { nombre: true, codigoBarra: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(movimientos);
  } catch (error) {
    return NextResponse.json({ error: "Error al obtener historial" }, { status: 500 });
  }
}