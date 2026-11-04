import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { differenceInDays } from "date-fns";
import {
  formatDateInputAR,
  nowAR,
  startOfMonthAR,
} from "@/lib/date-format/utils-date";
import { resolveTimezone } from "@/lib/timezone/get-configured-tz";
import type { DashboardDateRange, DashboardPeriod } from "../types";
import { resolveDashboardDateWhere } from "./date-range";
import { calculateGrossProfit } from "@/modules/finance/profit";

type CatalogVisitDelegate = {
  count: (args: { where: Record<string, unknown> }) => Promise<number>;
  groupBy: (args: {
    by: string[];
    where: Record<string, unknown>;
  }) => Promise<Array<{ visitorHash: string }>>;
};

type RoturaDetalle = {
  units: number;
  producto: {
    precioCosto: Prisma.Decimal | number | null;
  } | null;
};

type GastoLinkRecord = {
  montoProporcional: Prisma.Decimal | number;
};

type GastoPendienteRecord = Prisma.GastoGetPayload<{
  include: { categoria: true; sucursalesCompartidas: true };
}>;

type GastoCompartidoPendienteRecord = Prisma.GastoSucursalGetPayload<{
  include: { gasto: { include: { categoria: true } } };
}>;

const buildIncludedExpenseWhere = (
  baseWhere: Prisma.GastoWhereInput = {},
): Prisma.GastoWhereInput => ({
  ...baseWhere,
  OR: [{ estado: "PAGADO" }, { estado: "PENDIENTE", esRecurrente: true }],
});

const buildIncludedSharedExpenseWhere = (
  baseWhere: Prisma.GastoWhereInput = {},
): Prisma.GastoSucursalWhereInput => ({
  gasto: buildIncludedExpenseWhere(baseWhere),
});

/**
 * IDs de sucursales que optaron por participar en la vista "Todas las Sucursales"
 * del dashboard (Sucursal.incluidaEnDashboardGlobal). Se consulta solo cuando
 * isGlobal es true.
 */
export async function getIncludedGlobalSucursalIds(): Promise<number[]> {
  const rows = await prisma.sucursal.findMany({
    where: { incluidaEnDashboardGlobal: true },
    select: { id: true },
  });
  return rows.map((r) => r.id);
}

function getCatalogVisitDelegate(): CatalogVisitDelegate | null {
  return "catalogVisit" in prisma
    ? ((prisma as unknown as { catalogVisit?: CatalogVisitDelegate })
        .catalogVisit ?? null)
    : null;
}

async function resolveKpiTimezone(sucursalId: number, userId?: number | null) {
  return resolveTimezone({ userId: userId ?? null, sucursalId });
}

/**
 * UTORIDAD CENTRAL PARA CÁLCULOS DE KPI
 * Centraliza la lógica de filtrado por sucursal, periodos y fórmulas de rentabilidad.
 */

