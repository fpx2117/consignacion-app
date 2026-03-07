/* eslint-disable */
// @ts-nocheck
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/requireAuth";
import { createLiquidacionSchema } from "@/lib/validators/consignacion";
import { z } from "zod";
import { TipoMovimientoStock, MotivoMovimientoStock } from "@prisma/client";

// âœ… Imports Centralizados de Config y Notificaciones
import { obtenerConfiguracionGlobal } from "@/lib/config";
import { evaluateStockAlert, processNotificationQueue } from "@/lib/stock-alerts";

type RouteParams = { params: Promise<{ id: string }> };

const updateConsignacionSchema = z.object({
  items: z.array(
    z.object({
      productoId: z.number().int().positive(),
      unitsEntregadas: z.number().int().nonnegative(),
    })
  ).min(1),
});

/**
 * GET: Obtener el detalle de una consignaciÃ³n especÃ­fica
 */
export async function GET(_: Request, { params }: RouteParams) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.res;

  const { id: rawId } = await params;
  const id = Number(rawId);

  if (!Number.isFinite(id)) return NextResponse.json({ error: "ID invÃ¡lido" }, { status: 400 });

  const consignacion = await prisma.consignacion.findUnique({
    where: { id },
    include: {
      cliente: true,
      detalles: { include: { producto: { include: { subcategoria: true } } } },
      liquidaciones: {
        orderBy: { id: "desc" },
        include: {
          items: {
            include: { detalle: { include: { producto: { include: { subcategoria: true } } } } },
          },
          venta: { include: { detalles: true } },
        },
      },
    },
  });

  if (!consignacion) return NextResponse.json({ error: "No encontrada" }, { status: 404 });

  return NextResponse.json({ data: consignacion });
}

/**
 * PUT: Corregir estructura base (Ajuste Manual)
 */
