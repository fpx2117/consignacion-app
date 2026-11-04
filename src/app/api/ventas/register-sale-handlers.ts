// src/app/api/ventas/register-sale-handlers.ts
// Los dos dispatches del piloto de ventas y los efectos post-commit compartidos.
//
// `registerSaleLegacy` es el adaptador de compatibilidad B1: conserva la unidad
// transaccional, el orden de efectos y los mensajes exactos del handler previo.
// `registerSaleThroughApplication` ejecuta el caso de uso extraído. Ambos leen
// la capacidad de stock y la autoridad de numeración: ninguno hace dual-write
// incondicional. La ruta ejecuta exactamente uno de los dos por request.

import {
  MotivoMovimientoStock,
  Prisma,
  TipoMovimientoStock,
  TipoVenta,
} from "@prisma/client";

import { calcularDescuentoEfectivo } from "@/lib/storefront/descuento-utils";
import {
  calculateLineTotal,
  calculateSaleTotals,
} from "@/modules/ventas/sale-totals";
import { createVentaWithAuthority } from "@/modules/ventas/venta-numbering-authority";
import {
  applyProductoGlobalDelta,
  lockStockAuthority,
} from "@/modules/inventory/stock-authority";
import {
  CASH_SESSION_REQUIRED_MESSAGE,
  CLIENT_SCOPE_MESSAGE,
  registerSale,
  SaleDomainError,
  type RegisterSaleCommand,
  type SaleNotificationIntent,
} from "@/modules/ventas/application/register-sale";
import { createPrismaRegisterSaleUnitOfWork } from "@/modules/ventas/infrastructure/prisma-register-sale";
import type { VentasRouteDeps } from "@/app/api/ventas/ventas-route-deps";

const MAX_VENTA_RETRIES = 3;

type AuthContext = Parameters<VentasRouteDeps["resolveTimezoneForAuth"]>[0];

export type VentaCreada = Prisma.VentaGetPayload<{
  include: { detalles: true; cliente: true };
}>;
export type PagoCreado = Prisma.PagoGetPayload<object>;
export type NotificationQueueItem = NonNullable<
  ReturnType<VentasRouteDeps["evaluateStockAlert"]>
>;

/**
 * Resultado normalizado de cualquiera de los dos dispatches. La respuesta HTTP
 * es `{ data: sale, pago: payment }`; las alertas y la notificación son efectos
 * que la ruta ejecuta después del commit.
 */
export type RegisterSaleOutcome = {
  sale: VentaCreada;
  payment: PagoCreado;
  stockAlerts: NotificationQueueItem[];
  saleNotification: SaleNotificationIntent | null;
};

function isRetriableVentaError(error: unknown) {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    return error.code === "P2002" || error.code === "P2034";
  }
  return false;
}

function buildSaleNotification(
  sale: VentaCreada,
  notificarVentas: boolean | null | undefined,
): SaleNotificationIntent | null {
  if (notificarVentas === false) return null;
  return {
    ventaId: sale.id,
    total: sale.total,
    clienteId: sale.clienteId,
    clienteNombre: sale.cliente?.nombre || "Consumidor Final",
  };
}

/**
 * Adaptador legacy B1. Reproduce la implementación previa a la extracción:
 * configuración y timezone en paralelo, verificación de caja, cliente por
 * defecto fuera de la transacción y transacción `Serializable` con reintentos.
 * El único cambio es que devuelve el resultado en lugar de responder.
 */