export async function getDashboardKpis(
  sucursalId: number,
  period: DashboardPeriod,
  isAdmin: boolean = false,
  userId?: number | null,
  range?: DashboardDateRange | null,
) {
  const timezone = await resolveKpiTimezone(sucursalId, userId);
  const tz = timezone.tz;
  const now = nowAR(tz);
  const dateWhere = resolveDashboardDateWhere(period, now, tz, range);

  // Si sucursalId es 0 y es admin, no filtramos por sucursal (Vista Global),
  // pero solo se incluyen las sucursales que optaron por participar (opt-out via Sucursal.incluidaEnDashboardGlobal)
  const isGlobal = sucursalId === 0 && isAdmin;
  const includedGlobalIds = isGlobal
    ? await getIncludedGlobalSucursalIds()
    : [];
  const sucursalWhere = isGlobal
    ? { sucursalId: { in: includedGlobalIds } }
    : { sucursalId };
  const configSucursalId = timezone.sucursalId;
  const [dashboardConfig, sharedCatalogConfig] = await Promise.all([
    configSucursalId
      ? prisma.configuracion.findFirst({
          where: { sucursalId: configSucursalId },
          select: { usarControlDeCaja: true, separarListaPorSucursal: true },
        })
      : Promise.resolve(null),
    prisma.configuracion.findFirst({
      where: {
        mostrarListaPrecios: true,
        separarListaPorSucursal: false,
      },
      select: { sucursalId: true },
    }),
  ]);
  const hasSharedCatalogEnabled = Boolean(sharedCatalogConfig);
  const catalogUsesSucursalScope =
    !isGlobal &&
    !hasSharedCatalogEnabled &&
    (dashboardConfig?.separarListaPorSucursal ?? true);
  const catalogVisitWhere = {
    ...(catalogUsesSucursalScope ? sucursalWhere : {}),
    ...(dateWhere ? { visitedAt: dateWhere } : {}),
  };

  const catalogVisitDelegate = getCatalogVisitDelegate();

  const [
    countAbiertas,
    countEnPeriodo,
    stockAgg,
    ventasAgg,
    pagosAgg,
    pagosPorTipo,
    ventasData,
    gastosPropiosAgg,
    gastosLinksData,
    proximosVencimientosOwn,
    proximosVencimientosLinks,
    saldoClientesAgg,
    roturasData,
    catalogVisitsCount,
    catalogVisitorsUnique,
    unitsPendientesAgg,
    productosVisiblesCount,
  ] = await Promise.all([
    // 1a. Consignaciones ABIERTAS (sin filtro de período)
    prisma.consignacion.count({
      where: { ...sucursalWhere, estado: "ABIERTA" },
    }),
    // 1b. Consignaciones creadas en período
    prisma.consignacion.count({
      where: { ...sucursalWhere, fecha: dateWhere },
    }),
    // 2. Stock
    isGlobal
      ? prisma.producto.aggregate({
          where: { sucursalId: { in: includedGlobalIds } },
          _sum: { stockDisponibleUnits: true, stockConsignadoUnits: true },
        })
      : prisma.stockSucursal.aggregate({
          where: sucursalWhere,
          _sum: { stockDisponibleUnits: true, stockConsignadoUnits: true },
        }),
    // 3. Ventas Totales por Tipo (excluir anuladas)
    prisma.venta.groupBy({
      by: ["tipo"],
      where: { ...sucursalWhere, fecha: dateWhere, anulada: false },
      _sum: { total: true },
      _count: { _all: true },
    }),
    // 4. Pagos Totales
    prisma.pago.aggregate({
      where: { ...sucursalWhere, fecha: dateWhere },
      _sum: { monto: true },
      _count: { _all: true },
    }),
    // 5. Pagos por Tipo
    prisma.pago.groupBy({
      by: ["tipo"],
      where: { ...sucursalWhere, fecha: dateWhere },
      _sum: { monto: true },
    }),
    // 6. Datos para Ganancia (excluir anuladas)
    prisma.venta.findMany({
      where: { ...sucursalWhere, fecha: dateWhere, anulada: false },
      select: {
        tipo: true,
        descuentoGlobal: true,
        detalles: {
          select: {
            subtotal: true,
            units: true,
            producto: { select: { precioCosto: true } },
          },
        },
      },
    }),
    // 7. Gastos propios incluidos en rentabilidad (pagados + recurrentes pendientes; o de las sucursales incluidas si global)
    isGlobal
      ? prisma.gasto.aggregate({
          where: buildIncludedExpenseWhere({
            fecha: dateWhere,
            sucursalId: { in: includedGlobalIds },
          }),
          _sum: { monto: true },
          _count: { _all: true },
        })
      : prisma.gasto.aggregate({
          where: buildIncludedExpenseWhere({
            sucursalId,
            esCompartido: false,
            fecha: dateWhere,
          }),
          _sum: { monto: true },
          _count: { _all: true },
        }),
    // 8. Participación proporcional en gastos compartidos (solo no-global)
    isGlobal
      ? Promise.resolve([])
      : prisma.gastoSucursal.findMany({
          where: {
            sucursalId,
            ...buildIncludedSharedExpenseWhere({
              fecha: dateWhere,
              esCompartido: true,
            }),
          },
          select: { montoProporcional: true },
        }),
    // 9. Próximos Vencimientos propios PENDIENTE
    prisma.gasto.findMany({
      where: { ...sucursalWhere, estado: "PENDIENTE" },
      orderBy: { fechaVencimiento: "asc" },
      take: isGlobal ? 5 : 10,
      include: { categoria: true, sucursalesCompartidas: true },
    }),
    // 10. Próximos Vencimientos compartidos desde otras sucursales (solo no-global)
    isGlobal
      ? Promise.resolve([])
      : prisma.gastoSucursal.findMany({
          where: {
            sucursalId,
            gasto: { estado: "PENDIENTE", NOT: { sucursalId } },
          },
          orderBy: { gasto: { fechaVencimiento: "asc" } },
          take: 10,
          include: {
            gasto: { include: { categoria: true } },
          },
        }),
    // 12. Saldo Clientes
    prisma.cliente.aggregate({
      where: sucursalWhere,
      _sum: { saldoCuenta: true },
    }),
    // 13. Pérdida por roturas en ventas anuladas del período
    prisma.ventaDetalle.findMany({
      where: {
        esRotura: true,
        venta: { ...sucursalWhere, anulada: true, fechaAnulacion: dateWhere },
      },
      select: {
        units: true,
        producto: { select: { precioCosto: true } },
      },
    }),
    // 14. Visitas catalogo (dedupe por bucket)
    catalogVisitDelegate
      ? catalogVisitDelegate.count({ where: catalogVisitWhere })
      : Promise.resolve(0),
    catalogVisitDelegate
      ? catalogVisitDelegate.groupBy({
          by: ["visitorHash"],
          where: catalogVisitWhere,
        })
      : Promise.resolve([]),
    // 16. Units pendientes reales (consignaciones abiertas)
    prisma.consignacionDetalle.aggregate({
      where: {
        consignacion: { ...sucursalWhere, estado: "ABIERTA" },
      },
      _sum: {
        unitsEntregadas: true,
        unitsVendidasAcum: true,
        unitsDevueltasAcum: true,
      },
    }),
    // 17. Productos visibles en catálogo
    catalogUsesSucursalScope
      ? prisma.stockSucursal.count({
          where: {
            sucursalId,
            stockDisponibleUnits: { gt: 0 },
            producto: { activo: true },
          },
        })
      : prisma.producto.count({
          where: { activo: true, stockDisponibleUnits: { gt: 0 } },
        }),
  ]);

  // --- CÁLCULOS DE GANANCIA ---
  let gananciaBruta = 0;
  let gananciaConsig = 0;
  let gananciaPos = 0;

  let unitsVendidasTotal = 0;
  let unitsVendidasPos = 0;
  let unitsVendidasConsig = 0;

  for (const v of ventasData) {
    const gananciaVenta = calculateGrossProfit(
      v.detalles.map((det) => ({
        subtotal: Number(det.subtotal),
        units: det.units,
        unitCost: Number(det.producto?.precioCosto || 0),
      })),
      Number(v.descuentoGlobal || 0),
    );
    for (const det of v.detalles) {
      unitsVendidasTotal += det.units;
      if (v.tipo === "LIQUIDACION") unitsVendidasConsig += det.units;
      else unitsVendidasPos += det.units;
    }

    if (v.tipo === "LIQUIDACION") gananciaConsig += gananciaVenta;
    else gananciaPos += gananciaVenta;

    gananciaBruta += gananciaVenta;
  }

  // Pérdida por roturas: costo de productos dañados en ventas anuladas del período
  const perdidaRotura = roturasData.reduce(
    (acc: number, det: RoturaDetalle) => {
      return acc + Number(det.producto?.precioCosto || 0) * det.units;
    },
    0,
  );

  // --- UNITS PENDIENTES ---
  const unitsPendientesTotal = Math.max(
    0,
    (unitsPendientesAgg._sum.unitsEntregadas ?? 0) -
      (unitsPendientesAgg._sum.unitsVendidasAcum ?? 0) -
      (unitsPendientesAgg._sum.unitsDevueltasAcum ?? 0),
  );

  // --- GASTOS TOTALES (pagados + recurrentes pendientes del período, con proporción en compartidos) ---
  const totalGastosPropios = Number(gastosPropiosAgg._sum?.monto || 0);
  const totalGastosLinks = (gastosLinksData as GastoLinkRecord[]).reduce(
    (acc: number, g) => acc + Number(g.montoProporcional),
    0,
  );
  const totalGastos = totalGastosPropios + totalGastosLinks;
  const cantidadGastos =
    (gastosPropiosAgg._count?._all || 0) +
    (gastosLinksData as GastoLinkRecord[]).length;

  // --- PRÓXIMOS VENCIMIENTOS (normalizar monto proporcional para gastos compartidos) ---
  const ownPendientes = (proximosVencimientosOwn as GastoPendienteRecord[]).map(
    (g) => {
      let monto = Number(g.monto);
      if (g.esCompartido && g.sucursalesCompartidas?.length > 0) {
        const link = g.sucursalesCompartidas.find(
          (s) => s.sucursalId === sucursalId,
        );
        if (link) monto = Number(link.montoProporcional);
      }
      return { ...g, monto };
    },
  );

  const sharedPendientes = (
    proximosVencimientosLinks as GastoCompartidoPendienteRecord[]
  ).map((link) => ({
    ...link.gasto,
    monto: Number(link.montoProporcional),
  }));

  const allPendientes = [...ownPendientes, ...sharedPendientes]
    .sort((a, b) => {
      const aDate = a.fechaVencimiento
        ? new Date(a.fechaVencimiento).getTime()
        : Infinity;
      const bDate = b.fechaVencimiento
        ? new Date(b.fechaVencimiento).getTime()
        : Infinity;
      return aDate - bDate;
    })
    .slice(0, 5);

  return {
    period,
    isGlobal,
    countAbiertas,
    countEnPeriodo,
    usarControlDeCaja: dashboardConfig?.usarControlDeCaja ?? true,
    stock: {
      disponible: stockAgg._sum?.stockDisponibleUnits || 0,
      consignado: stockAgg._sum?.stockConsignadoUnits || 0,
    },
    finanzas: {
      ventas: {
        total: ventasAgg.reduce(
          (acc: number, v) => acc + Number(v._sum?.total || 0),
          0,
        ),
        cantidad: ventasAgg.reduce(
          (acc: number, v) => acc + (v._count?._all || 0),
          0,
        ),
        porTipo: ventasAgg.reduce<Record<string, number>>(
          (acc, v) => ({ ...acc, [v.tipo]: Number(v._sum?.total || 0) }),
          {},
        ),
        unitsVendidas: {
          total: unitsVendidasTotal,
          soloPos: unitsVendidasPos,
          soloConsig: unitsVendidasConsig,
        },
      },
      pagos: {
        total: Number(pagosAgg._sum?.monto || 0),
        cantidad: pagosAgg._count?._all || 0,
        porTipo: pagosPorTipo.reduce<Record<string, number>>(
          (acc, p) => ({ ...acc, [p.tipo]: Number(p._sum?.monto || 0) }),
          {},
        ),
      },
      ganancia: {
        bruta: gananciaBruta,
        neta: gananciaBruta - totalGastos - perdidaRotura,
        netaSinGastos: gananciaBruta - perdidaRotura,
        gastos: totalGastos,
        perdidaRotura,
        porConsig: gananciaConsig,
        porPos: gananciaPos,
      },
      saldoClientesTotal: Number(saldoClientesAgg._sum?.saldoCuenta || 0),
      clientes: 0,
    },
    gastos: {
      cantidad: cantidadGastos,
      total: totalGastos,
    },
    consignacionUnits: {
      pendientes: unitsPendientesTotal,
    },
    catalogo: {
      visitas: catalogVisitsCount,
      visitantesUnicos: catalogVisitorsUnique.length,
      productosVisibles: productosVisiblesCount,
    },
    proximosVencimientos: allPendientes.map((g) => ({
      ...g,
      monto: Number(g.monto),
    })),
  };
}

