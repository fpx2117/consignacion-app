import { prisma } from "@/lib/prisma";
import { unstable_cache } from "next/cache";
import { differenceInDays } from "date-fns";
import { nowAR, startOfDayAR, startOfWeekAR, startOfMonthAR } from "@/lib/utils-date";
import { getConfiguredTz } from "@/lib/get-configured-tz";
import { DashboardPeriod } from "./types";

/**
 * UTORIDAD CENTRAL PARA CÁLCULOS DE KPI
 * Centraliza la lógica de filtrado por sucursal, periodos y fórmulas de rentabilidad.
 */

/**
 * getDashboardKpis — envuelta en unstable_cache con revalidate: 60s.
 * Múltiples usuarios viendo el dashboard comparten la misma respuesta cacheada
 * durante 60 segundos. Se invalida con revalidateTag('dashboard').
 */
export const getDashboardKpis = unstable_cache(
  async (sucursalId: number, period: DashboardPeriod, isAdmin: boolean = false) => {
    const tz = await getConfiguredTz(isAdmin && sucursalId === 0 ? 1 : sucursalId);
    const now = nowAR(tz);
    let start: Date | undefined;

    if (period === "today") start = startOfDayAR(now, tz);
    else if (period === "week") start = startOfWeekAR(now, tz);
    else if (period === "month") start = startOfMonthAR(now, tz);

    const dateWhere = start ? { gte: start } : undefined;

    // Si sucursalId es 0 y es admin, no filtramos por sucursal (Vista Global)
    const isGlobal = sucursalId === 0 && isAdmin;
    const sucursalWhere = isGlobal ? {} : { sucursalId };
    const [branchConfig, principalConfig, sharedCatalogConfig] = await Promise.all([
        prisma.configuracion.findFirst({
            where: isGlobal ? { sucursalId: 1 } : { sucursalId },
            select: { usarControlDeCaja: true, separarListaPorSucursal: true },
        }),
        prisma.configuracion.findFirst({
            where: { sucursalId: 1 },
            select: { usarControlDeCaja: true, separarListaPorSucursal: true },
        }),
        prisma.configuracion.findFirst({
            where: {
                mostrarListaPrecios: true,
                separarListaPorSucursal: false,
            },
            select: { sucursalId: true },
        }),
    ]);
    const dashboardConfig = branchConfig ?? principalConfig;
    const hasSharedCatalogEnabled = Boolean(sharedCatalogConfig);
    const catalogUsesSucursalScope =
        !isGlobal &&
        !hasSharedCatalogEnabled &&
        (dashboardConfig?.separarListaPorSucursal ?? true);
    const catalogVisitWhere = {
        ...(catalogUsesSucursalScope ? sucursalWhere : {}),
        ...(dateWhere ? { visitedAt: dateWhere } : {}),
    };

    const hasCatalogVisitModel = "catalogVisit" in prisma;

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
        prisma.consignacion.count({ where: { ...sucursalWhere, estado: "ABIERTA" } }),
        // 1b. Consignaciones creadas en período
        prisma.consignacion.count({ where: { ...sucursalWhere, fecha: dateWhere } }),
        // 2. Stock
        isGlobal
            ? prisma.producto.aggregate({ _sum: { stockDisponibleUnits: true, stockConsignadoUnits: true } })
            : prisma.stockSucursal.aggregate({ where: sucursalWhere, _sum: { stockDisponibleUnits: true, stockConsignadoUnits: true } }),
        // 3. Ventas Totales por Tipo (excluir anuladas)
        prisma.venta.groupBy({
            by: ['tipo'],
            where: { ...sucursalWhere, fecha: dateWhere, anulada: false },
            _sum: { total: true },
            _count: { _all: true }
        }),
        // 4. Pagos Totales
        prisma.pago.aggregate({
            where: { ...sucursalWhere, fecha: dateWhere },
            _sum: { monto: true },
            _count: { _all: true }
        }),
        // 5. Pagos por Tipo
        prisma.pago.groupBy({
            by: ['tipo'],
            where: { ...sucursalWhere, fecha: dateWhere },
            _sum: { monto: true }
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
                        producto: { select: { precioCosto: true } }
                    }
                }
            }
        }),
        // 7. Gastos propios PAGADO no compartidos (o todos si global)
        isGlobal
            ? prisma.gasto.aggregate({
                where: { fecha: dateWhere, estado: "PAGADO" },
                _sum: { monto: true },
                _count: { _all: true }
            })
            : prisma.gasto.aggregate({
                where: { sucursalId, esCompartido: false, fecha: dateWhere, estado: "PAGADO" },
                _sum: { monto: true },
                _count: { _all: true }
            }),
        // 8. Participación proporcional en gastos compartidos (solo no-global)
        isGlobal
            ? Promise.resolve([])
            : prisma.gastoSucursal.findMany({
                where: {
                    sucursalId,
                    gasto: { fecha: dateWhere, estado: "PAGADO" }
                },
                select: { montoProporcional: true }
            }),
        // 9. Próximos Vencimientos propios PENDIENTE
        prisma.gasto.findMany({
            where: { ...sucursalWhere, estado: "PENDIENTE" },
            orderBy: { fechaVencimiento: "asc" },
            take: isGlobal ? 5 : 10,
            include: { categoria: true, sucursalesCompartidas: true }
        }),
        // 10. Próximos Vencimientos compartidos desde otras sucursales (solo no-global)
        isGlobal
            ? Promise.resolve([])
            : prisma.gastoSucursal.findMany({
                where: {
                    sucursalId,
                    gasto: { estado: "PENDIENTE", NOT: { sucursalId } }
                },
                orderBy: { gasto: { fechaVencimiento: "asc" } },
                take: 10,
                include: {
                    gasto: { include: { categoria: true } }
                }
            }),
        // 12. Saldo Clientes
        prisma.cliente.aggregate({
            where: sucursalWhere,
            _sum: { saldoCuenta: true }
        }),
        // 13. Pérdida por roturas en ventas anuladas del período
        prisma.ventaDetalle.findMany({
            where: {
                esRotura: true,
                venta: { ...sucursalWhere, anulada: true, fechaAnulacion: dateWhere }
            },
            select: {
                units: true,
                producto: { select: { precioCosto: true } }
            }
        }),
        // 14. Visitas catalogo (dedupe por bucket)
        hasCatalogVisitModel
            ? (prisma as any).catalogVisit.count({ where: catalogVisitWhere })
            : Promise.resolve(0),
        hasCatalogVisitModel
            ? (prisma as any).catalogVisit.groupBy({ by: ["visitorHash"], where: catalogVisitWhere })
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

    for (const v of ventasData) {
        let gananciaVenta = 0;
        for (const det of v.detalles) {
            const subtotalItem = Number(det.subtotal);
            const costoItem = Number(det.producto?.precioCosto || 0) * det.units;
            gananciaVenta += (subtotalItem - costoItem);
        }
        gananciaVenta -= Number(v.descuentoGlobal || 0);

        if (v.tipo === "LIQUIDACION") gananciaConsig += gananciaVenta;
        else gananciaPos += gananciaVenta;

        gananciaBruta += gananciaVenta;
    }

    // Pérdida por roturas: costo de productos dañados en ventas anuladas del período
    const perdidaRotura = roturasData.reduce((acc: number, det: any) => {
        return acc + (Number(det.producto?.precioCosto || 0) * det.units);
    }, 0);

    // --- UNITS PENDIENTES ---
    const unitsPendientesTotal = Math.max(0,
        (unitsPendientesAgg._sum.unitsEntregadas ?? 0) -
        (unitsPendientesAgg._sum.unitsVendidasAcum ?? 0) -
        (unitsPendientesAgg._sum.unitsDevueltasAcum ?? 0)
    );

    // --- GASTOS TOTALES (propios no compartidos + participación proporcional en compartidos) ---
    const totalGastosPropios = Number(gastosPropiosAgg._sum?.monto || 0);
    const totalGastosLinks = (gastosLinksData as any[]).reduce(
        (acc: number, g: any) => acc + Number(g.montoProporcional), 0
    );
    const totalGastos = totalGastosPropios + totalGastosLinks;
    const cantidadGastos = (gastosPropiosAgg._count?._all || 0) + (gastosLinksData as any[]).length;

    // --- PRÓXIMOS VENCIMIENTOS (normalizar monto proporcional para gastos compartidos) ---
    const ownPendientes = (proximosVencimientosOwn as any[]).map((g: any) => {
        let monto = Number(g.monto);
        if (g.esCompartido && g.sucursalesCompartidas?.length > 0) {
            const link = g.sucursalesCompartidas.find((s: any) => s.sucursalId === sucursalId);
            if (link) monto = Number(link.montoProporcional);
        }
        return { ...g, monto };
    });

    const sharedPendientes = (proximosVencimientosLinks as any[]).map((link: any) => ({
        ...link.gasto,
        monto: Number(link.montoProporcional),
    }));

    const allPendientes = [...ownPendientes, ...sharedPendientes]
        .sort((a, b) => {
            const aDate = a.fechaVencimiento ? new Date(a.fechaVencimiento).getTime() : Infinity;
            const bDate = b.fechaVencimiento ? new Date(b.fechaVencimiento).getTime() : Infinity;
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
                total: ventasAgg.reduce((acc: number, v: any) => acc + Number(v._sum?.total || 0), 0),
                cantidad: ventasAgg.reduce((acc: number, v: any) => acc + (v._count?._all || 0), 0),
                porTipo: ventasAgg.reduce((acc: any, v: any) => ({ ...acc, [v.tipo]: Number(v._sum?.total || 0) }), {} as any)
            },
            pagos: {
                total: Number(pagosAgg._sum?.monto || 0),
                cantidad: pagosAgg._count?._all || 0,
                porTipo: pagosPorTipo.reduce((acc: any, p: any) => ({ ...acc, [p.tipo]: Number(p._sum?.monto || 0) }), {} as any)
            },
            ganancia: {
                bruta: gananciaBruta,
                neta: gananciaBruta - totalGastos - perdidaRotura,
                gastos: totalGastos,
                perdidaRotura,
                porConsig: gananciaConsig,
                porPos: gananciaPos
            },
            saldoClientesTotal: Number(saldoClientesAgg._sum?.saldoCuenta || 0),
            clientes: 0,
        },
        gastos: {
            cantidad: cantidadGastos,
            total: totalGastos
        },
        consignacionUnits: {
            pendientes: unitsPendientesTotal,
        },
        catalogo: {
            visitas: catalogVisitsCount,
            visitantesUnicos: catalogVisitorsUnique.length,
            productosVisibles: productosVisiblesCount,
        },
        proximosVencimientos: allPendientes.map((g: any) => ({
            ...g,
            monto: Number(g.monto)
        }))
    };
  },
  ["dashboard-kpis"],
  {
    revalidate: 60,
    tags: ["dashboard", "kpis"],
  }
);

