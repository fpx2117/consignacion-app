/* eslint-disable */
// @ts-nocheck
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/requireAuth";
import { createLiquidacionBodySchema } from "@/lib/validators/liquidacion";
import { TipoMovimientoStock, MotivoMovimientoStock } from "@prisma/client";

// ✅ Imports Centralizados de Config y Notificaciones
import { obtenerConfiguracionGlobal } from "@/lib/config";
import { evaluateStockAlert, processNotificationQueue } from "@/lib/stock-alerts";

type RouteParams = {
  params: Promise<{ id: string }>;
};

/**
 * GET /api/liquidaciones/[id]
 */
export async function GET(_: Request, { params }: RouteParams) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.res;

  const { id: rawId } = await params;
  const liquidacionId = Number(rawId);

  if (!Number.isFinite(liquidacionId)) {
    return NextResponse.json({ error: "ID inválido" }, { status: 400 });
  }

  const liq = await prisma.liquidacion.findUnique({
    where: { id: liquidacionId },
    include: {
      items: { include: { detalle: { include: { producto: true } } } },
      venta: { include: { detalles: true } },
      consignacion: {
        include: {
          cliente: true,
          detalles: { include: { producto: true } },
        },
      },
    },
  });

  if (!liq) return NextResponse.json({ error: "No encontrada" }, { status: 404 });

  return NextResponse.json({ data: liq });
}

/**
 * PUT /api/liquidaciones/[id]
 * Corregir una liquidación existente (reversa + aplica nuevo)
 */
