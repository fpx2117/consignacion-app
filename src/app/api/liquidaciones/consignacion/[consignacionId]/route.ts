// src/app/api/liquidaciones/consignacion/[consignacionId]/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/requireAuth";
import { createLiquidacionBodySchema } from "@/lib/validators/liquidacion";
import { TipoMovimientoStock, MotivoMovimientoStock, TipoVenta } from "@prisma/client";

// ✅ Imports Centralizados de Config y Notificaciones
import { obtenerConfiguracionGlobal } from "@/lib/config";
import { evaluateStockAlert, processNotificationQueue } from "@/lib/stock-alerts";
import { sendNotification } from "@/lib/socket-trigger";

type RouteParams = {
  params: Promise<{ consignacionId: string }>;
};

export async function POST(req: Request, { params }: RouteParams) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.res;

  // 1. 👇 EXTRACCIÓN SEGURA DEL ID (Evita errores de sesión o tipos) 👇
  const payload = auth.user as any;
  const rawId = payload.id || payload.userId || payload.usuarioId || payload.sub;
  const usuarioId = Number(rawId);

  if (!rawId || isNaN(usuarioId)) {
    return NextResponse.json({ error: "Usuario no identificado." }, { status: 401 });
  }

  const { consignacionId: rawIdParam } = await params;
  const consignacionId = Number(rawIdParam);

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

  // ✅ 2. Preparar Alertas y Config
  const configGlobal = await obtenerConfiguracionGlobal();
  const notificationsQueue: any[] = [];

  try {
    const result = await prisma.$transaction(async (tx) => {
      const consignacion = await tx.consignacion.findUnique({
        where: { id: consignacionId },
        include: {
          detalles: { include: { producto: true } },
          cliente: true // Necesario para la notificación
        },
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

      // 2) Procesar cada item enviado en la liquidación
      for (const item of items) {
        const det = detallesMap.get(item.consignacionDetalleId);
        if (!det) throw new Error(`DETALLE_NO_PERTENECE:${item.consignacionDetalleId}`);

        const vendidas = item.unitsVendidas ?? 0;
        const devueltas = item.unitsDevueltas ?? 0;

        // Validar que no se liquide más de lo pendiente
        const pendiente = det.unitsEntregadas - det.unitsVendidasAcum - det.unitsDevueltasAcum;
        if (vendidas + devueltas > pendiente) {
          throw new Error(`EXCEDE_PENDIENTE:${det.id}`);
        }

        // Actualizar acumulados de la consignación
        await tx.consignacionDetalle.update({
          where: { id: det.id },
          data: {
            unitsVendidasAcum: { increment: vendidas },
            unitsDevueltasAcum: { increment: devueltas },
          },
        });

        // Capturar estado previo para auditoría
        const productoAntes = await tx.producto.findUnique({ where: { id: det.productoId } });
        if (!productoAntes) throw new Error(`PRODUCTO_NO_ENCONTRADO:${det.productoId}`);

        // Actualizar Stocks del producto
        const productoDespues = await tx.producto.update({
          where: { id: det.productoId },
          data: {
            stockConsignadoUnits: { decrement: vendidas + devueltas },
            ...(devueltas > 0 ? { stockDisponibleUnits: { increment: devueltas } } : {}),
          },
        });

        // ✅ Auditoría de Stock: Devolución (Vuelve al almacén disponible)
        if (devueltas > 0) {
          await tx.movimientoStock.create({
            data: {
              productoId: det.productoId,
              sucursalId: auth.activeSucursalId,
              tipo: TipoMovimientoStock.ENTRADA,
              motivo: MotivoMovimientoStock.DEVOLUCION_CLIENTE,
              cantidad: devueltas,
              stockPrevio: productoAntes.stockDisponibleUnits,
              stockPosterior: productoDespues.stockDisponibleUnits,
              observaciones: `Devolución s/Consignación #${consignacionId}`
            }
          });
        }

        // ✅ Auditoría de Stock: Venta (Sale de stock consignado definitivamente)
        if (vendidas > 0) {
          await tx.movimientoStock.create({
            data: {
              productoId: det.productoId,
              sucursalId: auth.activeSucursalId,
              tipo: TipoMovimientoStock.SALIDA,
              motivo: MotivoMovimientoStock.VENTA,
              cantidad: vendidas,
              // Nota: Aquí el stock disponible no cambia, cambia el consignado, 
              // pero registramos el disponible para consistencia de auditoría.
              stockPrevio: productoAntes.stockDisponibleUnits,
              stockPosterior: productoDespues.stockDisponibleUnits,
              observaciones: `Venta Liquidada s/Consignación #${consignacionId}`
            }
          });
        }

        // Evaluar si el nuevo stock disponible requiere alerta
        const alerta = evaluateStockAlert(productoDespues, configGlobal);
        if (alerta) notificationsQueue.push(alerta);

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

      // 3) Crear la liquidación (cabecera)
      const nuevaLiquidacion = await tx.liquidacion.create({
        data: {
          consignacionId,
          items: { create: liquidacionItemsData },
        },
      });

      // 4) Crear venta asociada (Administrativa, sin sesión de caja obligatoria)
      let nuevaVenta = null;
      if (totalVenta > 0) {
        nuevaVenta = await tx.venta.create({
          data: {
            tipo: TipoVenta.LIQUIDACION, // 👈 Clasificamos la venta
            clienteId: consignacion.clienteId,
            sucursalId: auth.activeSucursalId,
            liquidacionId: nuevaLiquidacion.id,
            total: totalVenta,
            // sesionCajaId: null, (No se envía porque es opcional en el Schema)
            detalles: {
              create: Array.from(soldByProduct.entries()).map(([prodId, info]) => ({
                productoId: Number(prodId),
                units: info.units,
                precioUnitario: info.precioUnitario,
                subtotal: info.units * info.precioUnitario,
              })),
            },
          },
        });

        // Actualizar el saldo de la cuenta corriente del cliente (Saldo positivo = Debe)
        await tx.cliente.update({
          where: { id: consignacion.clienteId },
          data: { saldoCuenta: { increment: totalVenta } },
        });
      }

      // 5) Verificar si cerramos la consignación automáticamente
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

      return { liquidacion: nuevaLiquidacion, venta: nuevaVenta, consignacion };
    });

    // ✅ Disparar notificaciones fuera de la transacción para no bloquear
    await processNotificationQueue(notificationsQueue);

    // ✅ Disparar notificación de Venta si corresponde
    if (result.venta && configGlobal.notificarVentas !== false) {
      const clientName = result.consignacion.cliente?.nombre || "Consumidor Final";
      const clientId = result.consignacion.clienteId;

      const dbNotif = await prisma.notification.create({
        data: {
          type: "NEW_ORDER",
          title: "Venta Exitosa (Liquidación)",
          description: `Venta #${result.venta.id} para [${clientId}] ${clientName} por $${result.venta.total} ARS`,
          fingerprint: `SALE_${result.venta.id}`,
          read: false,
        }
      }).catch(() => null);

      sendNotification({
        id: dbNotif?.id,
        type: "NEW_ORDER",
        title: "Venta Exitosa (Liquidación)",
        message: `Venta #${result.venta.id} por $${result.venta.total}`,
        data: {
          ventaId: result.venta.id,
          notificationId: dbNotif?.id
        }
      }).catch(() => null);
    }

    // Devolvemos solo la liquidación para no romper la respuesta esperada en el frontend
    return NextResponse.json({ data: result.liquidacion }, { status: 201 });

  } catch (e: any) {
    console.error("Error en liquidación:", e);
    const msg = String(e?.message || "");

    if (msg === "CONSIGNACION_NO_ENCONTRADA") return NextResponse.json({ error: "Consignación no encontrada" }, { status: 404 });
    if (msg === "CONSIGNACION_CERRADA") return NextResponse.json({ error: "La consignación ya está cerrada" }, { status: 409 });
    if (msg.startsWith("EXCEDE_PENDIENTE:")) return NextResponse.json({ error: "Stock insuficiente en consignación" }, { status: 409 });

    return NextResponse.json({ error: "Error interno al procesar liquidación" }, { status: 500 });
  }
}