/**
 * REPORTE DE TENDENCIA DIARIA
 */
export async function getDashboardTendencia(sucursalId: number, period: DashboardPeriod, isAdmin: boolean = false) {
    const isGlobal = sucursalId === 0 && isAdmin;
    const tz = await getConfiguredTz(isGlobal ? 1 : sucursalId);
    const now = nowAR(tz);
    let start: Date;

    if (period === "today") start = startOfDayAR(now, tz);
    else if (period === "week") start = startOfWeekAR(now, tz);
    else start = startOfMonthAR(now, tz);

    const sucursalWhere = isGlobal ? {} : { sucursalId };
    const days = differenceInDays(now, start) + 1;

    const [ventas, pagos] = await Promise.all([
        prisma.venta.findMany({
            where: { ...sucursalWhere, fecha: { gte: start }, anulada: false },
            select: {
                fecha: true,
                total: true,
                tipo: true,
                descuentoGlobal: true,
                detalles: { select: { units: true } }
            }
        }),
        prisma.pago.findMany({
            where: { ...sucursalWhere, fecha: { gte: start } },
            select: { fecha: true, monto: true, tipo: true }
        }),
    ]);

    const key = (d: Date) => startOfDayAR(d, tz).toISOString().slice(0, 10);
    const seriesMap: Record<string, any> = {};

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

    for (const v of ventas) {
        const k = key(v.fecha);
        if (!seriesMap[k]) continue;
        const totalNeto = Number(v.total) - Number(v.descuentoGlobal || 0);

        // Sumar unidades vendidas
        const unitsVenta = v.detalles?.reduce((acc: number, d: any) => acc + (d.units || 0), 0) || 0;
        seriesMap[k].unitsVendidas += unitsVenta;

        seriesMap[k].ventasTotal += totalNeto;
        if (v.tipo === "LIQUIDACION") seriesMap[k].ventasConsigTotal += totalNeto;
        else seriesMap[k].ventasPosTotal += totalNeto;
    }

    for (const p of pagos) {
        const k = key(p.fecha);
        if (!seriesMap[k]) continue;
        seriesMap[k].pagosTotal += Number(p.monto);
    }

    return {
        period,
        isGlobal,
        series: Object.values(seriesMap)
    };
}

