import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth/require-auth";
import { getIncludedGlobalSucursalIds } from "@/lib/dashboard/kpi-logic";

export async function GET(req: Request) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.res;

  const { searchParams } = new URL(req.url);
  const limit = Math.min(Number(searchParams.get("limit") ?? 10) || 10, 50);
  const sucursalId = auth.activeSucursalId;
  const isGlobal = auth.user.rol === "ADMIN" && sucursalId === 0;
  const includedGlobalIds = isGlobal ? await getIncludedGlobalSucursalIds() : [];
  const sucursalWhere = isGlobal ? { sucursalId: { in: includedGlobalIds } } : { sucursalId };

  // Traemos consignaciones ABIERTAS con detalles + cliente
  const abiertas = await prisma.consignacion.findMany({
    where: { estado: "ABIERTA", ...sucursalWhere },
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
    where: sucursalWhere,
    orderBy: { id: "desc" },
    take: limit,
    include: {
      cliente: true,
      detalles: { include: { producto: true } },
    },
  });

  // Últimas liquidaciones (para ver actividad)
  const ultimasLiquidaciones = await prisma.liquidacion.findMany({
    where: { consignacion: sucursalWhere },
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
