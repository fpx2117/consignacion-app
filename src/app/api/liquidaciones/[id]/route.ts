
//src/app/api/liquidaciones/[id]/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/requireAuth";
import { createLiquidacionBodySchema } from "@/lib/validators/liquidacion";
import { notifyStockIfNeeded } from "@/lib/notifyStock";

// Corrección de tipos para Next.js 15+
type RouteParams = {
  params: Promise<{ id: string }>;
};

/**
 * GET /api/liquidaciones/[id]
 * Obtener una liquidación específica
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
          detalle: { include: { producto: true } },
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
 * PUT /api/liquidaciones/[id]
 * Corregir una liquidación existente (reversa + aplica nuevo)
 *
 * Body esperado:
 * {
 *   items: [{ consignacionDetalleId, unitsVendidas, unitsDevueltas }]
 * }
 *
 * NOTA: consignacionId NO va en el body (sale de la liquidación existente).
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

  const affectedProductIds = new Set<number>();

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

      // 1) Revertir items anteriores
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

      // Revertir venta y saldo
      if (liqExistente.venta) {
        await tx.cliente.update({
          where: { id: liqExistente.consignacion.clienteId },
          data: { saldoCuenta: { decrement: liqExistente.venta.total } },
        });
        await tx.venta.delete({ where: { id: liqExistente.venta.id } });
      }

      // Borrar items viejos de la liquidación
      await tx.liquidacionItem.deleteMany({ where: { liquidacionId } });

      // 2) Preparar nuevos datos
      const detallesMap = new Map(
        liqExistente.consignacion.detalles.map((d) => [d.id, d])
      );

      let nuevoTotalVenta = 0;
      const soldByProduct = new Map<number, { units: number; precioUnitario: number }>();

      // Validar stock pendiente REAL
      for (const it of parsed.data.items) {
        const det = detallesMap.get(it.consignacionDetalleId);
        if (!det) throw new Error("DETALLE_NO_PERTENECE");

        const vendidas = it.unitsVendidas ?? 0;
        const devueltas = it.unitsDevueltas ?? 0;

        const freshDet = await tx.consignacionDetalle.findUniqueOrThrow({
          where: { id: det.id },
        });

        const pendiente =
          freshDet.unitsEntregadas - freshDet.unitsVendidasAcum - freshDet.unitsDevueltasAcum;

        if (vendidas + devueltas > pendiente) {
          throw new Error(`EXCEDE_PENDIENTE:${det.id}`);
        }

        affectedProductIds.add(det.productoId);

        // OJO: acá vos venías usando precioVenta del producto.
        // Si querés usar el precio fijado en consignación, reemplazá por freshDet.precioUnitario si existe.
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

        // Aplicar nuevo stock
        await tx.producto.update({
          where: { id: det.productoId },
          data: {
            stockConsignadoUnits: { decrement: vendidas + devueltas },
            ...(devueltas > 0 ? { stockDisponibleUnits: { increment: devueltas } } : {}),
          },
        });
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

      // 6) Retornar liquidación COMPLETA para actualizar UI
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
        venta: nuevaVenta,
        totalVenta: nuevoTotalVenta,
        cerrada: !quedaPendiente,
      };
    });

    for (const pid of affectedProductIds) {
      await notifyStockIfNeeded(pid);
    }

    return NextResponse.json({ data: result }, { status: 200 });
  } catch (e: any) {
    const msg = String(e?.message || "");
    if (msg === "LIQUIDACION_NO_ENCONTRADA") {
      return NextResponse.json({ error: "No encontrada" }, { status: 404 });
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
    console.error(e);
    return NextResponse.json({ error: "Error inesperado" }, { status: 500 });
  }
}