/**
 * REPORTE DE PRODUCTOS TOP (Rotación)
 */
export async function getDashboardTopProductos(sucursalId: number, period: DashboardPeriod, isAdmin: boolean = false, limit: number = 10) {
    const isGlobal = sucursalId === 0 && isAdmin;
    const tz = await getConfiguredTz(isGlobal ? 1 : sucursalId);
    const now = nowAR(tz);
    let start: Date | undefined;

    if (period === "today") start = startOfDayAR(now, tz);
    else if (period === "week") start = startOfWeekAR(now, tz);
    else if (period === "month") start = startOfMonthAR(now, tz);

    const sucursalWhere = isGlobal ? {} : { sucursalId };
    const dateWhere = start ? { gte: start } : undefined;

    const [liqItems, posItems] = await Promise.all([
        prisma.liquidacionItem.findMany({
            where: {
                liquidacion: {
                    fecha: dateWhere,
                    consignacion: sucursalWhere
                }
            },
            select: {
                unitsVendidas: true,
                precioUnitario: true,
                descuento: true,
                detalle: { select: { productoId: true, producto: { select: { nombre: true } } } },
            },
        }),
        prisma.ventaDetalle.findMany({
            where: {
                venta: {
                    fecha: dateWhere,
                    ...sucursalWhere,
                    tipo: "CASUAL",
                    anulada: false
                }
            },
            select: {
                units: true,
                precioUnitario: true,
                subtotal: true,
                producto: { select: { id: true, nombre: true } }
            }
        })
    ]);

    const mapVendidos = new Map<number, { productoId: number; nombre: string; units: number; total: number }>();

    for (const it of liqItems) {
        const productoId = it.detalle.productoId;
        const units = it.unitsVendidas ?? 0;
        const total = (units * Number(it.precioUnitario)) - Number(it.descuento || 0);
        const prev = mapVendidos.get(productoId);
        if (!prev) mapVendidos.set(productoId, { productoId, nombre: it.detalle.producto.nombre, units, total });
        else { prev.units += units; prev.total += total; }
    }

    for (const it of posItems) {
        const productoId = it.producto.id;
        const units = it.units ?? 0;
        const total = Number(it.subtotal);
        const prev = mapVendidos.get(productoId);
        if (!prev) mapVendidos.set(productoId, { productoId, nombre: it.producto.nombre, units, total });
        else { prev.units += units; prev.total += total; }
    }

    return Array.from(mapVendidos.values())
        .sort((a, b) => b.units - a.units)
        .slice(0, limit);
}

