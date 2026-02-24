import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/requireAuth";

type Period = "today" | "week" | "month" | "all";

function getPeriodStart(period: Period) {
  const now = new Date();
  if (period === "all") return undefined;

  const start = new Date(now);
  start.setHours(0, 0, 0, 0);

  if (period === "today") return start;
  if (period === "week") {
    start.setDate(start.getDate() - 6);
    return start;
  }
  // Month (últimos 30 días)
  start.setDate(start.getDate() - 29);
  return start;
}

export async function GET(req: Request) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.res;

  const { searchParams } = new URL(req.url);
  const period = (searchParams.get("period") as Period) ?? "month";

  const start = getPeriodStart(period);
  const dateWhere = start ? { gte: start } : undefined;
  const sucursalId = auth.activeSucursalId;

  // Ejecutamos consultas en paralelo para velocidad
  const [
    totalConsig,
    abiertasConsig,
    cerradasConsig,
    stockAgg,
    consignacionesPeriodo,
    detallesAbiertas,
    ventasAgg,
    pagosAgg,
    saldoClientesAgg,

    // CONSULTAS PARA CÁLCULO DE GANANCIA
    itemsLiquidados,
    itemsVentaDirecta

  ] = await Promise.all([
    // 1. Conteos
    prisma.consignacion.count({ where: { sucursalId } }),
    prisma.consignacion.count({ where: { estado: "ABIERTA", sucursalId } }),
    prisma.consignacion.count({ where: { estado: "CERRADA", sucursalId } }),

    // 2. Stock (Agregamos desde StockSucursal para la sucursal activa)
    prisma.stockSucursal.aggregate({
      where: { sucursalId },
      _sum: { stockDisponibleUnits: true, stockConsignadoUnits: true },
    }),

    // 3. Actividad
    prisma.consignacion.count({ where: { fecha: dateWhere, sucursalId } }),

    // 4. Pendientes
    prisma.consignacionDetalle.findMany({
      where: {
        consignacion: {
          estado: "ABIERTA",
          sucursalId
        }
      },
      select: { unitsEntregadas: true, unitsVendidasAcum: true, unitsDevueltasAcum: true },
    }),

    // 5. Finanzas Macro
    prisma.venta.aggregate({
      where: { fecha: dateWhere, sucursalId },
      _sum: { total: true },
      _count: { _all: true },
    }),
    prisma.pago.aggregate({
      where: {
        fecha: dateWhere,
        cliente: { sucursalId }
      },
      _sum: { monto: true },
      _count: { _all: true },
    }),
    prisma.cliente.aggregate({
      where: { sucursalId },
      _sum: { saldoCuenta: true },
      _count: { _all: true },
    }),

    // 6. DATOS PARA GANANCIA CONSIGNACIÓN (CON AUMENTO)
    prisma.liquidacionItem.findMany({
      where: {
        liquidacion: {
          fecha: dateWhere,
          consignacion: { sucursalId }
        }
      },
      select: {
        unitsVendidas: true,
        detalle: {
          select: {
            producto: {
              select: {
                precioVenta: true,
                precioCosto: true
              }
            },
            consignacion: {
              select: {
                porcentajeAumento: true
              }
            }
          }
        }
      }
    }),

    // 7. DATOS PARA GANANCIA POS (VENTA DIRECTA)
    prisma.ventaDetalle.findMany({
      where: {
        venta: {
          fecha: dateWhere,
          sucursalId,
          liquidacionId: null
        }
      },
      select: {
        precioUnitario: true,
        units: true,
        producto: { select: { precioCosto: true } }
      }
    })
  ]);

  // --- CÁLCULOS LÓGICOS ---

  let unitsPendientes = 0;
  for (const d of detallesAbiertas) {
    unitsPendientes += (d.unitsEntregadas - d.unitsVendidasAcum - d.unitsDevueltasAcum);
  }

  // A. CÁLCULO DE GANANCIA POR CONSIGNACIÓN (AQUÍ ESTÁ LA CORRECCIÓN)
  let gananciaConsignacion = 0;

  for (const item of itemsLiquidados) {
    const precioBase = Number(item.detalle?.producto?.precioVenta || 0);
    const porcentaje = Number(item.detalle?.consignacion?.porcentajeAumento || 0);
    const costo = Number(item.detalle?.producto?.precioCosto || 0);
    const cantidad = item.unitsVendidas;

    // 1. Calculamos el precio real cobrado con el aumento
    // Ejemplo: Base $1000 + 10% = $1100
    const precioCobradoReal = precioBase * (1 + porcentaje / 100);

    // 2. Restamos el costo para sacar la ganancia neta de este ítem
    // Ejemplo: $1100 - Costo $600 = Ganancia $500
    const gananciaItem = (precioCobradoReal - costo) * cantidad;

    gananciaConsignacion += gananciaItem;
  }

  // B. CÁLCULO DE GANANCIA POS (LOCAL)
  let gananciaDirecta = 0;
  for (const item of itemsVentaDirecta) {
    const precioVenta = Number(item.precioUnitario);
    const costo = Number(item.producto?.precioCosto || 0);
    const cantidad = item.units;

    gananciaDirecta += (precioVenta - costo) * cantidad;
  }

  // C. GANANCIA NETA TOTAL (SUMA DE AMBAS)
  const gananciaTotal = gananciaConsignacion + gananciaDirecta;

  // --- RESPUESTA ---
  const stockDisponible = stockAgg._sum?.stockDisponibleUnits ?? 0;
  const stockConsignado = stockAgg._sum?.stockConsignadoUnits ?? 0;

  return NextResponse.json({
    data: {
      period,
      consignaciones: {
        total: totalConsig,
        abiertas: abiertasConsig,
        cerradas: cerradasConsig,
        creadasEnPeriodo: consignacionesPeriodo,
      },
      consignacionUnits: {
        pendientes: unitsPendientes,
      },
      stock: {
        disponibleUnits: stockDisponible,
        consignadoUnits: stockConsignado,
        totalUnits: stockDisponible + stockConsignado,
      },
      finanzas: {
        ventas: {
          cantidad: ventasAgg._count?._all ?? 0,
          total: Number(ventasAgg._sum?.total ?? 0),
        },
        pagos: {
          cantidad: pagosAgg._count?._all ?? 0,
          total: Number(pagosAgg._sum?.monto ?? 0),
        },
        // 👇 OBJETO GANANCIA CALCULADO CORRECTAMENTE
        ganancia: {
          total: gananciaTotal,
          porConsignacion: gananciaConsignacion,
          porVentaDirecta: gananciaDirecta,
        },
        saldoClientesTotal: Number(saldoClientesAgg._sum?.saldoCuenta ?? 0),
        clientes: saldoClientesAgg._count?._all ?? 0,
      },
    },
  });
}