export async function registerSaleLegacy(
  command: RegisterSaleCommand,
  auth: AuthContext,
  deps: VentasRouteDeps,
): Promise<RegisterSaleOutcome> {
  const { usuarioId, items, paymentMethod, globalDiscount } = command;

  const [configGlobal, timezone] = await Promise.all([
    deps.obtenerConfiguracionGlobal(command.sucursalId),
    deps.resolveTimezoneForAuth(auth),
  ]);
  // Asumimos que si no existe el campo en DB aún, por defecto es estricto (true)
  const usaCaja = configGlobal.usarControlDeCaja ?? true;

  const sesionActiva = await deps.prisma.sesionCaja.findFirst({
    where: {
      usuarioId: usuarioId,
      estado: "ABIERTA",
    },
  });

  // Si el sistema exige caja Y no hay caja abierta, bloqueamos.
  if (usaCaja && !sesionActiva) {
    throw new SaleDomainError(
      "CASH_SESSION_REQUIRED",
      CASH_SESSION_REQUIRED_MESSAGE,
    );
  }

  let finalClienteId = command.clienteId;
  if (!finalClienteId) {
    const consumidor = await deps.prisma.cliente.findFirst({
      where: {
        nombre: "Consumidor Final",
        sucursalId: command.sucursalId,
      },
    });
    finalClienteId = consumidor
      ? consumidor.id
      : (
          await deps.prisma.cliente.create({
            data: {
              nombre: "Consumidor Final",
              direccion: "Venta Mostrador",
              activo: true,
              sucursalId: command.sucursalId,
            },
          })
        ).id;
  }

  let result: {
    venta: VentaCreada;
    pago: PagoCreado;
    notificationsQueue: NotificationQueueItem[];
  } | null = null;

  for (let attempt = 1; attempt <= MAX_VENTA_RETRIES; attempt++) {
    try {
      result = await deps.prisma.$transaction(
        async (tx) => {
          const txNotificationsQueue: NotificationQueueItem[] = [];
          const detallesData = [];
          const sucursalId = command.sucursalId;
          const stockAuthority = await lockStockAuthority(tx);
          const scopedClient = await tx.cliente.findFirst({
            where: { id: finalClienteId, sucursalId },
            select: { id: true },
          });
          if (!scopedClient) {
            throw new Error(CLIENT_SCOPE_MESSAGE);
          }

          for (const item of items) {
            const stockSucursalInfo = await tx.stockSucursal.findUnique({
              where: {
                productoId_sucursalId: {
                  productoId: item.productoId,
                  sucursalId,
                },
              },
              include: { producto: true },
            });

            if (!stockSucursalInfo) {
              throw new Error(
                `El producto #${item.productoId} no está asignado a esta sucursal.`,
              );
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
              throw new Error(
                `Stock insuficiente para "${stockSucursalInfo.producto.nombre}".`,
              );
            }

            const stockSucursalDespues = await tx.stockSucursal.findUnique({
              where: {
                productoId_sucursalId: {
                  productoId: item.productoId,
                  sucursalId,
                },
              },
              select: { stockDisponibleUnits: true },
            });

            if (!stockSucursalDespues) {
              throw new Error(
                `No se pudo confirmar stock para el producto #${item.productoId}.`,
              );
            }

            // Sincronizar el campo legacy Producto según la autoridad de stock:
            // APP_DUAL_WRITE aplica el delta atómicamente; DB_PROJECTION deja
            // que la proyección lo haga y sólo lee el valor ya proyectado.
            const productoDespues = await applyProductoGlobalDelta(
              tx,
              stockAuthority,
              {
                productoId: item.productoId,
                disponibleDelta: -item.units,
                consignadoDelta: 0,
              },
            );

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
                  : `Venta POS - Rápida (Sin Caja)`,
              },
            });

            const alerta = deps.evaluateStockAlert(
              productoDespues,
              configGlobal,
            );
            if (alerta) txNotificationsQueue.push(alerta);

            const precioVenta = Number(
              stockSucursalInfo.precioVentaOverride ??
                stockSucursalInfo.producto.precioVenta,
            );

            // El descuento de catálogo se resuelve siempre; `applyDiscount`
            // ignora el de catálogo cuando la línea trae uno manual.
            const prod = stockSucursalInfo.producto;
            const descuentoAuto = calcularDescuentoEfectivo({
              descuentoActivo: prod.descuentoActivo,
              tipoDescuento: prod.tipoDescuento,
              descuentoPorcentaje: prod.descuentoPorcentaje
                ? Number(prod.descuentoPorcentaje)
                : null,
              descuentoMonto: prod.descuentoMonto
                ? Number(prod.descuentoMonto)
                : null,
              descuentoDesde: prod.descuentoDesde,
              descuentoHasta: prod.descuentoHasta,
              precioVenta,
            });

            const linea = calculateLineTotal({
              unitPrice: precioVenta,
              units: item.units,
              manualDiscount: item.descuento,
              catalogDiscountPerUnit: descuentoAuto?.montoDescuento ?? null,
            });

            detallesData.push({
              productoId: item.productoId,
              units: item.units,
              precioUnitario: precioVenta,
              descuento: linea.discount,
              subtotal: linea.subtotal,
            });
          }

          await tx.$executeRaw`SELECT pg_advisory_xact_lock(${BigInt(1000000 + sucursalId)})`;

          const lastVenta = await tx.venta.findFirst({
            where: { sucursalId },
            orderBy: { numeroVenta: "desc" },
            select: { numeroVenta: true },
          });
          const nextNumeroVenta = (lastVenta?.numeroVenta || 0) + 1;
          // Retained during mixed-version rollout; PostgreSQL assigns the value.
          void nextNumeroVenta;

          const totals = calculateSaleTotals({
            lineSubtotals: detallesData.map((detalle) => detalle.subtotal),
            globalDiscount,
            appliesCardSurcharge: paymentMethod === "TARJETA",
            cardSurchargePercentage: configGlobal.porcentajeInteresTarjeta,
          });

          const nuevaVenta = await createVentaWithAuthority(tx, {
            data: {
              tipo: TipoVenta.CASUAL,
              clienteId: finalClienteId,
              sucursalId,
              metodoPago: paymentMethod,
              sesionCajaId: sesionActiva?.id || null,
              fecha: deps.nowAR(timezone.tz),
              total: totals.total,
              descuentoGlobal: totals.globalDiscount,
              detalles: { create: detallesData },
            },
            include: { detalles: true, cliente: true },
          });

          const nuevoPago = await tx.pago.create({
            data: {
              clienteId: finalClienteId,
              sucursalId,
              tipo: "VENTA",
              sesionCajaId: sesionActiva?.id || null,
              fecha: deps.nowAR(timezone.tz),
              monto: totals.total,
              metodo: paymentMethod,
            },
          });

          return {
            venta: nuevaVenta,
            pago: nuevoPago,
            notificationsQueue: txNotificationsQueue,
          };
        },
        {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        },
      );

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

  return {
    sale: result.venta,
    payment: result.pago,
    stockAlerts: result.notificationsQueue,
    saleNotification: buildSaleNotification(
      result.venta,
      configGlobal.notificarVentas,
    ),
  };
}

