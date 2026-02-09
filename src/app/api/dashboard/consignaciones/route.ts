import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/requireAuth";

export async function GET(req: Request) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.res;

  const { searchParams } = new URL(req.url);
  const limit = Math.min(Number(searchParams.get("limit") ?? 10) || 10, 50);

  // Traemos consignaciones ABIERTAS con detalles + cliente
  const abiertas = await prisma.consignacion.findMany({
    where: { estado: "ABIERTA" },
    orderBy: { fecha: "asc" }, // más viejas primero
    include: {
      cliente: true,
      detalles: { include: { producto: true } },
    },
  });

  // Calculamos units pendientes por consignación
  const conPendientes = abiertas
    .map((c) => {
      const pendientes = c.detalles.reduce((acc, d) => {
        const p = d.unitsEntregadas - d.unitsVendidasAcum - d.unitsDevueltasAcum;
        return acc + p;
      }, 0);

      return {
        ...c,
        unitsPendientes: pendientes,
      };
    })
    .sort((a, b) => b.unitsPendientes - a.unitsPendientes) // más pendientes arriba
    .slice(0, limit);

  // Últimas consignaciones (creadas)
  const ultimasConsignaciones = await prisma.consignacion.findMany({
    orderBy: { id: "desc" },
    take: limit,
    include: {
      cliente: true,
      detalles: { include: { producto: true } },
    },
  });

  // Últimas liquidaciones (para ver actividad)
  const ultimasLiquidaciones = await prisma.liquidacion.findMany({
    orderBy: { id: "desc" },
    take: limit,
    include: {
      consignacion: { include: { cliente: true } },
      items: { include: { detalle: { include: { producto: true } } } },
      venta: true,
    },
  });

  return NextResponse.json({
    data: {
      pendientesPrioridad: conPendientes,
      ultimasConsignaciones,
      ultimasLiquidaciones,
    },
  });
}
