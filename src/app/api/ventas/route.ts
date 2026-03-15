import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth/require-auth";
import {
  MetodoPago,
  MotivoMovimientoStock,
  Prisma,
  TipoMovimientoStock,
  TipoVenta,
} from "@prisma/client";
import { z } from "zod";

import { sendNotification } from "@/lib/notificaciones/socket-trigger";
import { obtenerConfiguracionGlobal } from "@/lib/config";
import { evaluateStockAlert, processNotificationQueue } from "@/lib/notificaciones/stock-alerts";
import { nowAR } from "@/lib/utils-date";
import { getConfiguredTz } from "@/lib/get-configured-tz";
import { buildSucursalWhere, isGlobalSucursalView } from "@/lib/sucursalScope";

const MAX_VENTA_RETRIES = 3;
const createVentaSchema = z.object({
  clienteId: z.number().int().positive().optional().nullable(),
  descuentoGlobal: z.number().nonnegative().optional(),
  metodoPago: z.nativeEnum(MetodoPago).optional(),
  items: z
    .array(
      z.object({
        productoId: z.number().int().positive(),
        units: z.number().int().positive(),
        descuento: z.number().nonnegative().optional(),
      })
    )
    .min(1),
});

type NotificationQueueItem = NonNullable<ReturnType<typeof evaluateStockAlert>>;
type VentaCreada = Prisma.VentaGetPayload<{
  include: { detalles: true; cliente: true };
}>;
type PagoCreado = Prisma.PagoGetPayload<object>;
type VentaTransactionResult = {
  venta: VentaCreada;
  pago: PagoCreado;
  notificationsQueue: NotificationQueueItem[];
};

function isRetriableVentaError(error: unknown) {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    return error.code === "P2002" || error.code === "P2034";
  }
  return false;
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  return "";
}

export async function GET() {
  const auth = await requireAuth();
  if (!auth.ok) return auth.res;
  const sucursalWhere = buildSucursalWhere(auth);

  const ventas = await prisma.venta.findMany({
    where: sucursalWhere,
    orderBy: { id: "desc" },
    include: { cliente: true, detalles: { include: { producto: true } } },
    take: 200,
  });

  return NextResponse.json({ data: ventas });
}

