import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/requireAuth";
import { createLiquidacionSchema } from "@/lib/validators/consignacion";
import { notifyStockIfNeeded } from "@/lib/notifyStock";
import { z } from "zod";

type RouteParams = { params: Promise<{ id: string }> };

/**
 * Esquema para actualizar la estructura base de la consignación
 */
const updateConsignacionSchema = z.object({
  items: z.array(
    z.object({
      productoId: z.number().int().positive(),
      unitsEntregadas: z.number().int().nonnegative(),
    })
  ).min(1),
});

/**
 * GET: Obtener el detalle de una consignación específica
 */
export async function GET(_: Request, { params }: RouteParams) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.res;

  const { id: rawId } = await params;
  const id = Number(rawId);

  if (!Number.isFinite(id)) {
    return NextResponse.json({ error: "ID inválido" }, { status: 400 });
  }

  const consignacion = await prisma.consignacion.findUnique({
    where: { id },
    include: {
      cliente: true,
      detalles: { include: { producto: true } },
      liquidaciones: {
        orderBy: { id: "desc" },
        include: {
          items: {
            include: {
              detalle: { include: { producto: true } },
            },
          },
          venta: { include: { detalles: true } },
        },
      },
    },
  });

  if (!consignacion) {
    return NextResponse.json({ error: "No encontrada" }, { status: 404 });
  }

  return NextResponse.json({ data: consignacion });
}

/**
 * PUT: Corregir estructura base (Unidades Entregadas)
 * Este método ajusta el stock disponible y consignado sin afectar ventas.
 */
export async function PUT(req: Request, { params }: RouteParams) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.res;

  const { id: rawId } = await params;
  const consignacionId = Number(rawId);

  if (!Number.isFinite(consignacionId)) {
    return NextResponse.json({ error: "ID inválido" }, { status: 400 });
  }

  const body = await req.json().catch(() => null);
  const parsed = updateConsignacionSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Validación fallida", details: parsed.error.flatten() }, { status: 400 });
  }

  const affectedProductIds = new Set<number>();

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

      // 1. Procesar cada item del payload
      for (const item of newItems) {
        affectedProductIds.add(item.productoId);
        const oldDet = oldDetalles.get(item.productoId);
        
        // Unidades que ya fueron liquidadas (vendidas + devueltas)
        const yaProcesado = oldDet ? (oldDet.unitsVendidasAcum + oldDet.unitsDevueltasAcum) : 0;
        
        if (item.unitsEntregadas < yaProcesado) {
          throw new Error(`Las unidades entregadas del producto ${item.productoId} no pueden ser menores a lo ya liquidado (${yaProcesado})`);
        }

        const deltaEntregadas = item.unitsEntregadas - (oldDet?.unitsEntregadas ?? 0);

        // Si aumentamos entregadas, verificar stock disponible físico
        if (deltaEntregadas > 0) {
          const producto = await tx.producto.findUnique({ where: { id: item.productoId } });
          if (!producto || producto.stockDisponibleUnits < deltaEntregadas) {
            throw new Error(`Stock insuficiente para producto ${item.productoId}`);
          }
        }

        // Ajustar Stock Global
        await tx.producto.update({
          where: { id: item.productoId },
          data: {
            stockDisponibleUnits: { decrement: deltaEntregadas },
            stockConsignadoUnits: { increment: deltaEntregadas }
          }
        });

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

      // 2. Eliminar productos que ya no están en la lista (si no tienen movimientos)
      const newProductIds = new Set(newItems.map(i => i.productoId));
      for (const [prodId, oldDet] of oldDetalles.entries()) {
        if (!newProductIds.has(prodId)) {
          if ((oldDet.unitsVendidasAcum + oldDet.unitsDevueltasAcum) > 0) {
            throw new Error(`No se puede eliminar el producto ${prodId} porque ya tiene liquidaciones`);
          }

          // Devolver stock al eliminar de la consignación
          await tx.producto.update({
            where: { id: prodId },
            data: {
              stockDisponibleUnits: { increment: oldDet.unitsEntregadas },
              stockConsignadoUnits: { decrement: oldDet.unitsEntregadas }
            }
          });

          await tx.consignacionDetalle.delete({ where: { id: oldDet.id } });
          affectedProductIds.add(prodId);
        }
      }

      return await tx.consignacion.findUnique({
        where: { id: consignacionId },
        include: { detalles: { include: { producto: true } } }
      });
    });

    // Notificar stock fuera de la tx
    for (const pid of affectedProductIds) await notifyStockIfNeeded(pid);

    return NextResponse.json({ data: updated });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Error al actualizar" }, { status: 400 });
  }
}