export async function PUT(req: Request, { params }: RouteParams) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.res;

  const { id: rawId } = await params;
  const consignacionId = Number(rawId);

  if (!Number.isFinite(consignacionId)) return NextResponse.json({ error: "ID invÃ¡lido" }, { status: 400 });

  const body = await req.json().catch(() => null);
  const parsed = updateConsignacionSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "ValidaciÃ³n fallida", details: parsed.error.flatten() }, { status: 400 });
  }

  // âœ… 1. Cola de Alertas
  const configGlobal = await obtenerConfiguracionGlobal();
  const notificationsQueue: any[] = [];

  try {
    const updated = await prisma.$transaction(async (tx) => {
      const consignacion = await tx.consignacion.findUnique({
        where: { id: consignacionId },
        include: { detalles: true },
      });

      if (!consignacion) throw new Error("CONSIGNACION_NO_EXISTE");
      if (consignacion.estado === "CERRADA") throw new Error("CONSIGNACION_CERRADA");

      const oldDetalles = new Map(consignacion.detalles.map(d => [d.productoId, d]));
      const newItems = parsed.data.items;

      // 1. Procesar cada item del payload (Ajustes hacia arriba o abajo)
      for (const item of newItems) {
        const oldDet = oldDetalles.get(item.productoId);
        const yaProcesado = oldDet ? (oldDet.unitsVendidasAcum + oldDet.unitsDevueltasAcum) : 0;

        if (item.unitsEntregadas < yaProcesado) {
          throw new Error(`Las unidades entregadas del producto ${item.productoId} no pueden ser menores a lo ya liquidado (${yaProcesado})`);
        }

        const deltaEntregadas = item.unitsEntregadas - (oldDet?.unitsEntregadas ?? 0);

        if (deltaEntregadas !== 0) {
          const sucursalId = consignacion.sucursalId; // Usamos la sucursal de la consignaciÃ³n

          // 1. Obtener stock de la sucursal
          const sAntes = await tx.stockSucursal.findUnique({
            where: { productoId_sucursalId: { productoId: item.productoId, sucursalId } },
            include: { producto: true }
          });

          if (!sAntes) throw new Error(`El producto ${item.productoId} no estÃ¡ asignado a la sucursal de la consignaciÃ³n.`);

          if (deltaEntregadas > 0 && sAntes.stockDisponibleUnits < deltaEntregadas) {
            throw new Error(`Stock insuficiente para producto ${sAntes.producto.nombre} en esta sucursal.`);
          }

          // 2. Ajustar Stock en Sucursal
          const sDespues = await tx.stockSucursal.update({
            where: { id: sAntes.id },
            data: {
              stockDisponibleUnits: { decrement: deltaEntregadas },
              stockConsignadoUnits: { increment: deltaEntregadas }
            }
          });

          // 3. Sincronizar Stock Global
          const productoDespues = await tx.producto.update({
            where: { id: item.productoId },
            data: {
              stockDisponibleUnits: { decrement: deltaEntregadas },
              stockConsignadoUnits: { increment: deltaEntregadas }
            }
          });

          // âœ… REGISTRO DE AUDITORÃA (AJUSTE)
          await tx.movimientoStock.create({
            data: {
              productoId: item.productoId,
              sucursalId,
              tipo: deltaEntregadas > 0 ? TipoMovimientoStock.SALIDA : TipoMovimientoStock.ENTRADA,
              motivo: deltaEntregadas > 0 ? MotivoMovimientoStock.AJUSTE_NEGATIVO : MotivoMovimientoStock.AJUSTE_POSITIVO,
              cantidad: Math.abs(deltaEntregadas),
              stockPrevio: sAntes.stockDisponibleUnits,
              stockPosterior: sDespues.stockDisponibleUnits,
              observaciones: `Ajuste manual ConsignaciÃ³n #${consignacionId}`
            }
          });

          // Evaluar alertas
          const alerta = evaluateStockAlert(productoDespues, configGlobal);
          if (alerta) notificationsQueue.push(alerta);
        }

        // Crear o Actualizar detalle
        if (oldDet) {
          await tx.consignacionDetalle.update({
            where: { id: oldDet.id },
            data: { unitsEntregadas: item.unitsEntregadas }
          });
        } else {
          await tx.consignacionDetalle.create({
            data: {
              consignacionId,
              productoId: item.productoId,
              unitsEntregadas: item.unitsEntregadas,
              unitsVendidasAcum: 0,
              unitsDevueltasAcum: 0
            }
          });
        }
      }

      // 2. Eliminar productos que ya no estÃ¡n en la lista
      const newProductIds = new Set(newItems.map(i => i.productoId));
      for (const [prodId, oldDet] of oldDetalles.entries()) {
        if (!newProductIds.has(prodId)) {
          if ((oldDet.unitsVendidasAcum + oldDet.unitsDevueltasAcum) > 0) {
            throw new Error(`No se puede eliminar el producto ${prodId} porque ya tiene liquidaciones`);
          }

          const sucursalId = consignacion.sucursalId;

          // 1. Obtener stock de la sucursal
          const sAntes = await tx.stockSucursal.findUnique({
            where: { productoId_sucursalId: { productoId: prodId, sucursalId } }
          });

          // 2. Devolver stock al almacÃ©n de la sucursal
          const sDespues = await tx.stockSucursal.update({
            where: { id: sAntes!.id },
            data: {
              stockDisponibleUnits: { increment: oldDet.unitsEntregadas },
              stockConsignadoUnits: { decrement: oldDet.unitsEntregadas }
            }
          });

          // 3. Sincronizar stock global
          const productoDespues = await tx.producto.update({
            where: { id: prodId },
            data: {
              stockDisponibleUnits: { increment: oldDet.unitsEntregadas },
              stockConsignadoUnits: { decrement: oldDet.unitsEntregadas }
            }
          });

          // âœ… AUDITORÃA: REVERSO DE CONSIGNACIÃ“N
          await tx.movimientoStock.create({
            data: {
              productoId: prodId,
              sucursalId,
              tipo: TipoMovimientoStock.ENTRADA,
              motivo: MotivoMovimientoStock.AJUSTE_POSITIVO,
              cantidad: oldDet.unitsEntregadas,
              stockPrevio: sAntes!.stockDisponibleUnits,
              stockPosterior: sDespues.stockDisponibleUnits,
              observaciones: `Eliminado de ConsignaciÃ³n #${consignacionId}`
            }
          });

          await tx.consignacionDetalle.delete({ where: { id: oldDet.id } });
        }
      }

      return await tx.consignacion.findUnique({
        where: { id: consignacionId },
        include: { detalles: { include: { producto: { include: { subcategoria: true } } } } }
      });
    });

    // âœ… DISPARAR ALERTAS
    await processNotificationQueue(notificationsQueue, auth.activeSucursalId);

    return NextResponse.json({ data: updated });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Error al actualizar" }, { status: 400 });
  }
}

