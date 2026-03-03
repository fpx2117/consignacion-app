/* eslint-disable */
// @ts-nocheck
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/requireAuth";

type Period = "today" | "week" | "month";

function getDays(period: Period) {
  if (period === "today") return 1;
  if (period === "week") return 7;
  return 30;
}

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export async function GET(req: Request) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.res;

  const { searchParams } = new URL(req.url);
  const period = (searchParams.get("period") as Period) ?? "month";
  const sucursalId = auth.activeSucursalId;

  const days = getDays(period);
  const end = startOfDay(new Date());
  const start = new Date(end);
  start.setDate(start.getDate() - (days - 1));

  // Traemos todo y agregamos por día en JS (simple y confiable para Postgres)
  const [consig, liq, ventas, pagos] = await Promise.all([
    prisma.consignacion.findMany({
      where: { fecha: { gte: start }, sucursalId },
      select: { fecha: true }
    }),
    prisma.liquidacion.findMany({
      where: {
        fecha: { gte: start },
        consignacion: { sucursalId }
      },
      select: { fecha: true }
    }),
    prisma.venta.findMany({
      where: { fecha: { gte: start }, sucursalId },
      select: { fecha: true, total: true }
    }),
    prisma.pago.findMany({
      where: {
        fecha: { gte: start },
        cliente: { sucursalId }
      },
      select: { fecha: true, monto: true }
    }),
  ]);

  const key = (d: Date) => startOfDay(d).toISOString().slice(0, 10);

  const base: Record<string, any> = {};
  for (let i = 0; i < days; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    const k = key(d);
    base[k] = {
      date: k,
      consignaciones: 0,
      liquidaciones: 0,
      ventasCount: 0,
      ventasTotal: 0,
      pagosCount: 0,
      pagosTotal: 0,
    };
  }

  for (const x of consig) base[key(x.fecha)].consignaciones += 1;
  for (const x of liq) base[key(x.fecha)].liquidaciones += 1;

  for (const x of ventas) {
    const row = base[key(x.fecha)];
    row.ventasCount += 1;
    row.ventasTotal += Number(x.total);
  }

  for (const x of pagos) {
    const row = base[key(x.fecha)];
    row.pagosCount += 1;
    row.pagosTotal += Number(x.monto);
  }

  return NextResponse.json({
    data: {
      period,
      from: start.toISOString(),
      to: end.toISOString(),
      series: Object.values(base),
    },
  });
}
