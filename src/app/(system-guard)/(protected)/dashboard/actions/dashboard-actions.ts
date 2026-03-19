"use server";

import { requireAuth } from "@/lib/auth/require-auth";
import { getDashboardKpis, getDashboardTopProductos, getDashboardTopConsignados, getDashboardTendencia } from "@/lib/kpi-logic";
import { prisma } from "@/lib/prisma";
import { resolveRequestedSucursalId } from "@/lib/sucursalScope";
import type {
  DashboardPeriod,
  DashboardKpis,
  DashboardConsignacionesResponse,
  DashboardTopProductos,
  DashboardTendencia,
} from "@/lib/types";

/** Lanza UnauthorizedError si la sesión no es válida */
class UnauthorizedError extends Error {
  constructor() {
    super("No autorizado");
    this.name = "UnauthorizedError";
  }
}

// ---------------------------------------------------------------------------
// KPIs
// ---------------------------------------------------------------------------

/**
 * Server Action — reemplaza apiService.getDashboardKpis(period).
 * Llama directamente a getDashboardKpis() de kpi-logic (con unstable_cache).
 */
export async function fetchDashboardKpis(
  period: DashboardPeriod = "month",
  requestedSucursalId?: number
): Promise<DashboardKpis> {
  const auth = await requireAuth();
  if (!auth.ok) throw new UnauthorizedError();

  const { user } = auth;
  const isAdmin = user.rol === "ADMIN";
  const scopedSucursalId = resolveRequestedSucursalId(auth, requestedSucursalId);
  const userId = Number(user.sub);
  const stats = await getDashboardKpis(scopedSucursalId, period, isAdmin, Number.isFinite(userId) ? userId : undefined);

  return {
    period,
    usarControlDeCaja: stats.usarControlDeCaja,
    consignaciones: {
      total: stats.countEnPeriodo,
      abiertas: stats.countAbiertas,
      cerradas: 0,
      creadasEnPeriodo: stats.countEnPeriodo,
    },
    consignacionUnits: {
      entregadas: 0,
      vendidas: 0,
      devueltas: 0,
      pendientes: stats.consignacionUnits?.pendientes ?? 0,
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
        soloVenta: stats.finanzas.ventas.porTipo?.["CASUAL"] ?? 0,
        soloConsig: stats.finanzas.ventas.porTipo?.["LIQUIDACION"] ?? 0,
      },
      pagos: {
        cantidad: stats.finanzas.pagos.cantidad,
        total: stats.finanzas.pagos.total,
        soloVenta: stats.finanzas.pagos.porTipo?.["VENTA"] ?? 0,
        soloDeuda: stats.finanzas.pagos.porTipo?.["DEUDA"] ?? 0,
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
    catalogo: {
      visitas: stats.catalogo?.visitas ?? 0,
      visitantesUnicos: stats.catalogo?.visitantesUnicos ?? 0,
      productosVisibles: stats.catalogo?.productosVisibles ?? 0,
    },
    proximosVencimientos: stats.proximosVencimientos as unknown as DashboardKpis["proximosVencimientos"],
  };
}

// ---------------------------------------------------------------------------
// Consignaciones
// ---------------------------------------------------------------------------

/**
 * Server Action — reemplaza apiService.getDashboardConsignaciones(limit).
 * Consulta Prisma directamente sin pasar por HTTP.
 */
export async function fetchDashboardConsignaciones(
  limit: number = 5,
  requestedSucursalId?: number
): Promise<DashboardConsignacionesResponse> {
  const auth = await requireAuth();
  if (!auth.ok) throw new UnauthorizedError();

  const { user } = auth;
  const scopedSucursalId = resolveRequestedSucursalId(auth, requestedSucursalId);
  const safeLimit = Math.min(limit, 50);
  const isGlobal = user.rol === "ADMIN" && scopedSucursalId === 0;
  const sucursalWhere = isGlobal ? {} : { sucursalId: scopedSucursalId };

  const abiertas = await prisma.consignacion.findMany({
    where: { estado: "ABIERTA", ...sucursalWhere },
    orderBy: { fecha: "asc" },
    include: {
      cliente: true,
      detalles: { include: { producto: true } },
    },
  });

  const pendientesPrioridad = abiertas
    .map((c) => {
      const unitsPendientes = c.detalles.reduce((acc, d) => {
        return acc + (d.unitsEntregadas - d.unitsVendidasAcum - d.unitsDevueltasAcum);
      }, 0);
      return { ...c, unitsPendientes };
    })
    .sort((a, b) => b.unitsPendientes - a.unitsPendientes)
    .slice(0, safeLimit);

  const [ultimasConsignaciones, ultimasLiquidaciones] = await Promise.all([
    prisma.consignacion.findMany({
      where: sucursalWhere,
      orderBy: { id: "desc" },
      take: safeLimit,
      include: {
        cliente: true,
        detalles: { include: { producto: true } },
      },
    }),
    prisma.liquidacion.findMany({
      where: { consignacion: sucursalWhere },
      orderBy: { id: "desc" },
      take: safeLimit,
      include: {
        consignacion: { include: { cliente: true } },
        items: { include: { detalle: { include: { producto: true } } } },
        venta: true,
      },
    }),
  ]);

  return {
    pendientesPrioridad: pendientesPrioridad as unknown as DashboardConsignacionesResponse["pendientesPrioridad"],
    ultimasConsignaciones: ultimasConsignaciones as unknown as DashboardConsignacionesResponse["ultimasConsignaciones"],
    ultimasLiquidaciones: ultimasLiquidaciones as unknown as DashboardConsignacionesResponse["ultimasLiquidaciones"],
  };
}

// ---------------------------------------------------------------------------
// Top Productos
// ---------------------------------------------------------------------------

/**
 * Server Action — reemplaza apiService.getDashboardTopProductos(period, limit).
 * Llama directamente a getDashboardTopProductos() de kpi-logic.
 */
export async function fetchDashboardTopProductos(
  period: DashboardPeriod = "month",
  limit: number = 5,
  requestedSucursalId?: number
): Promise<DashboardTopProductos> {
  const auth = await requireAuth();
  if (!auth.ok) throw new UnauthorizedError();

  const { user } = auth;
  const isAdmin = user.rol === "ADMIN";
  const safeLimit = Math.min(limit, 50);
  const scopedSucursalId = resolveRequestedSucursalId(auth, requestedSucursalId);
  const userId = Number(user.sub);

  const [topVendidos, topConsignados] = await Promise.all([
    getDashboardTopProductos(scopedSucursalId, period, isAdmin, safeLimit, Number.isFinite(userId) ? userId : undefined),
    getDashboardTopConsignados(scopedSucursalId, period, isAdmin, safeLimit, Number.isFinite(userId) ? userId : undefined),
  ]);

  return {
    period,
    topVendidos,
    topConsignados,
  };
}

// ---------------------------------------------------------------------------
// Tendencia
// ---------------------------------------------------------------------------

/**
 * Server Action — reemplaza apiService.getDashboardTendencia(period).
 * Llama directamente a getDashboardTendencia() de kpi-logic.
 */
export async function fetchDashboardTendencia(
  period: Exclude<DashboardPeriod, "all"> = "month",
  requestedSucursalId?: number
): Promise<DashboardTendencia> {
  const auth = await requireAuth();
  if (!auth.ok) throw new UnauthorizedError();

  const { user } = auth;
  const isAdmin = user.rol === "ADMIN";
  const scopedSucursalId = resolveRequestedSucursalId(auth, requestedSucursalId);
  const userId = Number(user.sub);

  const data = await getDashboardTendencia(scopedSucursalId, period, isAdmin, Number.isFinite(userId) ? userId : undefined);

  const series = (data.series ?? []).map((point: {
    date?: string;
    ventasTotal?: number;
    ventasPosTotal?: number;
    ventasConsigTotal?: number;
    pagosTotal?: number;
  }) => ({
    date: point.date as string,
    consignaciones: 0,
    liquidaciones: 0,
    ventasCount: 0,
    ventasTotal: point.ventasTotal ?? 0,
    ventasPosTotal: point.ventasPosTotal ?? 0,
    ventasConsigTotal: point.ventasConsigTotal ?? 0,
    pagosCount: 0,
    pagosTotal: point.pagosTotal ?? 0,
  }));

  const from = series[0]?.date ?? new Date().toISOString().slice(0, 10);
  const to = series[series.length - 1]?.date ?? from;

  return { period, from, to, series };
}