/**
 * TOP PRODUCTOS CONSIGNADOS (unidades entregadas en consignaciones abiertas)
 */
export async function getDashboardTopConsignados(
    sucursalId: number,
    period: DashboardPeriod,
    isAdmin: boolean = false,
    limit: number = 10
) {
    const isGlobal = sucursalId === 0 && isAdmin;
    const tz = await getConfiguredTz(isGlobal ? 1 : sucursalId);
    const now = nowAR(tz);
    let start: Date | undefined;

    if (period === "today") start = startOfDayAR(now, tz);
    else if (period === "week") start = startOfWeekAR(now, tz);
    else if (period === "month") start = startOfMonthAR(now, tz);

    const sucursalWhere = isGlobal ? {} : { sucursalId };
    const dateWhere = start ? { gte: start } : undefined;

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

    const map = new Map<number, { productoId: number; nombre: string; unitsEntregadas: number }>();
    for (const d of detalles) {
        const id = d.producto.id;
        const prev = map.get(id);
        if (!prev) map.set(id, { productoId: id, nombre: d.producto.nombre, unitsEntregadas: d.unitsEntregadas ?? 0 });
        else prev.unitsEntregadas += d.unitsEntregadas ?? 0;
    }

    return Array.from(map.values())
        .sort((a, b) => b.unitsEntregadas - a.unitsEntregadas)
        .slice(0, limit);
}
