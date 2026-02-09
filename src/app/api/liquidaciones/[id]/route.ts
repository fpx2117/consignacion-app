import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/requireAuth";
import { createLiquidacionSchema } from "@/lib/validators/consignacion";
import { notifyStockIfNeeded } from "@/lib/notifyStock";

type RouteParams = { params: Promise<{ id: string }> };

/**
 * GET /api/liquidaciones/:id
 * Obtener una liquidación con todo lo necesario para editar
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
      items: {
        include: {
          detalle: { include: { producto: true } }, // <- clave para tu page
        },
      },
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
 * PUT /api/liquidaciones/:id
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
  const parsed = createLiquidacionSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validación fallida", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  // para notificar al final
  const affectedProductIds = new Set<number>();

  try {
    const result = await prisma.$transaction(async (tx) => {
      // 1) buscar liquidación existente con trazabilidad
      const liqExistente = await tx.liquidacion.findUnique({
        where: { id: liquidacionId },
        include: {
          items: true,
          venta: true,
          consignacion: {
            include: { cliente: true, detalles: { include: { producto: true } } },
          },
        },
      });

      if (!liqExistente) throw new Error("LIQUIDACION_NO_ENCONTRADA");

      const consignacionId = liqExistente.consignacionId;

      // 2) reabrir si estaba cerrada (para recalcular)
      if (liqExistente.consignacion.estado === "CERRADA") {
        await tx.consignacion.update({
          where: { id: consignacionId },
          data: { estado: "ABIERTA" },
        });
      }

      // 3) REVERTIR efectos de liquidación anterior
      for (const item of liqExistente.items) {
        const det = liqExistente.consignacion.detalles.find(
          (d) => d.id === item.consignacionDetalleId
        );
        if (!det) continue;

        affectedProductIds.add(det.productoId);

        await tx.consignacionDetalle.update({
          where: { id: item.consignacionDetalleId },
          data: {
            unitsVendidasAcum: { decrement: item.unitsVendidas },
            unitsDevueltasAcum: { decrement: item.unitsDevueltas },
          },
        });

        await tx.producto.update({
          where: { id: det.productoId },
          data: {
            stockConsignadoUnits: { increment: item.unitsVendidas + item.unitsDevueltas },
            ...(item.unitsDevueltas > 0
              ? { stockDisponibleUnits: { decrement: item.unitsDevueltas } }
              : {}),
          },
        });
      }

      // revertir saldo y borrar venta si existía
      if (liqExistente.venta) {
        await tx.cliente.update({
          where: { id: liqExistente.consignacion.clienteId },
          data: { saldoCuenta: { decrement: liqExistente.venta.total } },
        });
        await tx.venta.delete({ where: { id: liqExistente.venta.id } });
      }

      // 4) borrar items viejos de la liquidación
      await tx.liquidacionItem.deleteMany({ where: { liquidacionId } });

      // 5) aplicar NUEVA liquidación (con validación por pendiente actualizado)
      const detallesMap = new Map(
        liqExistente.consignacion.detalles.map((d) => [d.id, d])
      );

      let nuevoTotalVenta = 0;
      const soldByProduct = new Map<number, { units: number; precioUnitario: number }>();

      for (const it of parsed.data.items) {
        const det = detallesMap.get(it.consignacionDetalleId);
        if (!det) throw new Error("DETALLE_NO_PERTENECE");

        const vendidas = it.unitsVendidas ?? 0;
        const devueltas = it.unitsDevueltas ?? 0;

        // pendiente REAL después de revertir
        const freshDet = await tx.consignacionDetalle.findUniqueOrThrow({
          where: { id: det.id },
        });

        const pendiente =
          freshDet.unitsEntregadas - freshDet.unitsVendidasAcum - freshDet.unitsDevueltasAcum;

        if (vendidas + devueltas > pendiente) {
          throw new Error(`EXCEDE_PENDIENTE:${det.id}`);
        }

        affectedProductIds.add(det.productoId);

        const precioUnit = Number(det.producto.precioVenta);
        if (vendidas > 0) {
          nuevoTotalVenta += vendidas * precioUnit;
          const prev = soldByProduct.get(det.productoId);
          soldByProduct.set(det.productoId, {
            units: (prev?.units ?? 0) + vendidas,
            precioUnitario: precioUnit,
          });
        }

        // actualizar acumulados
        await tx.consignacionDetalle.update({
          where: { id: det.id },
          data: {
            unitsVendidasAcum: { increment: vendidas },
            unitsDevueltasAcum: { increment: devueltas },
          },
        });

        // actualizar stock
        await tx.producto.update({
          where: { id: det.productoId },
          data: {
            stockConsignadoUnits: { decrement: vendidas + devueltas },
            ...(devueltas > 0 ? { stockDisponibleUnits: { increment: devueltas } } : {}),
          },
        });
      }

      // 6) recrear items dentro de la liquidación
      const liquidacionActualizada = await tx.liquidacion.update({
        where: { id: liquidacionId },
        data: {
          items: {
            create: parsed.data.items.map((it) => ({
              consignacionDetalleId: it.consignacionDetalleId,
              unitsVendidas: it.unitsVendidas ?? 0,
              unitsDevueltas: it.unitsDevueltas ?? 0,
              precioUnitario: detallesMap.get(it.consignacionDetalleId)!.producto.precioVenta,
            })),
          },
        },
        include: {
          items: true,
        },
      });

      // 7) crear nueva venta + saldo
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
        });

        await tx.cliente.update({
          where: { id: liqExistente.consignacion.clienteId },
          data: { saldoCuenta: { increment: nuevoTotalVenta } },
        });
      }

      // 8) cierre automático
      const detallesFinales = await tx.consignacionDetalle.findMany({
        where: { consignacionId },
      });

      const quedaPendiente = detallesFinales.some(
        (d) => d.unitsEntregadas - d.unitsVendidasAcum - d.unitsDevueltasAcum > 0
      );

      if (!quedaPendiente) {
        await tx.consignacion.update({
          where: { id: consignacionId },
          data: { estado: "CERRADA" },
        });
      }

      return {
        liquidacion: liquidacionActualizada,
        venta: nuevaVenta,
        totalVenta: nuevoTotalVenta,
        cerrada: !quedaPendiente,
      };
    });

    // notificaciones fuera de transacción
    for (const pid of affectedProductIds) {
      await notifyStockIfNeeded(pid);
    }

    return NextResponse.json({ data: result }, { status: 200 });
  } catch (e: any) {
    const msg = String(e?.message || "");

    if (msg === "LIQUIDACION_NO_ENCONTRADA") {
      return NextResponse.json({ error: "Liquidación no encontrada" }, { status: 404 });
    }
    if (msg === "DETALLE_NO_PERTENECE") {
      return NextResponse.json({ error: "Detalle inválido" }, { status: 400 });
    }
    if (msg.startsWith("EXCEDE_PENDIENTE:")) {
      return NextResponse.json(
        { error: "Excede el pendiente", detalleId: Number(msg.split(":")[1]) },
        { status: 409 }
      );
    }

    console.error("PUT liquidaciones error:", e);
    return NextResponse.json({ error: "Error inesperado" }, { status: 500 });
  }
}