/**
 * POST: Crear una liquidaciÃ³n para esta consignaciÃ³n
 */
export async function POST(req: Request, { params }: RouteParams) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.res;

  const { id: rawId } = await params;
  const consignacionId = Number(rawId);

  if (!Number.isFinite(consignacionId)) return NextResponse.json({ error: "ID invÃ¡lido" }, { status: 400 });

  const body = await req.json().catch(() => null);
  const parsed = createLiquidacionSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "ValidaciÃ³n fallida", details: parsed.error.flatten() }, { status: 400 });
  }

  // âœ… 1. Cola de Alertas
  const configGlobal = await obtenerConfiguracionGlobal();
  const notificationsQueue: any[] = [];

  try {
    const result = await prisma.$transaction(async (tx) => {
      const consignacion = await tx.consignacion.findUnique({
        where: { id: consignacionId },
        include: { cliente: true, detalles: { include: { producto: { include: { subcategoria: true } } } } },
      });

      if (!consignacion) throw new Error("CONSIGNACION_NO_EXISTE");
      if (consignacion.estado === "CERRADA") throw new Error("CONSIGNACION_CERRADA");

      const detallesMap = new Map(consignacion.detalles.map((d) => [d.id, d]));
      let totalVenta = 0;
      const soldByProduct = new Map<number, { units: number; precioUnitario: number; descuento: number }>();

      // A) CÃ¡lculos previos
      for (const it of parsed.data.items) {
        const det = detallesMap.get(it.consignacionDetalleId);
        if (!det) throw new Error("DETALLE_NO_PERTENECE");

        const vendidas = it.unitsVendidas ?? 0;
        const devueltas = it.unitsDevueltas ?? 0;
        if (vendidas === 0 && devueltas === 0) throw new Error("ITEM_VACIO");

        const pendiente = det.unitsEntregadas - det.unitsVendidasAcum - det.unitsDevueltasAcum;
        if (vendidas + devueltas > pendiente) throw new Error(`EXCEDE_PENDIENTE:${det.id}`);

        const precioUnit = Number(det.producto.precioVenta);
        const discountItem = Number(it.descuento || 0);

        if (vendidas > 0) {
          totalVenta += (vendidas * precioUnit) - discountItem;
          const prev = soldByProduct.get(det.productoId);
          soldByProduct.set(det.productoId, {
            units: (prev?.units ?? 0) + vendidas,
            precioUnitario: precioUnit,
            descuento: (prev?.descuento ?? 0) + discountItem
          });
        }
      }

      // B) Crear LiquidaciÃ³n Cabecera
      const liquidacion = await tx.liquidacion.create({
        data: {
          consignacionId,
          items: {
            create: parsed.data.items.map((it) => {
              const det = detallesMap.get(it.consignacionDetalleId)!;
              return {
                consignacionDetalleId: it.consignacionDetalleId,
                unitsVendidas: it.unitsVendidas ?? 0,
                unitsDevueltas: it.unitsDevueltas ?? 0,
                precioUnitario: det.producto.precioVenta,
                descuento: Number(it.descuento || 0),
              };
            }),
          },
        },
      });

      // C) Aplicar LiquidaciÃ³n (Stock y AuditorÃ­a)
      for (const it of parsed.data.items) {
        const det = detallesMap.get(it.consignacionDetalleId)!;
        const vendidas = it.unitsVendidas ?? 0;
        const devueltas = it.unitsDevueltas ?? 0;

        await tx.consignacionDetalle.update({
          where: { id: det.id },
          data: {
            unitsVendidasAcum: { increment: vendidas },
            unitsDevueltasAcum: { increment: devueltas },
          },
        });

        const sucursalId = consignacion.sucursalId;

        // 1. Obtener stock de la sucursal
        const sAntes = await tx.stockSucursal.findUnique({
          where: { productoId_sucursalId: { productoId: det.productoId, sucursalId } }
        });

        // 2. Actualizar Stock en Sucursal
        const sDespues = await tx.stockSucursal.update({
          where: { id: sAntes!.id },
          data: {
            stockConsignadoUnits: { decrement: vendidas + devueltas },
            ...(devueltas > 0 ? { stockDisponibleUnits: { increment: devueltas } } : {}),
          },
        });

        // 3. Sincronizar Stock Global
        const productoDespues = await tx.producto.update({
          where: { id: det.productoId },
          data: {
            stockConsignadoUnits: { decrement: vendidas + devueltas },
            ...(devueltas > 0 ? { stockDisponibleUnits: { increment: devueltas } } : {}),
          },
        });

        // âœ… AUDITORÃA: SI DEVOLVIÃ“ ALGO (Entra al almacÃ©n de la sucursal)
        if (devueltas > 0) {
          await tx.movimientoStock.create({
            data: {
              productoId: det.productoId,
              sucursalId,
              tipo: TipoMovimientoStock.ENTRADA,
              motivo: MotivoMovimientoStock.DEVOLUCION_CLIENTE,
              cantidad: devueltas,
              stockPrevio: sAntes!.stockDisponibleUnits,
              stockPosterior: sDespues.stockDisponibleUnits,
              observaciones: `DevoluciÃ³n s/ConsignaciÃ³n #${consignacionId}`
            }
          });
        }

        // âœ… AUDITORÃA: SI VENDIÃ“ ALGO (Sale definitivamente de la sucursal)
        if (vendidas > 0) {
          await tx.movimientoStock.create({
            data: {
              productoId: det.productoId,
              sucursalId,
              tipo: TipoMovimientoStock.SALIDA,
              motivo: MotivoMovimientoStock.VENTA,
              cantidad: vendidas,
              stockPrevio: sAntes!.stockDisponibleUnits,
              stockPosterior: sDespues.stockDisponibleUnits,
              observaciones: `Venta Liquidada s/ConsignaciÃ³n #${consignacionId}`
            }
          });
        }

        // Evaluar alertas (Aunque el stock devuelto suma, si estÃ¡ muy bajo avisa)
        const alerta = evaluateStockAlert(productoDespues, configGlobal);
        if (alerta) notificationsQueue.push(alerta);
      }

      // D) Crear Venta Asociada si hubo ventas
      if (totalVenta > 0) {
        await tx.venta.create({
          data: {
            clienteId: consignacion.clienteId,
            liquidacionId: liquidacion.id,
            total: totalVenta,
            sucursalId: consignacion.sucursalId,
            tipo: "LIQUIDACION",
            detalles: {
              create: Array.from(soldByProduct.entries()).map(([productoId, info]) => ({
                productoId,
                units: info.units,
                precioUnitario: info.precioUnitario,
                descuento: info.descuento,
                subtotal: (info.units * info.precioUnitario) - info.descuento,
              })),
            },
          },
        });

        await tx.cliente.update({
          where: { id: consignacion.clienteId },
          data: { saldoCuenta: { increment: totalVenta } },
        });
      }

      // E) Cerrar si estÃ¡ terminada
      const detallesFinales = await tx.consignacionDetalle.findMany({ where: { consignacionId } });
      const cerrada = !detallesFinales.some(d => (d.unitsEntregadas - d.unitsVendidasAcum - d.unitsDevueltasAcum) > 0);
      if (cerrada) await tx.consignacion.update({ where: { id: consignacionId }, data: { estado: "CERRADA" } });

      return { liquidacion, cerrada };
    });

    // âœ… DISPARAR ALERTAS
    await processNotificationQueue(notificationsQueue, auth.activeSucursalId);

    return NextResponse.json({ data: result }, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Error inesperado" }, { status: 400 });
  }
}