/**
 * REPORTE DE TENDENCIA DIARIA
 */
export async function getDashboardTendencia(
  sucursalId: number,
  period: DashboardPeriod,
  isAdmin: boolean = false,
  userId?: number | null,
  range?: DashboardDateRange | null,
) {
  const isGlobal = sucursalId === 0 && isAdmin;
  const includedGlobalIds = isGlobal
    ? await getIncludedGlobalSucursalIds()
    : [];
  const timezone = await resolveKpiTimezone(sucursalId, userId);
  const tz = timezone.tz;
  const now = nowAR(tz);
  const dateWhere = resolveDashboardDateWhere(period, now, tz, range) ?? {
    gte: startOfMonthAR(now, tz),
  };
  const start = dateWhere.gte;

  const days =
    period === "custom" && range
      ? differenceInDays(
          new Date(`${range.to}T00:00:00.000Z`),
          new Date(`${range.from}T00:00:00.000Z`),
        ) + 1
      : differenceInDays(now, start) + 1;

  const sucursalIds = isGlobal ? includedGlobalIds : [sucursalId];

  // La serie se sigue armando en JS porque necesita los días con cero.
  // Lo que se mueve a SQL es la agregación de filas.
  const key = (d: Date) => formatDateInputAR(d, tz);
  const seriesMap: Record<
    string,
    {
      date: string;
      ventasTotal: number;
      pagosTotal: number;
      ventasPosTotal: number;
      ventasConsigTotal: number;
      unitsVendidas: number;
    }
  > = {};

  for (let i = 0; i < days; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    const k = key(d);
    seriesMap[k] = {
      date: k,
      ventasTotal: 0,
      pagosTotal: 0,
      ventasPosTotal: 0,
      ventasConsigTotal: 0,
      unitsVendidas: 0,
    };
  }

  // Mismo criterio de alcance que la consulta original: `in: []` no trae filas.
  if (sucursalIds.length === 0) {
    return { period, isGlobal, series: Object.values(seriesMap) };
  }

  // Las fechas se guardan como hora local en una columna `timestamp` sin zona.
  // Prisma las lee como UTC, así que el día calendario se obtiene interpretando
  // el valor como UTC y convirtiéndolo a la zona configurada. Es exactamente lo
  // que hacía `formatDateInputAR(v.fecha, tz)` en JS.
  const ventasDateFilter =
    "lt" in dateWhere
      ? Prisma.sql`AND v."fecha" >= ${dateWhere.gte} AND v."fecha" < ${dateWhere.lt}`
      : Prisma.sql`AND v."fecha" >= ${dateWhere.gte}`;

  const pagosDateFilter =
    "lt" in dateWhere
      ? Prisma.sql`AND p."fecha" >= ${dateWhere.gte} AND p."fecha" < ${dateWhere.lt}`
      : Prisma.sql`AND p."fecha" >= ${dateWhere.gte}`;

  type DiaVentas = {
    dia: string;
    total: string | number;
    total_consig: string | number;
    total_pos: string | number;
    units: string | number;
  };
  type DiaPagos = { dia: string; monto: string | number };

  const [ventasPorDia, pagosPorDia] = await Promise.all([
    prisma.$queryRaw<DiaVentas[]>`
      WITH filtradas AS (
        SELECT v."id", v."fecha", v."total", v."tipo"
        FROM "Venta" v
        WHERE v."sucursalId" IN (${Prisma.join(sucursalIds)})
          AND v."anulada" = false
          ${ventasDateFilter}
      ),
      por_dia AS (
        SELECT
          to_char("fecha" AT TIME ZONE 'UTC' AT TIME ZONE ${tz}, 'YYYY-MM-DD') AS dia,
          SUM("total") AS total,
          SUM(CASE WHEN "tipo"::text = 'LIQUIDACION' THEN "total" ELSE 0 END) AS total_consig,
          SUM(CASE WHEN "tipo"::text = 'LIQUIDACION' THEN 0 ELSE "total" END) AS total_pos
        FROM filtradas
        GROUP BY 1
      ),
      unidades AS (
        SELECT
          to_char(f."fecha" AT TIME ZONE 'UTC' AT TIME ZONE ${tz}, 'YYYY-MM-DD') AS dia,
          SUM(COALESCE(d."units", 0)) AS units
        FROM filtradas f
        JOIN "VentaDetalle" d ON d."ventaId" = f."id"
        GROUP BY 1
      )
      SELECT p.dia, p.total, p.total_consig, p.total_pos, COALESCE(u.units, 0) AS units
      FROM por_dia p
      LEFT JOIN unidades u USING (dia)
    `,
    prisma.$queryRaw<DiaPagos[]>`
      SELECT
        to_char(p."fecha" AT TIME ZONE 'UTC' AT TIME ZONE ${tz}, 'YYYY-MM-DD') AS dia,
        SUM(p."monto") AS monto
      FROM "Pago" p
      WHERE p."sucursalId" IN (${Prisma.join(sucursalIds)})
        ${pagosDateFilter}
      GROUP BY 1
    `,
  ]);

  for (const row of ventasPorDia) {
    const bucket = seriesMap[row.dia];
    if (!bucket) continue;
    bucket.ventasTotal += Number(row.total);
    bucket.ventasConsigTotal += Number(row.total_consig);
    bucket.ventasPosTotal += Number(row.total_pos);
    bucket.unitsVendidas += Number(row.units);
  }

  for (const row of pagosPorDia) {
    const bucket = seriesMap[row.dia];
    if (!bucket) continue;
    bucket.pagosTotal += Number(row.monto);
  }

  return {
    period,
    isGlobal,
    series: Object.values(seriesMap),
  };
}

