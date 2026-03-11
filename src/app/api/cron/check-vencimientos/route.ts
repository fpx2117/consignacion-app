// src/app/api/cron/check-vencimientos/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendNotification } from "@/lib/socket-trigger";
import { NOTIFICATION_TYPE, NOTIFICATION_CONFIG } from "@/lib/notificationes/notificaciones-types";
import { obtenerConfiguracionGlobal } from "@/lib/config";

export const dynamic = "force-dynamic";

// Helper para mostrar la fecha en formato Argentino (DD/MM/YYYY)
const formatearFecha = (fecha: Date | null) => {
  if (!fecha) return "Fecha desconocida";
  // Usamos timezone UTC para leer la fecha exacta que guardó Prisma sin desfasajes
  return fecha.toLocaleDateString("es-AR", { timeZone: "UTC" });
};

export async function GET(request: Request) {
  console.log("CRON INICIADO: Módulo check-vencimientos");

  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || cronSecret.trim() === "") {
    console.error("CRON ERROR: CRON_SECRET no está configurado");
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${cronSecret}`) {
    console.error("CRON ERROR: No autorizado. Verifica tu CRON_SECRET");
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    // 1. OBTENER LA HORA EXACTA EN ARGENTINA (UTC-3)
    const now = new Date();
    // Le restamos 3 horas al reloj del servidor (UTC)
    const utcMinus3 = new Date(now.getTime() - (3 * 60 * 60 * 1000));

    // 2. CREAR "HOY" COMO LA MEDIANOCHE EXACTA DE ARGENTINA
    const hoy = new Date(Date.UTC(utcMinus3.getUTCFullYear(), utcMinus3.getUTCMonth(), utcMinus3.getUTCDate(), 0, 0, 0, 0));

    // 3. PROCESAR POR SUCURSAL
    const sucursales = await prisma.sucursal.findMany({
      where: { activa: true },
      include: { configuracion: true }
    });

    console.log(`CRON: Se encontraron ${sucursales.length} sucursales activas.`);

    const stats = {
      vencidos: 0,
      porVencer: 0
    };

    for (const sucursal of sucursales) {
      console.log(`CRON: Procesando sucursal ID ${sucursal.id} - ${sucursal.nombre}`);
      const config = sucursal.configuracion || await obtenerConfiguracionGlobal(sucursal.id);

      if (!config.notificarVencimientos) {
        console.log(`CRON: Sucursal ${sucursal.nombre} tiene notificaciones de vencimiento desactivadas. Omitiendo.`);
        continue;
      }

      const diasAnticipacion = config.diasAnticipacionVencimiento;
      const fechaLimite = new Date(hoy);
      fechaLimite.setUTCDate(hoy.getUTCDate() + diasAnticipacion);

      // --- PRODUCTOS VENCIDOS EN ESTA SUCURSAL ---
      const vencidos = await prisma.producto.findMany({
        where: {
          sucursalId: sucursal.id,
          fechaVencimiento: { lt: hoy, not: null },
          activo: true,
          OR: [
            { stockDisponibleUnits: { gt: 0 } },
            { stockConsignadoUnits: { gt: 0 } }
          ]
        }
      });

      console.log(`CRON: Sucursal ${sucursal.nombre} - ${vencidos.length} productos vencidos con stock encontrado.`);
      stats.vencidos += vencidos.length;

      for (const prod of vencidos) {
        const fechaStr = prod.fechaVencimiento!.toISOString().split('T')[0];
        const fingerprint = `EXPIRED:${prod.id}:${fechaStr}`;
        const existe = await prisma.notification.findUnique({ where: { fingerprint } });

        if (!existe) {
          const type = NOTIFICATION_TYPE.PRODUCT_EXPIRED;
          const fechaLegible = formatearFecha(prod.fechaVencimiento);

          const savedNotif = await prisma.notification.create({
            data: {
              type,
              title: NOTIFICATION_CONFIG[type].label,
              description: `[${sucursal.nombre}] El producto "${prod.nombre}" venció el ${fechaLegible}.`,
              productoId: prod.id,
              fingerprint: fingerprint,
              sucursalId: sucursal.id,
            }
          });

          await sendNotification({
            type,
            title: `🚫 ${NOTIFICATION_CONFIG[type].label}`,
            message: `Atención: "${prod.nombre}" caducó el ${fechaLegible}.`,
            branch: sucursal.nombre,
            data: { id: savedNotif.id, productId: prod.id, createdAt: savedNotif.createdAt }
          });
        }
      }

      // --- PRÓXIMOS A VENCER EN ESTA SUCURSAL ---
      const porVencer = await prisma.producto.findMany({
        where: {
          sucursalId: sucursal.id,
          fechaVencimiento: { gte: hoy, lte: fechaLimite, not: null },
          activo: true,
          OR: [
            { stockDisponibleUnits: { gt: 0 } },
            { stockConsignadoUnits: { gt: 0 } }
          ]
        }
      });

      stats.porVencer += porVencer.length;

      for (const prod of porVencer) {
        const fechaStr = prod.fechaVencimiento!.toISOString().split('T')[0];
        const fingerprint = `NEAR_EXP:${prod.id}:${fechaStr}`;
        const existe = await prisma.notification.findUnique({ where: { fingerprint } });

        if (!existe) {
          const type = NOTIFICATION_TYPE.EXPIRATION_NEAR;
          const fechaLegible = formatearFecha(prod.fechaVencimiento);

          const savedNotif = await prisma.notification.create({
            data: {
              type,
              title: NOTIFICATION_CONFIG[type].label,
              description: `[${sucursal.nombre}] "${prod.nombre}" vence pronto (${fechaLegible}).`,
              productoId: prod.id,
              fingerprint: fingerprint,
              sucursalId: sucursal.id,
            }
          });

          await sendNotification({
            type,
            title: `⚠️ ${NOTIFICATION_CONFIG[type].label}`,
            message: `Ojo: "${prod.nombre}" vence el ${fechaLegible}.`,
            branch: sucursal.nombre,
            data: { id: savedNotif.id, productId: prod.id, createdAt: savedNotif.createdAt }
          });
        }
      }
    }

    // --- 4. ALERTAS DE SUSCRIPCIÓN (PRÓXIMAS A VENCER) ---
    const in3Days = new Date(now.getTime() + (3 * 24 * 60 * 60 * 1000));

    // A. Trials que terminan pronto
    const trialsEndingSoon = await prisma.subscription.findMany({
      where: {
        status: "PRUEBA",
        trialEndsAt: { gt: now, lte: in3Days }
      },
      include: { user: true }
    });

    for (const sub of trialsEndingSoon) {
      const fingerprint = `TRIAL_END:${sub.id}:${sub.trialEndsAt?.toISOString().split('T')[0]}`;
      const existe = await prisma.notification.findUnique({ where: { fingerprint } });

      if (!existe) {
        const type = NOTIFICATION_TYPE.TRIAL_ENDING;
        const savedNotif = await prisma.notification.create({
          data: {
            type,
            title: NOTIFICATION_CONFIG[type].label,
            description: `Tu período de prueba termina pronto (${formatearFecha(sub.trialEndsAt)}).`,
            userId: sub.userId,
            fingerprint,
          }
        });

        await sendNotification({
          type,
          title: `🎁 ${NOTIFICATION_CONFIG[type].label}`,
          message: `Atención ${sub.user.nombre}: Tu prueba gratuita termina el ${formatearFecha(sub.trialEndsAt)}.`,
          data: { id: savedNotif.id, userId: sub.userId, createdAt: savedNotif.createdAt }
        });
      }
    }

    // B. Suscripciones que vencen pronto (Tanto ACTIVO como PRUEBA)
    const expiringSoon = await prisma.subscription.findMany({
      where: {
        status: { in: ["ACTIVO", "PRUEBA"] },
        OR: [
          { currentPeriodEnd: { gt: now, lte: in3Days } },
          {
            AND: [
              { currentPeriodEnd: null },
              { trialEndsAt: { gt: now, lte: in3Days } }
            ]
          }
        ]
      },
      include: { user: true }
    });

    for (const sub of expiringSoon) {
      const vencimiento = sub.currentPeriodEnd || sub.trialEndsAt;
      const fechaStr = vencimiento?.toISOString().split('T')[0] || 'unknown';
      const fingerprint = `SUB_EXPIRING:${sub.id}:${fechaStr}`;
      const existe = await prisma.notification.findUnique({ where: { fingerprint } });

      if (!existe) {
        const type = NOTIFICATION_TYPE.SUBSCRIPTION_EXPIRING;
        const savedNotif = await prisma.notification.create({
          data: {
            type,
            title: NOTIFICATION_CONFIG[type].label,
            description: `Tu suscripción se renovará pronto (${formatearFecha(vencimiento)}).`,
            userId: sub.userId,
            fingerprint,
          }
        });

        await sendNotification({
          type,
          title: `💳 ${NOTIFICATION_CONFIG[type].label}`,
          message: `Hola ${sub.user.nombre}, recordá que tu suscripción vence el ${formatearFecha(vencimiento)}.`,
          data: { id: savedNotif.id, userId: sub.userId, createdAt: savedNotif.createdAt }
        });
      }
    }

    // --- 5. SUSCRIPCIONES VENCIDAS (EJECUCIÓN) ---
    const suscripcionesVencidas = await prisma.subscription.findMany({
      where: {
        status: { in: ['ACTIVO', 'PRUEBA'] },
        OR: [
          { currentPeriodEnd: { lt: now } },
          {
            AND: [
              { currentPeriodEnd: null },
              { trialEndsAt: { lt: now } }
            ]
          }
        ]
      },
      include: {
        user: true
      }
    });

    for (const sub of suscripcionesVencidas) {
      await prisma.subscription.update({
        where: { id: sub.id },
        data: { status: 'VENCIDO' }
      });

      const type = NOTIFICATION_TYPE.SYSTEM;
      const vencimiento = sub.currentPeriodEnd || sub.trialEndsAt;
      const fechaStr = vencimiento?.toISOString().split('T')[0] || 'unknown';
      const description = `La suscripción de ${sub.user.nombre} ha expirado el ${formatearFecha(vencimiento)}.`;

      const savedNotif = await prisma.notification.create({
        data: {
          type,
          title: "Suscripción Expirada",
          description,
          userId: sub.userId,
          fingerprint: `SUB_EXPIRED:${sub.id}:${fechaStr}`
        }
      });

      await sendNotification({
        type,
        title: "🚫 Suscripción Finalizada",
        message: `La suscripción de ${sub.user.nombre} ha caducado.`,
        data: { id: savedNotif.id, userId: sub.userId, createdAt: savedNotif.createdAt }
      });
    }

    return NextResponse.json({
      success: true,
      procesados: {
        vencidos: stats.vencidos,
        porVencer: stats.porVencer,
        alertasSuscripcion: trialsEndingSoon.length + expiringSoon.length,
        suscripcionesExpiradas: suscripcionesVencidas.length
      }
    });

  } catch (error) {
    console.error("CRON_ERROR:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