export async function POST(req: Request) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.res;
  if (isGlobalSucursalView(auth)) {
    return NextResponse.json({ error: "Vista global en modo solo lectura. Selecciona una sucursal para registrar ventas." }, { status: 409 });
  }

  const rawId = auth.user.sub;
  const usuarioId = Number(rawId);

  if (!rawId || isNaN(usuarioId)) {
    return NextResponse.json(
      { error: "Identificación de usuario fallida. Reingresa al sistema." },
      { status: 401 }
    );
  }

  try {
    const body = await req.json().catch(() => null);
    const parsed = createVentaSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validación fallida", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { clienteId, descuentoGlobal, items, metodoPago } = parsed.data;

    // ✅ 1. TRAER CONFIGURACIÓN Y TIMEZONE PRIMERO
    const [configGlobal, tzVenta] = await Promise.all([
      obtenerConfiguracionGlobal(auth.activeSucursalId),
      getConfiguredTz(auth.activeSucursalId),
    ]);
    // Asumimos que si no existe el campo en DB aún, por defecto es estricto (true)
    const usaCaja = configGlobal.usarControlDeCaja ?? true;

    // ✅ 2. VERIFICAR SESIÓN DE CAJA (Condicional)
    const sesionActiva = await prisma.sesionCaja.findFirst({
      where: {
        usuarioId: usuarioId,
        estado: "ABIERTA",
      },
    });

    // Si el sistema exige caja Y no hay caja abierta, bloqueamos.
    if (usaCaja && !sesionActiva) {
      return NextResponse.json(
        { error: "Operación bloqueada: Debes abrir un turno de caja para realizar ventas casuales." },
        { status: 403 }
      );
    }

    let notificationsQueue: NotificationQueueItem[] = [];

    // Lógica de Cliente - Filtrado por sucursal
    let finalClienteId = clienteId;
    if (!finalClienteId) {
      const consumidor = await prisma.cliente.findFirst({
        where: { nombre: "Consumidor Final", sucursalId: auth.activeSucursalId },
      });
      finalClienteId = consumidor ? consumidor.id : (await prisma.cliente.create({
        data: {
          nombre: "Consumidor Final",
          direccion: "Venta Mostrador",
          activo: true,
          sucursalId: auth.activeSucursalId
        },
      })).id;
    }

    // ✅ 3. TRANSACCIÓN DE VENTA ADAPTADA (con reintento ante conflictos)
    let result: VentaTransactionResult | null = null;

    for (let attempt = 1; attempt <= MAX_VENTA_RETRIES; attempt++) {
      try {
        result = await prisma.$transaction(async (tx) => {
          let totalVenta = 0;
          const txNotificationsQueue: NotificationQueueItem[] = [];
          const detallesData = [];
          const sucursalId = auth.activeSucursalId;

          for (const item of items) {
            const stockSucursalInfo = await tx.stockSucursal.findUnique({
              where: { productoId_sucursalId: { productoId: item.productoId, sucursalId } },
              include: { producto: true }
            });

            if (!stockSucursalInfo) {
              throw new Error(`El producto #${item.productoId} no está asignado a esta sucursal.`);
            }

            const affectedStockSucursal = await tx.stockSucursal.updateMany({
              where: {
                productoId: item.productoId,
                sucursalId,
                stockDisponibleUnits: { gte: item.units },
              },
              data: { stockDisponibleUnits: { decrement: item.units } },
            });

            if (affectedStockSucursal.count === 0) {
              throw new Error(`Stock insuficiente para "${stockSucursalInfo.producto.nombre}".`);
            }

            const stockSucursalDespues = await tx.stockSucursal.findUnique({
              where: { productoId_sucursalId: { productoId: item.productoId, sucursalId } },
              select: { stockDisponibleUnits: true }
            });

            if (!stockSucursalDespues) {
              throw new Error(`No se pudo confirmar stock para el producto #${item.productoId}.`);
            }

            const affectedProducto = await tx.producto.updateMany({
              where: {
                id: item.productoId,
                stockDisponibleUnits: { gte: item.units },
              },
              data: { stockDisponibleUnits: { decrement: item.units } },
            });

            if (affectedProducto.count === 0) {
              throw new Error(`Inconsistencia de stock para "${stockSucursalInfo.producto.nombre}".`);
            }

            const productoDespues = await tx.producto.findUnique({
              where: { id: item.productoId },
            });

            if (!productoDespues) {
              throw new Error(`Producto #${item.productoId} no encontrado.`);
            }

            const stockPosterior = stockSucursalDespues.stockDisponibleUnits;
            const stockPrevio = stockPosterior + item.units;

            await tx.movimientoStock.create({
              data: {
                productoId: item.productoId,
                sucursalId,
                tipo: TipoMovimientoStock.SALIDA,
                motivo: MotivoMovimientoStock.VENTA,
                cantidad: item.units,
                stockPrevio,
                stockPosterior,
                observaciones: sesionActiva
                  ? `Venta POS - Sesión #${sesionActiva.id}`
                  : `Venta POS - Rápida (Sin Caja)`
              }
            });

            const alerta = evaluateStockAlert(productoDespues, configGlobal);
            if (alerta) txNotificationsQueue.push(alerta);

            const precioVenta = Number(stockSucursalInfo.precioVentaOverride ?? stockSucursalInfo.producto.precioVenta);
            const descuento = Number(item.descuento || 0);
            const subtotal = (precioVenta * item.units) - descuento;
            totalVenta += subtotal;

            detallesData.push({
              productoId: item.productoId,
              units: item.units,
              precioUnitario: precioVenta,
              descuento,
              subtotal,
            });
          }

          await tx.$executeRaw`SELECT pg_advisory_xact_lock(${BigInt(1000000 + auth.activeSucursalId)})`;

          const lastVenta = await tx.venta.findFirst({
            where: { sucursalId: auth.activeSucursalId },
            orderBy: { numeroVenta: "desc" },
            select: { numeroVenta: true },
          });
          const nextNumeroVenta = (lastVenta?.numeroVenta || 0) + 1;

          const descGlobalFinal = Number(descuentoGlobal) || 0;
          let montoInteres = 0;
          const porcentajeInteres = Number(configGlobal.porcentajeInteresTarjeta) || 0;

          if (metodoPago === "TARJETA" && porcentajeInteres > 0) {
            montoInteres = (totalVenta - descGlobalFinal) * (porcentajeInteres / 100);
          }

          const totalFinal = totalVenta - descGlobalFinal + montoInteres;

          const nuevaVenta = await tx.venta.create({
            data: {
              tipo: TipoVenta.CASUAL,
              clienteId: finalClienteId,
              sucursalId: auth.activeSucursalId,
              numeroVenta: nextNumeroVenta,
              metodoPago: metodoPago ?? MetodoPago.EFECTIVO,
              sesionCajaId: sesionActiva?.id || null,
              fecha: nowAR(tzVenta),
              total: totalFinal,
              descuentoGlobal: descGlobalFinal,
              detalles: { create: detallesData },
            },
            include: { detalles: true, cliente: true },
          });

          const nuevoPago = await tx.pago.create({
            data: {
              clienteId: finalClienteId,
              sucursalId: auth.activeSucursalId,
              tipo: "VENTA",
              sesionCajaId: sesionActiva?.id || null,
              fecha: nowAR(tzVenta),
              monto: totalFinal,
              metodo: metodoPago ?? MetodoPago.EFECTIVO,
            },
          });

          return { venta: nuevaVenta, pago: nuevoPago, notificationsQueue: txNotificationsQueue };
        }, {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        });

        notificationsQueue = result.notificationsQueue;
        break;
      } catch (error) {
        if (!isRetriableVentaError(error) || attempt === MAX_VENTA_RETRIES) {
          throw error;
        }
      }
    }

    if (!result) {
      throw new Error("No se pudo registrar la venta por concurrencia");
    }

    // Post-Procesamiento
    await processNotificationQueue(notificationsQueue, auth.activeSucursalId);

    // Mensaje de notificación adaptado (Solo si la configuración lo permite)
    if (configGlobal.notificarVentas !== false) {
      // 1. Persistencia en base de datos para el historial
      const clientName = result.venta.cliente?.nombre || "Consumidor Final";
      const clientId = result.venta.clienteId;

      const dbNotif = await prisma.notification.create({
        data: {
          type: "NEW_ORDER",
          title: "Venta Exitosa",
          description: `Venta #${result.venta.id} para [${clientId}] ${clientName} por $${result.venta.total} ARS`,
          fingerprint: `SALE_${result.venta.id}`,
          sucursalId: auth.activeSucursalId,
          read: false,
        }
      }).catch(() => null);

      // 2. Emisión en tiempo real (Socket)
      sendNotification({
        id: dbNotif?.id, // Pasamos el ID real para que useNotifications lo indexe bien
        type: "NEW_ORDER",
        title: "Venta Exitosa",
        message: `Venta #${result.venta.id} por $${result.venta.total}`,
        data: {
          ventaId: result.venta.id,
          notificationId: dbNotif?.id
        }
      }).catch(() => null);
    }

    return NextResponse.json({ data: result.venta, pago: result.pago });

  } catch (error) {
    console.error("Error POS:", error);
    const msg = getErrorMessage(error);
    if (
      msg.includes("Stock insuficiente") ||
      msg.includes("no está asignado") ||
      msg.includes("Inconsistencia de stock")
    ) {
      return NextResponse.json({ error: msg }, { status: 409 });
    }
    return NextResponse.json(
      { error: "Error al procesar la venta" },
      { status: 500 }
    );
  }
}
