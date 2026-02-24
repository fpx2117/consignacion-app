import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/requireAuth";

type Period = "today" | "week" | "month" | "all";

function getPeriodStart(period: Period) {
  const now = new Date();
  if (period === "all") return null;

  const start = new Date(now);
  if (period === "today") {
    start.setHours(0, 0, 0, 0);
    return start;
  }
  if (period === "week") {
    start.setDate(start.getDate() - 6);
    start.setHours(0, 0, 0, 0);
    return start;
  }
  start.setDate(start.getDate() - 29);
  start.setHours(0, 0, 0, 0);
  return start;
}

export async function GET(req: Request) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.res;

  const { searchParams } = new URL(req.url);
  const period = (searchParams.get("period") as Period) ?? "month";
  const limit = Math.min(Number(searchParams.get("limit") ?? 10) || 10, 50);
  const start = getPeriodStart(period);
  const sucursalId = auth.activeSucursalId;

  const liquidacionWhere = start ? { fecha: { gte: start } } : {};

  // 1) Top vendidos (LiquidacionItem -> detalle -> producto)
  const items = await prisma.liquidacionItem.findMany({
    where: {
      liquidacion: {
        ...liquidacionWhere,
        consignacion: { sucursalId }
      }
    },
    select: {
      unitsVendidas: true,
      precioUnitario: true,
      detalle: { select: { productoId: true, producto: { select: { nombre: true } } } },
    },
  });

  const mapVendidos = new Map<number, { productoId: number; nombre: string; units: number; total: number }>();

  for (const it of items) {
    const productoId = it.detalle.productoId;
    const nombre = it.detalle.producto.nombre;
    const units = it.unitsVendidas ?? 0;
    const total = units * Number(it.precioUnitario);

    const prev = mapVendidos.get(productoId);
    if (!prev) {
      mapVendidos.set(productoId, { productoId, nombre, units, total });
    } else {
      prev.units += units;
      prev.total += total;
    }
  }

  const topVendidos = Array.from(mapVendidos.values())
    .sort((a, b) => b.units - a.units)
    .slice(0, limit);

  // 2) Top consignados (ConsignacionDetalle.unitsEntregadas)
  const detalles = await prisma.consignacionDetalle.findMany({
    select: {
      unitsEntregadas: true,
      productoId: true,
      producto: { select: { nombre: true } },
      consignacion: { select: { fecha: true } },
    },
    where: {
      consignacion: {
        ...(start ? { fecha: { gte: start } } : {}),
        sucursalId
      }
    },
  });

  const mapConsignados = new Map<number, { productoId: number; nombre: string; unitsEntregadas: number }>();

  for (const d of detalles) {
    const prev = mapConsignados.get(d.productoId);
    if (!prev) {
      mapConsignados.set(d.productoId, {
        productoId: d.productoId,
        nombre: d.producto.nombre,
        unitsEntregadas: d.unitsEntregadas,
      });
    } else {
      prev.unitsEntregadas += d.unitsEntregadas;
    }
  }

  const topConsignados = Array.from(mapConsignados.values())
    .sort((a, b) => b.unitsEntregadas - a.unitsEntregadas)
    .slice(0, limit);

  return NextResponse.json({
    data: { period, topVendidos, topConsignados },
  });
}
