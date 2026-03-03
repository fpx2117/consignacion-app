/* eslint-disable */
// @ts-nocheck
// src/lib/stock-alerts.ts
import { prisma } from "@/lib/prisma";
import { sendNotification } from "@/lib/socket-trigger";
import { NOTIFICATION_TYPE, NOTIFICATION_CONFIG } from "@/lib/notificationes/notificaciones-types";

// 1. EVALUADOR DE STOCK: Decide si hay que generar una alerta
export function evaluateStockAlert(productoActualizado: any, configGlobal: any) {
  const stockActual = productoActualizado.stockDisponibleUnits;
  const umbralAlerta = productoActualizado.stockMinUnits > 0 
    ? productoActualizado.stockMinUnits 
    : configGlobal.minStockGlobal;

  // Si está apagado en la configuración (si agregaste el campo) no alertamos
  if (configGlobal.notificarStockBajo === false) return null;

  if (stockActual <= 0) {
    return {
      type: NOTIFICATION_TYPE.OUT_OF_STOCK,
      title: NOTIFICATION_CONFIG[NOTIFICATION_TYPE.OUT_OF_STOCK].label,
      message: `Acaban de llevarse el último "${productoActualizado.nombre}".`,
      data: { productId: productoActualizado.id }
    };
  } else if (stockActual <= umbralAlerta) {
    return {
      type: NOTIFICATION_TYPE.LOW_STOCK,
      title: NOTIFICATION_CONFIG[NOTIFICATION_TYPE.LOW_STOCK].label,
      message: `Quedan solo ${stockActual} unidades de "${productoActualizado.nombre}".`,
      data: { productId: productoActualizado.id }
    };
  }

  return null; // El stock está bien, no hay alerta
}

// 2. PROCESADOR DE COLAS: Guarda en DB y emite Sockets
export async function processNotificationQueue(queue: any[]) {
  for (const notif of queue) {
    try {
      const fingerprint = `${notif.type}:PROD_${notif.data.productId}`;

      const savedNotif = await prisma.notification.upsert({
        where: { fingerprint },
        update: {
          updatedAt: new Date(),
          read: false,
          title: notif.title,
          description: notif.message,
        },
        create: {
          type: notif.type,
          title: notif.title,
          description: notif.message,
          productoId: notif.data.productId,
          fingerprint,
          read: false,
        },
      });

      await sendNotification({
        type: savedNotif.type,
        title: savedNotif.title,
        message: savedNotif.description,
        data: { 
          id: savedNotif.id,
          productId: savedNotif.productoId,
          createdAt: savedNotif.createdAt 
        }
      });
    } catch (err) {
      console.error("Error guardando alerta de stock:", err);
    }
  }
}