/**
 * REPORTE DE PRODUCTOS TOP (Rotación)
 */
export async function getDashboardTopProductos(
  sucursalId: number,
  period: DashboardPeriod,
  isAdmin: boolean = false,
  limit: number = 10,
  userId?: number | null,
  range?: DashboardDateRange | null,
) {
  const isGlobal = sucursalId === 0 && isAdmin;
  const includedGlobalIds = isGlobal
    ? await getIncludedGlobalSucursalIds()
    : [];
  const timezone = await resolveKpiTimezone(sucursalId, userId);
  const tz = timezone.tz;
  const now = nowAR(tz);

  const sucursalIds = isGlobal ? includedGlobalIds : [sucursalId];
  const dateWhere = resolveDashboardDateWhere(period, now, tz, range);

  // `in: []` no trae filas; mismo criterio que la consulta original.
  if (sucursalIds.length === 0) return [];

  const liqDateFilter = dateWhere
    ? Prisma.sql`AND l."fecha" >= ${dateWhere.gte} AND l."fecha" < ${dateWhere.lt}`
    : Prisma.empty;

  const posDateFilter = dateWhere
    ? Prisma.sql`AND v."fecha" >= ${dateWhere.gte} AND v."fecha" < ${dateWhere.lt}`
    : Prisma.empty;

  type TopRow = {
    producto_id: number;
    nombre: string;
    units: string | number;
    total: string | number;
  };

  const rows = await prisma.$queryRaw<TopRow[]>`
    WITH liq AS (
      SELECT
        d."productoId" AS producto_id,
        SUM(COALESCE(li."unitsVendidas", 0)) AS units,
        SUM(
          COALESCE(li."unitsVendidas", 0) * li."precioUnitario"
          - COALESCE(li."descuento", 0)
        ) AS total,
        0 AS orden,
        MIN(li."id") AS orden_seq
      FROM "LiquidacionItem" li
      JOIN "Liquidacion" l ON l."id" = li."liquidacionId"
      JOIN "Consignacion" c ON c."id" = l."consignacionId"
      JOIN "ConsignacionDetalle" d ON d."id" = li."consignacionDetalleId"
      WHERE c."sucursalId" IN (${Prisma.join(sucursalIds)})
        ${liqDateFilter}
      GROUP BY 1
    ),
    pos AS (
      SELECT
        vd."productoId" AS producto_id,
        SUM(COALESCE(vd."units", 0)) AS units,
        SUM(vd."subtotal") AS total,
        1 AS orden,
        MIN(vd."id") AS orden_seq
      FROM "VentaDetalle" vd
      JOIN "Venta" v ON v."id" = vd."ventaId"
      WHERE v."sucursalId" IN (${Prisma.join(sucursalIds)})
        AND v."tipo"::text = 'CASUAL'
        AND v."anulada" = false
        ${posDateFilter}
      GROUP BY 1
    ),
    unificado AS (
      SELECT * FROM liq
      UNION ALL
      SELECT * FROM pos
    )
    SELECT
      u.producto_id,
      MAX(p."nombre") AS nombre,
      SUM(u.units) AS units,
      SUM(u.total) AS total
    FROM unificado u
    JOIN "Producto" p ON p."id" = u.producto_id
    GROUP BY u.producto_id
    ORDER BY SUM(u.units) DESC, MIN(u.orden) ASC, MIN(u.orden_seq) ASC, u.producto_id ASC
    LIMIT ${limit}
  `;

  return rows.map((row) => ({
    productoId: row.producto_id,
    nombre: row.nombre,
    units: Number(row.units),
    total: Number(row.total),
  }));
}

