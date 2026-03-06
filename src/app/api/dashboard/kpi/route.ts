/* eslint-disable */
// @ts-nocheck
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/requireAuth";

import { startOfDay, startOfWeek, startOfMonth } from "date-fns";

type Period = "today" | "week" | "month" | "all";

function getPeriodStart(period: Period) {
  const now = new Date();
  if (period === "all") return undefined;

  if (period === "today") return startOfDay(now);
  if (period === "week") return startOfWeek(now, { weekStartsOn: 1 }); // Comienza Lunes
  if (period === "month") return startOfMonth(now);

  return undefined;
}

export async function GET(req: Request) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.res;

  const { searchParams } = new URL(req.url);
  const period = (searchParams.get("period") as Period) ?? "month";

  const sucursalId = auth.activeSucursalId;
  const isAdmin = auth.user.rol === "ADMIN";

  // Usamos la nueva utilidad centralizada
  const { getDashboardKpis } = await import("@/lib/kpi-logic");
  const stats = await getDashboardKpis(sucursalId, period, isAdmin);

  return NextResponse.json({
    data: {
      period,
      isGlobal: stats.isGlobal,
      usarControlDeCaja: stats.usarControlDeCaja,
      consignaciones: {
        total: stats.counts,
        abiertas: stats.counts,
        cerradas: 0,
        creadasEnPeriodo: stats.counts,
      },
      consignacionUnits: {
        pendientes: 0,
      },
      stock: {
        disponibleUnits: stats.stock.disponible,
        consignadoUnits: stats.stock.consignado,
        totalUnits: stats.stock.disponible + stats.stock.consignado,
      },
      finanzas: {
        ventas: {
          cantidad: stats.finanzas.ventas.cantidad,
          total: stats.finanzas.ventas.total,
          soloVenta: stats.finanzas.ventas.porTipo["CASUAL"] || 0,
          soloConsig: stats.finanzas.ventas.porTipo["LIQUIDACION"] || 0,
        },
        pagos: {
          cantidad: stats.finanzas.pagos.cantidad,
          total: stats.finanzas.pagos.total,
          soloVenta: stats.finanzas.pagos.porTipo["VENTA"] || 0,
          soloDeuda: stats.finanzas.pagos.porTipo["DEUDA"] || 0,
        },
        ganancia: {
          total: stats.finanzas.ganancia.neta,
          bruta: stats.finanzas.ganancia.bruta,
          neta: stats.finanzas.ganancia.neta,
          gastos: stats.finanzas.ganancia.gastos,
          porConsignacion: stats.finanzas.ganancia.porConsig,
          porVentaDirecta: stats.finanzas.ganancia.porPos,
        },
        saldoClientesTotal: stats.finanzas.saldoClientesTotal,
        clientes: 0,
      },
      gastos: {
        cantidad: stats.gastos.cantidad,
        total: stats.gastos.total,
      },
      proximosVencimientos: stats.proximosVencimientos
    },
  });
}
