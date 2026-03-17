// src/lib/pedidos-esperados.ts
// Funciones compartidas para el modulo de pedidos de reposicion programados

import { prisma } from "@/lib/prisma";
import { resolveTimezone } from "@/lib/get-configured-tz";
import { NOTIFICATION_TYPE } from "@/lib/notificaciones/types";
import { formatDateSafe, nowAR } from "@/lib/utils-date";

/**
 * Verifica pedidos PROGRAMADO/POSTERGADO cuya fechaEsperada ya paso,
 * los actualiza a VENCIDO y crea una Notification in-app por cada uno
 * (upsert idempotente por fingerprint para evitar duplicados).
 *
 * @param sucursalId - Si se pasa, solo chequea pedidos de esa sucursal.
 *                     Si es undefined, chequea TODAS las sucursales.
 * @returns cantidad de pedidos actualizados
 */
export async function checkAndUpdateVencidos(sucursalId?: number): Promise<{ count: number; ids: number[] }> {
  const resolvedTimezone = sucursalId !== undefined ? await resolveTimezone({ sucursalId }) : null;
  const now = nowAR(resolvedTimezone?.tz);

  const pedidosAVencer = await prisma.pedidoEsperado.findMany({
    where: {
      estado: { in: ["PROGRAMADO", "POSTERGADO"] },
      fechaEsperada: { lt: now },
      ...(sucursalId !== undefined ? { sucursalId } : {}),
    },
    select: { id: true, sucursalId: true, fechaEsperada: true },
  });

  if (pedidosAVencer.length === 0) {
    return { count: 0, ids: [] };
  }

  const ids = pedidosAVencer.map((p) => p.id);
  const timezonesBySucursal = new Map<number, string>();

  if (resolvedTimezone && sucursalId !== undefined) {
    timezonesBySucursal.set(sucursalId, resolvedTimezone.tz);
  }

  // Actualizar estados a VENCIDO
  await prisma.pedidoEsperado.updateMany({
    where: { id: { in: ids } },
    data: { estado: "VENCIDO" },
  });

  // Crear notificaciones in-app (upsert idempotente por fingerprint)
  // Cada pedido tiene su propia notification; si ya existe, la reactiva como no leida
  await Promise.all(
    pedidosAVencer.map(async (pedido) => {
      const fingerprint = `PEDIDO_VENCIDO_${pedido.id}`;
      let pedidoTz = timezonesBySucursal.get(pedido.sucursalId);

      if (!pedidoTz) {
        const timezone = await resolveTimezone({ sucursalId: pedido.sucursalId });
        pedidoTz = timezone.tz;
        timezonesBySucursal.set(pedido.sucursalId, pedidoTz);
      }

      const fechaFormateada = formatDateSafe(
        pedido.fechaEsperada,
        {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
        },
        pedidoTz,
      );

      return prisma.notification.upsert({
        where: { fingerprint },
        update: {
          read: false,
          updatedAt: now,
          title: "Pedido vencido sin confirmar",
          description: `El pedido #${pedido.id} tenia fecha estimada el ${fechaFormateada} y no fue confirmado.`,
        },
        create: {
          type: NOTIFICATION_TYPE.PEDIDO_VENCIDO,
          title: "Pedido vencido sin confirmar",
          description: `El pedido #${pedido.id} tenia fecha estimada el ${fechaFormateada} y no fue confirmado.`,
          fingerprint,
          sucursalId: pedido.sucursalId,
          read: false,
        },
      });
    })
  );

  return { count: ids.length, ids };
}