/**
 * POST: Crear una liquidación para esta consignación
 */
export async function POST(req: Request, { params }: RouteParams) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.res;

  const { id: rawId } = await params;
  const consignacionId = Number(rawId);

  if (!Number.isFinite(consignacionId)) {
    return NextResponse.json({ error: "ID inválido" }, { status: 400 });
  }

  const body = await req.json().catch(() => null);
  const parsed = createLiquidacionSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Validación fallida", details: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const consignacion = await tx.consignacion.findUnique({
        where: { id: consignacionId },
        include: { cliente: true, detalles: { include: { producto: true } } },
      });

      if (!consignacion) throw new Error("CONSIGNACION_NO_EXISTE");
      if (consignacion.estado === "CERRADA") throw new Error("CONSIGNACION_CERRADA");

      const detallesMap = new Map(consignacion.detalles.map((d) => [d.id, d]));
      let totalVenta = 0;
      const soldByProduct = new Map<number, { units: number; precioUnitario: number }>();

      for (const it of parsed.data.items) {
        const det = detallesMap.get(it.consignacionDetalleId);
        if (!det) throw new Error("DETALLE_NO_PERTENECE");

        const vendidas = it.unitsVendidas ?? 0;
        const devueltas = it.unitsDevueltas ?? 0;
        if (vendidas === 0 && devueltas === 0) throw new Error("ITEM_VACIO");

        const pendiente = det.unitsEntregadas - det.unitsVendidasAcum - det.unitsDevueltasAcum;
        if (vendidas + devueltas > pendiente) throw new Error(`EXCEDE_PENDIENTE:${det.id}`);

        const precioUnit = Number(det.producto.precioVenta);
        if (vendidas > 0) {
          totalVenta += vendidas * precioUnit;
          const prev = soldByProduct.get(det.productoId);
          soldByProduct.set(det.productoId, { 
            units: (prev?.units ?? 0) + vendidas, 
            precioUnitario: precioUnit 
          });
        }
      }

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
              };
            }),
          },
        },
      });

      for (const it of parsed.data.items) {
        const det = detallesMap.get(it.consignacionDetalleId)!;
        await tx.consignacionDetalle.update({
          where: { id: det.id },
          data: {
            unitsVendidasAcum: { increment: it.unitsVendidas ?? 0 },
            unitsDevueltasAcum: { increment: it.unitsDevueltas ?? 0 },
          },
        });

        await tx.producto.update({
          where: { id: det.productoId },
          data: {
            stockConsignadoUnits: { decrement: (it.unitsVendidas ?? 0) + (it.unitsDevueltas ?? 0) },
            ...(it.unitsDevueltas && it.unitsDevueltas > 0 ? { stockDisponibleUnits: { increment: it.unitsDevueltas } } : {}),
          },
        });
      }

      if (totalVenta > 0) {
        await tx.venta.create({
          data: {
            clienteId: consignacion.clienteId,
            liquidacionId: liquidacion.id,
            total: totalVenta,
            detalles: {
              create: Array.from(soldByProduct.entries()).map(([productoId, info]) => ({
                productoId,
                units: info.units,
                precioUnitario: info.precioUnitario,
                subtotal: info.units * info.precioUnitario,
              })),
            },
          },
        });

        await tx.cliente.update({
          where: { id: consignacion.clienteId },
          data: { saldoCuenta: { increment: totalVenta } },
        });
      }

      const detallesFinales = await tx.consignacionDetalle.findMany({ where: { consignacionId } });
      const cerrada = !detallesFinales.some(d => (d.unitsEntregadas - d.unitsVendidasAcum - d.unitsDevueltasAcum) > 0);
      if (cerrada) await tx.consignacion.update({ where: { id: consignacionId }, data: { estado: "CERRADA" } });

      return { liquidacion, cerrada };
    });

    return NextResponse.json({ data: result }, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Error inesperado" }, { status: 400 });
  }
}