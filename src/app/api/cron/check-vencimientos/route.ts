import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendNotification } from "@/lib/socket-trigger";
import { NOTIFICATION_TYPE } from "@/lib/notificationes/notificaciones-types";

// Para evitar que cualquiera ejecute esto, podrías validar un Header secreto
// pero por ahora lo dejamos abierto para que puedas probarlo fácil.

export async function GET() {
  try {
    const hoy = new Date();
    
    // Configuración: Avisar 7 días antes
    const diasAnticipacion = 7; 
    const fechaLimite = new Date();
    fechaLimite.setDate(hoy.getDate() + diasAnticipacion);

    // -------------------------------------------------------
    // 1. BUSCAR PRODUCTOS YA VENCIDOS
    // -------------------------------------------------------
    const vencidos = await prisma.producto.findMany({
      where: {
        fechaVencimiento: {
          lt: hoy, // "Less than" hoy
          not: null
        }
      }
    });

    for (const prod of vencidos) {
      // Usamos fingerprint para NO spamear la misma notificación 50 veces
      const fingerprint = `EXPIRED:${prod.id}`;
      
      const existe = await prisma.notification.findUnique({ where: { fingerprint } });

      if (!existe) {
        // Guardar en DB
        await prisma.notification.create({
          data: {
            type: NOTIFICATION_TYPE.PRODUCT_EXPIRED,
            title: "Producto Vencido",
            description: `El producto "${prod.nombre}" venció el ${prod.fechaVencimiento?.toLocaleDateString()}.`,
            productoId: prod.id,
            fingerprint: fingerprint,
          }
        });

        // Enviar Socket
        await sendNotification({
          type: NOTIFICATION_TYPE.PRODUCT_EXPIRED,
          title: "🚫 PRODUCTO VENCIDO",
          message: `Atención: "${prod.nombre}" ha caducado. Retirar de venta.`,
          data: { productId: prod.id }
        });
      }
    }

    // -------------------------------------------------------
    // 2. BUSCAR PRODUCTOS PRÓXIMOS A VENCER
    // -------------------------------------------------------
    const porVencer = await prisma.producto.findMany({
      where: {
        fechaVencimiento: {
          gt: hoy,         // Mayor a hoy
          lte: fechaLimite, // Menor o igual a 7 días
          not: null
        }
      }
    });

    for (const prod of porVencer) {
      // Fingerprint único por día (para que avise una vez al día, no cada 5 minutos)
      const fechaSimple = new Date().toISOString().split('T')[0]; // "2023-10-27"
      const fingerprint = `NEAR_EXP:${prod.id}:${fechaSimple}`;

      const existe = await prisma.notification.findUnique({ where: { fingerprint } });

      if (!existe) {
        await prisma.notification.create({
          data: {
            type: NOTIFICATION_TYPE.EXPIRATION_NEAR,
            title: "Vencimiento Cercano",
            description: `"${prod.nombre}" vence pronto (${prod.fechaVencimiento?.toLocaleDateString()}).`,
            productoId: prod.id,
            fingerprint: fingerprint,
          }
        });

        await sendNotification({
          type: NOTIFICATION_TYPE.EXPIRATION_NEAR,
          title: "⚠️ Vencimiento Próximo",
          message: `Ojo: "${prod.nombre}" vence en menos de ${diasAnticipacion} días.`,
          data: { productId: prod.id }
        });
      }
    }

    return NextResponse.json({ 
      success: true, 
      procesados: { vencidos: vencidos.length, porVencer: porVencer.length } 
    });

  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Error en cron" }, { status: 500 });
  }
}