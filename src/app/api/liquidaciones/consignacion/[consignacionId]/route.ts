import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/requireAuth";
import { createLiquidacionBodySchema } from "@/lib/validators/liquidacion";
import { TipoMovimientoStock, MotivoMovimientoStock } from "@prisma/client";

// ✅ Imports Centralizados de Config y Notificaciones
import { obtenerConfiguracionGlobal } from "@/lib/config";
import { evaluateStockAlert, processNotificationQueue } from "@/lib/stock-alerts";

type RouteParams = {
  params: Promise<{ consignacionId: string }>;
};

export async function POST(req: Request, { params }: RouteParams) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.res;

  const { consignacionId: rawId } = await params;
  const consignacionId = Number(rawId);

  if (!Number.isFinite(consignacionId)) {
    return NextResponse.json({ error: "consignacionId inválido" }, { status: 400 });
  }

  const body = await req.json().catch(() => null);
  const parsed = createLiquidacionBodySchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Datos inválidos", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { items } = parsed.data;

  // ✅ 1. Cola de Alertas
  const configGlobal = await obtenerConfiguracionGlobal();
  const notificationsQueue: any[] = [];

  try {
    const result = await prisma.$transaction(async (tx) => {
      // 1) Verificar consignación
      const consignacion = await tx.consignacion.findUnique({
        where: { id: consignacionId },
        include: { detalles: { include: { producto: true } } },
      });

      if (!consignacion) throw new Error("CONSIGNACION_NO_ENCONTRADA");
      if (consignacion.estado === "CERRADA") throw new Error("CONSIGNACION_CERRADA");

      const detallesMap = new Map(consignacion.detalles.map((d) => [d.id, d]));
      let totalVenta = 0;
      const soldByProduct = new Map<number, { units: number; precioUnitario: number }>();

      const liquidacionItemsData: {
        consignacionDetalleId: number;
        unitsVendidas: number;
        unitsDevueltas: number;
        precioUnitario: any;
      }[] = [];

      // 2) Procesar items y validar pendiente
      for (const item of items) {
        const det = detallesMap.get(item.consignacionDetalleId);
        if (!det) throw new Error(`DETALLE_NO_PERTENECE:${item.consignacionDetalleId}`);

        const vendidas = item.unitsVendidas ?? 0;
        const devueltas = item.unitsDevueltas ?? 0;

        const pendiente = det.unitsEntregadas - det.unitsVendidasAcum - det.unitsDevueltasAcum;
        if (vendidas + devueltas > pendiente) {
          throw new Error(`EXCEDE_PENDIENTE:${det.id}`);
        }

        // Actualizar acumulados
        await tx.consignacionDetalle.update({
          where: { id: det.id },
          data: {
            unitsVendidasAcum: { increment: vendidas },
            unitsDevueltasAcum: { increment: devueltas },
          },
        });

        // 🟢 CAPTURAR STOCK PREVIO
        const productoAntes = await tx.producto.findUnique({ where: { id: det.productoId } });

        // Actualizar stock producto
        const productoDespues = await tx.producto.update({
          where: { id: det.productoId },
          data: {
            stockConsignadoUnits: { decrement: vendidas + devueltas },
            ...(devueltas > 0 ? { stockDisponibleUnits: { increment: devueltas } } : {}),
          },
        });

        // ✅ AUDITORÍA: SI DEVOLVIÓ ALGO (Entra al almacén)
        if (devueltas > 0) {
          await tx.movimientoStock.create({
            data: {
              productoId: det.productoId,
              tipo: TipoMovimientoStock.ENTRADA,
              motivo: MotivoMovimientoStock.DEVOLUCION_CLIENTE,
              cantidad: devueltas,
              stockPrevio: productoAntes!.stockDisponibleUnits,
              stockPosterior: productoDespues.stockDisponibleUnits,
              observaciones: `Devolución s/Consignación #${consignacionId}`
            }
          });
        }

        // ✅ AUDITORÍA: SI VENDIÓ ALGO (Sale definitivamente)
        if (vendidas > 0) {
          await tx.movimientoStock.create({
            data: {
              productoId: det.productoId,
              tipo: TipoMovimientoStock.SALIDA,
              motivo: MotivoMovimientoStock.VENTA,
              cantidad: vendidas,
              stockPrevio: productoAntes!.stockDisponibleUnits,
              stockPosterior: productoDespues.stockDisponibleUnits,
              observaciones: `Venta Liquidada s/Consignación #${consignacionId}`
            }
          });
        }

        // Evaluar alertas (Si lo devuelto no es suficiente para salir de zona de peligro)
        const alerta = evaluateStockAlert(productoDespues, configGlobal);
        if (alerta) notificationsQueue.push(alerta);

        // ✅ Importante: en tu modelo, el precio de consignación está en detalle.precioUnitario
        const precioUnit = Number(det.precioUnitario ?? det.producto.precioVenta);

        liquidacionItemsData.push({
          consignacionDetalleId: det.id,
          unitsVendidas: vendidas,
          unitsDevueltas: devueltas,
          precioUnitario: precioUnit,
        });

        if (vendidas > 0) {
          totalVenta += vendidas * precioUnit;
          const prev = soldByProduct.get(det.productoId);
          soldByProduct.set(det.productoId, {
            units: (prev?.units ?? 0) + vendidas,
            precioUnitario: precioUnit,
          });
        }
      }

      // 3) Crear liquidación
      const nuevaLiquidacion = await tx.liquidacion.create({
        data: {
          consignacionId,
          items: { create: liquidacionItemsData },
        },
      });

      // 4) Crear venta + saldo si hubo ventas
      if (totalVenta > 0) {
        await tx.venta.create({
          data: {
            clienteId: consignacion.clienteId,
            liquidacionId: nuevaLiquidacion.id,
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

      // 5) Cerrar consignación si ya no queda pendiente
      const detallesActualizados = await tx.consignacionDetalle.findMany({
        where: { consignacionId },
      });

      const todoLiquidado = detallesActualizados.every(
        (d) => d.unitsEntregadas - d.unitsVendidasAcum - d.unitsDevueltasAcum <= 0
      );

      if (todoLiquidado) {
        await tx.consignacion.update({
          where: { id: consignacionId },
          data: { estado: "CERRADA" },
        });
      }

      return nuevaLiquidacion;
    });

    // ✅ DISPARAR ALERTAS (Centralizado)
    await processNotificationQueue(notificationsQueue);

    return NextResponse.json({ data: result }, { status: 201 });
  } catch (e: any) {
    const msg = String(e?.message || "");

    if (msg === "CONSIGNACION_NO_ENCONTRADA") {
      return NextResponse.json({ error: "Consignación no encontrada" }, { status: 404 });
    }
    if (msg === "CONSIGNACION_CERRADA") {
      return NextResponse.json({ error: "La consignación ya está cerrada" }, { status: 409 });
    }
    if (msg.startsWith("DETALLE_NO_PERTENECE:")) {
      return NextResponse.json({ error: "Detalle inválido" }, { status: 400 });
    }
    if (msg.startsWith("EXCEDE_PENDIENTE:")) {
      return NextResponse.json(
        { error: "Excede stock pendiente", detalleId: Number(msg.split(":")[1]) },
        { status: 409 }
      );
    }

    console.error(e);
    return NextResponse.json({ error: "Error procesando liquidación" }, { status: 500 });
  }
}