/**
 * TOP PRODUCTOS CONSIGNADOS (unidades entregadas en consignaciones abiertas)
 */
export async function getDashboardTopConsignados(
  sucursalId: number,
  period: DashboardPeriod,
  isAdmin: boolean = false,
  limit: number = 10,
  userId?: number | null,
  range?: DashboardDateRange | null,
) {
  const isGlobal = sucursalId === 0 && isAdmin;
  const includedGlobalIds = isGlobal
    ? await getIncludedGlobalSucursalIds()
    : [];
  const timezone = await resolveKpiTimezone(sucursalId, userId);
  const tz = timezone.tz;
  const now = nowAR(tz);

  const sucursalWhere = isGlobal
    ? { sucursalId: { in: includedGlobalIds } }
    : { sucursalId };
  const dateWhere = resolveDashboardDateWhere(period, now, tz, range);

  const detalles = await prisma.consignacionDetalle.findMany({
    where: {
      consignacion: {
        ...sucursalWhere,
        ...(dateWhere ? { fecha: dateWhere } : {}),
      },
    },
    select: {
      unitsEntregadas: true,
      producto: { select: { id: true, nombre: true } },
    },
  });

  const map = new Map<
    number,
    { productoId: number; nombre: string; unitsEntregadas: number }
  >();
  for (const d of detalles) {
    const id = d.producto.id;
    const prev = map.get(id);
    if (!prev)
      map.set(id, {
        productoId: id,
        nombre: d.producto.nombre,
        unitsEntregadas: d.unitsEntregadas ?? 0,
      });
    else prev.unitsEntregadas += d.unitsEntregadas ?? 0;
  }

  return Array.from(map.values())
    .sort((a, b) => b.unitsEntregadas - a.unitsEntregadas)
    .slice(0, limit);
}
