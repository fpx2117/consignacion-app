// src/app/api/ventas/register-sale-handlers.ts
// Adaptador HTTP del caso de uso `RegistrarVenta` y sus efectos post-commit.
//
// T25: el adaptador legacy se retiró. Queda un único camino, que lee la capacidad
// de stock y la autoridad de numeración y nunca hace dual-write incondicional.

import { Prisma } from "@prisma/client";

import { calcularDescuentoEfectivo } from "@/lib/storefront/descuento-utils";
import {
  registerSale,
  type RegisterSaleCommand,
  type SaleNotificationIntent,
} from "@/modules/ventas/application/register-sale";
import { createPrismaRegisterSaleUnitOfWork } from "@/modules/ventas/infrastructure/prisma-register-sale";
import type { VentasRouteDeps } from "@/app/api/ventas/ventas-route-deps";

type AuthContext = Parameters<VentasRouteDeps["resolveTimezoneForAuth"]>[0];

export type VentaCreada = Prisma.VentaGetPayload<{
  include: { detalles: true; cliente: true };
}>;
export type PagoCreado = Prisma.PagoGetPayload<object>;
export type NotificationQueueItem = NonNullable<
  ReturnType<VentasRouteDeps["evaluateStockAlert"]>
>;

/**
 * Resultado del registro. La respuesta HTTP es `{ data: sale, pago: payment }`;
 * las alertas y la notificación son efectos que la ruta ejecuta después del
 * commit.
 */
export type RegisterSaleOutcome = {
  sale: VentaCreada;
  payment: PagoCreado;
  stockAlerts: NotificationQueueItem[];
  saleNotification: SaleNotificationIntent | null;
};

/**
 * Ejecuta el caso de uso con los puertos HTTP: el único adaptador que conoce
 * Prisma es la unidad de trabajo.
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
      sucursalId,
      data: {
        ventaId: intent.ventaId,
        notificationId: dbNotif?.id,
      },
    })
    .catch(() => null);
}