/**
 * Dispatcher del caso de uso extraído. Reutiliza los mismos puertos HTTP: el
 * único adaptador nuevo es la unidad de trabajo Prisma.
 */
export async function registerSaleThroughApplication(
  command: RegisterSaleCommand,
  auth: AuthContext,
  deps: VentasRouteDeps,
): Promise<RegisterSaleOutcome> {
  return registerSale(command, {
    unitOfWork: createPrismaRegisterSaleUnitOfWork(deps.prisma),
    loadConfiguration: (sucursalId) =>
      deps.obtenerConfiguracionGlobal(sucursalId),
    resolveTimezone: async () => deps.resolveTimezoneForAuth(auth),
    now: (tz) => deps.nowAR(tz),
    resolveCatalogDiscount: (product) => calcularDescuentoEfectivo(product),
    evaluateStockAlert: (product, configuration) =>
      deps.evaluateStockAlert(product, configuration),
  });
}

/**
 * Efectos posteriores al commit. Se ejecutan una sola vez, después de que la
 * transacción confirmó, y nunca dentro de ella.
 */
export async function applyPostCommit(
  outcome: RegisterSaleOutcome,
  sucursalId: number,
  deps: VentasRouteDeps,
) {
  await deps.processNotificationQueue(outcome.stockAlerts, sucursalId);

  const intent = outcome.saleNotification;
  if (!intent) return;

  // 1. Persistencia en base de datos para el historial
  const dbNotif = await deps.prisma.notification
    .create({
      data: {
        type: "NEW_ORDER",
        title: "Venta Exitosa",
        description: `Venta #${intent.ventaId} para [${intent.clienteId}] ${intent.clienteNombre} por $${intent.total} ARS`,
        fingerprint: `SALE_${intent.ventaId}`,
        sucursalId,
        read: false,
      },
    })
    .catch(() => null);

  // 2. Emisión en tiempo real (Socket)
  deps
    .sendNotification({
      id: dbNotif?.id, // Pasamos el ID real para que useNotifications lo indexe bien
      type: "NEW_ORDER",
      title: "Venta Exitosa",
      message: `Venta #${intent.ventaId} por $${intent.total}`,
      data: {
        ventaId: intent.ventaId,
        notificationId: dbNotif?.id,
      },
    })
    .catch(() => null);
}
