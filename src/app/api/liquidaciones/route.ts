import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/requireAuth";
import { createLiquidacionSchema } from "@/lib/validators/consignacion";
import { notifyStockIfNeeded } from "@/lib/notifyStock";

type RouteParams = { params: Promise<{ id: string }> };

/**
 * GET /api/liquidaciones/:id
 */
export async function GET(_: Request, { params }: RouteParams) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.res;

  const { id: rawId } = await params;
  const id = Number(rawId);

  if (!Number.isFinite(id)) {
    return NextResponse.json({ error: "ID inválido" }, { status: 400 });
  }

  const liquidacion = await prisma.liquidacion.findUnique({
    where: { id },
    include: {
      consignacion: {
        include: {
          cliente: true,
          detalles: { include: { producto: true } },
        },
      },
      items: {
        include: {
          detalle: { include: { producto: true } },
        },
      },
      venta: { include: { detalles: true } },
    },
  });

  if (!liquidacion) {
    return NextResponse.json({ error: "No encontrada" }, { status: 404 });
  }

  return NextResponse.json({ data: liquidacion });
}

/**
 * PUT /api/liquidaciones/:id
 * Corrige una liquidación existente.
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

  const affectedProductIds = new Set<number>();

  try {
    const result = await prisma.$transaction(async (tx) => {
      // 0) Traer liquidación actual completa
      const current = await tx.liquidacion.findUnique({
        where: { id: liquidacionId },
        include: {
          items: { include: { detalle: { include: { producto: true } } } },
          consignacion: {
            include: {
              cliente: true,
              detalles: { include: { producto: true } },
            },
          },
          venta: { include: { detalles: true } },
        },
      });

      if (!current) throw new Error("LIQUIDACION_NO_EXISTE");

      const consignacionId = current.consignacionId;

      // 1) Revertir impactos anteriores
      for (const it of current.items) {
        const det = it.detalle;

        const vendidasPrev = it.unitsVendidas ?? 0;
        const devueltasPrev = it.unitsDevueltas ?? 0;

        await tx.consignacionDetalle.update({
          where: { id: det.id },
          data: {
            unitsVendidasAcum: { decrement: vendidasPrev },
            unitsDevueltasAcum: { decrement: devueltasPrev },
          },
        });

        await tx.producto.update({
          where: { id: det.productoId },
          data: {
            stockConsignadoUnits: { increment: vendidasPrev + devueltasPrev },
            ...(devueltasPrev > 0 ? { stockDisponibleUnits: { decrement: devueltasPrev } } : {}),
          },
        });

        affectedProductIds.add(det.productoId);
      }

      // Revertir venta y saldo
      if (current.venta) {
        const totalPrev = Number(current.venta.total);

        await tx.ventaDetalle
          .deleteMany({ where: { ventaId: current.venta.id } })
          .catch(() => null);

        await tx.venta.delete({ where: { id: current.venta.id } });

        await tx.cliente.update({
          where: { id: current.consignacion.clienteId },
          data: { saldoCuenta: { decrement: totalPrev } },
        });
      }

      // 2) Validar nuevos items contra pendiente REAL (leyendo DB)
      const consignacion = current.consignacion;
      const detallesMap = new Map(consignacion.detalles.map((d) => [d.id, d]));

      let totalVenta = 0;
      const soldByProduct = new Map<number, { units: number; precioUnitario: number }>();

      for (const it of parsed.data.items) {
        const det = detallesMap.get(it.consignacionDetalleId);
        if (!det) throw new Error("DETALLE_NO_PERTENECE");

        const vendidas = it.unitsVendidas ?? 0;
        const devueltas = it.unitsDevueltas ?? 0;

        if (vendidas === 0 && devueltas === 0) throw new Error("ITEM_VACIO");

        // ✅ pendiente REAL (después de la reversión)
        const freshDet = await tx.consignacionDetalle.findUniqueOrThrow({
          where: { id: det.id },
        });

        const pendiente =
          freshDet.unitsEntregadas - freshDet.unitsVendidasAcum - freshDet.unitsDevueltasAcum;

        if (vendidas + devueltas > pendiente) {
          throw new Error(`EXCEDE_PENDIENTE:${det.id}`);
        }

        const precioUnit = Number(det.producto.precioVenta);
        if (vendidas > 0) {
          totalVenta += vendidas * precioUnit;

          const prev = soldByProduct.get(det.productoId);
          soldByProduct.set(det.productoId, {
            units: (prev?.units ?? 0) + vendidas,
            precioUnitario: precioUnit,
          });
        }

        affectedProductIds.add(det.productoId);
      }

      // 3) Reemplazar items
      await tx.liquidacionItem.deleteMany({ where: { liquidacionId } });

      await tx.liquidacionItem.createMany({
        data: parsed.data.items.map((it) => {
          const det = detallesMap.get(it.consignacionDetalleId)!;
          return {
            liquidacionId,
            consignacionDetalleId: it.consignacionDetalleId,
            unitsVendidas: it.unitsVendidas ?? 0,
            unitsDevueltas: it.unitsDevueltas ?? 0,
            precioUnitario: det.producto.precioVenta,
          };
        }),
      });

      // 4) Aplicar impactos nuevos
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

        await tx.producto.update({
          where: { id: det.productoId },
          data: {
            stockConsignadoUnits: { decrement: vendidas + devueltas },
            ...(devueltas > 0 ? { stockDisponibleUnits: { increment: devueltas } } : {}),
          },
        });
      }

      // 5) Re-crear venta si corresponde
      let venta = null;
      if (totalVenta > 0) {
        venta = await tx.venta.create({
          data: {
            clienteId: consignacion.clienteId,
            liquidacionId,
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
          include: { detalles: true },
        });

        await tx.cliente.update({
          where: { id: consignacion.clienteId },
          data: { saldoCuenta: { increment: totalVenta } },
        });
      }

      // 6) Recalcular cierre
      const detallesFinales = await tx.consignacionDetalle.findMany({
        where: { consignacionId },
      });

      const quedaPendiente = detallesFinales.some(
        (d) => d.unitsEntregadas - d.unitsVendidasAcum - d.unitsDevueltasAcum > 0
      );

      await tx.consignacion.update({
        where: { id: consignacionId },
        data: { estado: quedaPendiente ? "ABIERTA" : "CERRADA" },
      });

      // 7) devolver liquidación actualizada (con includes)
      const updated = await tx.liquidacion.findUnique({
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

      return {
        liquidacion: updated,
        venta,
        totalVenta,
        consignacionCerrada: !quedaPendiente,
      };
    });

    // fuera de transacción: notificar stock
    for (const pid of affectedProductIds) {
      await notifyStockIfNeeded(pid);
    }

    return NextResponse.json({ data: result }, { status: 200 });
  } catch (e: any) {
    const msg = String(e?.message || "");

    if (msg === "LIQUIDACION_NO_EXISTE") {
      return NextResponse.json({ error: "Liquidación no existe" }, { status: 404 });
    }
    if (msg === "DETALLE_NO_PERTENECE") {
      return NextResponse.json({ error: "Detalle no pertenece a la consignación" }, { status: 400 });
    }
    if (msg === "ITEM_VACIO") {
      return NextResponse.json({ error: "Cada item debe tener vendidas o devueltas" }, { status: 400 });
    }
    if (msg.startsWith("EXCEDE_PENDIENTE:")) {
      return NextResponse.json(
        { error: "Vendidas + devueltas excede lo pendiente", detalleId: Number(msg.split(":")[1]) },
        { status: 409 }
      );
    }

    console.error("Liquidaciones PUT error:", e);
    return NextResponse.json({ error: "Error inesperado" }, { status: 500 });
  }
}