export async function PUT(req: Request, { params }: RouteParams) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.res;

  const { id: rawId } = await params;
  const liquidacionId = Number(rawId);

  if (!Number.isFinite(liquidacionId)) {
    return NextResponse.json({ error: "ID inválido" }, { status: 400 });
  }

  const body = await req.json().catch(() => null);
  const parsed = createLiquidacionBodySchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validación fallida", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  // ✅ 1. Preparar Configuración y Cola de Notificaciones
  const configGlobal = await obtenerConfiguracionGlobal();
  const notificationsQueue: any[] = [];

  try {
    const result = await prisma.$transaction(async (tx) => {
      // 0) Buscar liquidación existente
      const liqExistente = await tx.liquidacion.findUnique({
        where: { id: liquidacionId },
        include: {
          items: true,
          venta: true,
          consignacion: {
            include: {
              cliente: true,
              detalles: { include: { producto: true } },
            },
          },
        },
      });

      if (!liqExistente) throw new Error("LIQUIDACION_NO_ENCONTRADA");
      const consignacionId = liqExistente.consignacionId;

      // Reabrir si estaba cerrada
      if (liqExistente.consignacion.estado === "CERRADA") {
        await tx.consignacion.update({
          where: { id: consignacionId },
          data: { estado: "ABIERTA" },
        });
      }

      // --- 1) REVERTIR ITEMS ANTERIORES ---
      for (const item of liqExistente.items) {
        const det = liqExistente.consignacion.detalles.find((d) => d.id === item.consignacionDetalleId);
        if (!det) continue;

        await tx.consignacionDetalle.update({
          where: { id: item.consignacionDetalleId },
          data: {
            unitsVendidasAcum: { decrement: item.unitsVendidas },
            unitsDevueltasAcum: { decrement: item.unitsDevueltas },
          },
        });

        const productoAntes = await tx.producto.findUnique({ where: { id: det.productoId } });

        const productoDespues = await tx.producto.update({
          where: { id: det.productoId },
          data: {
            stockConsignadoUnits: { increment: item.unitsVendidas + item.unitsDevueltas },
            ...(item.unitsDevueltas > 0 ? { stockDisponibleUnits: { decrement: item.unitsDevueltas } } : {}),
          },
        });

        // Auditoría Reversa: Lo que se devolvió al almacén, ahora se "des-devuelve" (Sale)
        if (item.unitsDevueltas > 0) {
          await tx.movimientoStock.create({
            data: {
              productoId: det.productoId,
              tipo: TipoMovimientoStock.SALIDA,
              motivo: MotivoMovimientoStock.AJUSTE_NEGATIVO,
              cantidad: item.unitsDevueltas,
              stockPrevio: productoAntes!.stockDisponibleUnits,
              stockPosterior: productoDespues.stockDisponibleUnits,
              observaciones: `Reverso Devolución Liq #${liquidacionId} (Consignación #${consignacionId})`
            }
          });
        }

        // Auditoría Reversa: Lo que se había "vendido", ahora "vuelve" virtualmente (Entra a consignado, no a disponible, pero dejamos registro)
        if (item.unitsVendidas > 0) {
          await tx.movimientoStock.create({
            data: {
              productoId: det.productoId,
              tipo: TipoMovimientoStock.ENTRADA, // Entra lógicamente al sistema de nuevo
              motivo: MotivoMovimientoStock.AJUSTE_POSITIVO,
              cantidad: item.unitsVendidas,
              stockPrevio: productoAntes!.stockDisponibleUnits,
              stockPosterior: productoDespues.stockDisponibleUnits, // No cambia el disponible, pero documentamos
              observaciones: `Reverso Venta Liq #${liquidacionId} (Consignación #${consignacionId})`
            }
          });
        }
      }

      // Revertir venta y saldo
      if (liqExistente.venta) {
        await tx.cliente.update({
          where: { id: liqExistente.consignacion.clienteId },
          data: { saldoCuenta: { decrement: liqExistente.venta.total } },
        });
        await tx.venta.delete({ where: { id: liqExistente.venta.id } });
      }

      // Borrar items viejos
      await tx.liquidacionItem.deleteMany({ where: { liquidacionId } });

      // --- 2) PREPARAR Y APLICAR NUEVOS DATOS ---
      const detallesMap = new Map(liqExistente.consignacion.detalles.map((d) => [d.id, d]));
      let nuevoTotalVenta = 0;
      const soldByProduct = new Map<number, { units: number; precioUnitario: number }>();

      for (const it of parsed.data.items) {
        const det = detallesMap.get(it.consignacionDetalleId);
        if (!det) throw new Error("DETALLE_NO_PERTENECE");

        const vendidas = it.unitsVendidas ?? 0;
        const devueltas = it.unitsDevueltas ?? 0;

        const freshDet = await tx.consignacionDetalle.findUniqueOrThrow({ where: { id: det.id } });
        const pendiente = freshDet.unitsEntregadas - freshDet.unitsVendidasAcum - freshDet.unitsDevueltasAcum;

        if (vendidas + devueltas > pendiente) throw new Error(`EXCEDE_PENDIENTE:${det.id}`);

        const precioUnit = Number(det.producto.precioVenta);

        if (vendidas > 0) {
          nuevoTotalVenta += vendidas * precioUnit;
          const prev = soldByProduct.get(det.productoId);
          soldByProduct.set(det.productoId, {
            units: (prev?.units ?? 0) + vendidas,
            precioUnitario: precioUnit,
          });
        }

        // Aplicar nuevos contadores
        await tx.consignacionDetalle.update({
          where: { id: det.id },
          data: {
            unitsVendidasAcum: { increment: vendidas },
            unitsDevueltasAcum: { increment: devueltas },
          },
        });

        const productoAntes = await tx.producto.findUnique({ where: { id: det.productoId } });

        // Aplicar nuevo stock
        const productoDespues = await tx.producto.update({
          where: { id: det.productoId },
          data: {
            stockConsignadoUnits: { decrement: vendidas + devueltas },
            ...(devueltas > 0 ? { stockDisponibleUnits: { increment: devueltas } } : {}),
          },
        });

        // Auditoría Nuevo: Devolución (Entra stock disponible)
        if (devueltas > 0) {
          await tx.movimientoStock.create({
            data: {
              productoId: det.productoId,
              tipo: TipoMovimientoStock.ENTRADA,
              motivo: MotivoMovimientoStock.DEVOLUCION_CLIENTE,
              cantidad: devueltas,
              stockPrevio: productoAntes!.stockDisponibleUnits,
              stockPosterior: productoDespues.stockDisponibleUnits,
              observaciones: `Devolución Corregida Liq #${liquidacionId}`
            }
          });
        }

        // Auditoría Nuevo: Venta (Sale definitivamente)
        if (vendidas > 0) {
          await tx.movimientoStock.create({
            data: {
              productoId: det.productoId,
              tipo: TipoMovimientoStock.SALIDA,
              motivo: MotivoMovimientoStock.VENTA,
              cantidad: vendidas,
              stockPrevio: productoAntes!.stockDisponibleUnits,
              stockPosterior: productoDespues.stockDisponibleUnits,
              observaciones: `Venta Corregida Liq #${liquidacionId}`
            }
          });
        }

        // Evaluar alertas por los nuevos movimientos
        const alerta = evaluateStockAlert(productoDespues, configGlobal);
        if (alerta) notificationsQueue.push(alerta);
      }

      // 3) Recrear items de liquidación
      await tx.liquidacionItem.createMany({
        data: parsed.data.items.map((it) => ({
          liquidacionId,
          consignacionDetalleId: it.consignacionDetalleId,
          unitsVendidas: it.unitsVendidas ?? 0,
          unitsDevueltas: it.unitsDevueltas ?? 0,
          precioUnitario: detallesMap.get(it.consignacionDetalleId)!.producto.precioVenta,
        })),
      });

      // 4) Crear nueva venta y saldo
      let nuevaVenta = null;
      if (nuevoTotalVenta > 0) {
        nuevaVenta = await tx.venta.create({
          data: {
            clienteId: liqExistente.consignacion.clienteId,
            liquidacionId,
            total: nuevoTotalVenta,
            detalles: {
              create: Array.from(soldByProduct.entries()).map(([productoId, info]) => ({
                productoId,
                units: info.units,
                precioUnitario: info.precioUnitario,
                subtotal: info.units * info.precioUnitario,
              })),
            },
          },
          include: { detalles: true },
        });

        await tx.cliente.update({
          where: { id: liqExistente.consignacion.clienteId },
          data: { saldoCuenta: { increment: nuevoTotalVenta } },
        });
      }

      // 5) Recalcular cierre
      const detallesFinales = await tx.consignacionDetalle.findMany({ where: { consignacionId } });
      const quedaPendiente = detallesFinales.some((d) => d.unitsEntregadas - d.unitsVendidasAcum - d.unitsDevueltasAcum > 0);

      if (!quedaPendiente) {
        await tx.consignacion.update({
          where: { id: consignacionId },
          data: { estado: "CERRADA" },
        });
      }

      // 6) Retornar liquidación COMPLETA
      return await tx.liquidacion.findUnique({
        where: { id: liquidacionId },
        include: {
          items: { include: { detalle: { include: { producto: true } } } },
          venta: { include: { detalles: true } },
          consignacion: {
            include: { cliente: true, detalles: { include: { producto: true } } },
          },
        },
      });
    });

    // ✅ DISPARAR ALERTAS (Centralizado)
    await processNotificationQueue(notificationsQueue, auth.activeSucursalId);

    return NextResponse.json({ data: result }, { status: 200 });

  } catch (e: any) {
    const msg = String(e?.message || "");
    if (msg === "LIQUIDACION_NO_ENCONTRADA") return NextResponse.json({ error: "No encontrada" }, { status: 404 });
    if (msg === "DETALLE_NO_PERTENECE") return NextResponse.json({ error: "Detalle inválido" }, { status: 400 });
    if (msg.startsWith("EXCEDE_PENDIENTE:")) {
      return NextResponse.json({ error: "Excede el pendiente", detalleId: Number(msg.split(":")[1]) }, { status: 409 });
    }
    console.error(e);
    return NextResponse.json({ error: "Error inesperado" }, { status: 500 });
  }
}