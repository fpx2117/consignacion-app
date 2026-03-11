import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendNotification } from "@/lib/socket-trigger";
import { NOTIFICATION_TYPE } from "@/lib/notificationes/notificaciones-types";
import { obtenerConfiguracionGlobal } from "@/lib/config";

// Auth: Requiere CRON_SECRET (igual que los demás cron endpoints)
export async function GET(request: NextRequest) {
    const cronSecret = process.env.CRON_SECRET;
    if (!cronSecret || cronSecret.trim() === "") {
        return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const authHeader = request.headers.get("authorization");
    if (authHeader !== `Bearer ${cronSecret}`) {
        return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    try {
        const sucursales = await prisma.sucursal.findMany({
            where: { activa: true },
            include: { configuracion: true }
        });

        let totalEvaluadas = 0;
        let totalNotificacionesEnviadas = 0;
        const hoy = new Date().toISOString().split("T")[0];

        for (const sucursal of sucursales) {
            const config = sucursal.configuracion || await obtenerConfiguracionGlobal(sucursal.id);

            if (!config.notificarConsignacionesActivas) continue;

            const { diasAvisoConsignacion } = config;
            const limiteDate = new Date();
            limiteDate.setDate(limiteDate.getDate() - diasAvisoConsignacion);

            const consignacionesAtrasadas = await prisma.consignacion.findMany({
                where: {
                    sucursalId: sucursal.id,
                    estado: "ABIERTA",
                    fecha: { lte: limiteDate },
                },
                include: {
                    cliente: true
                }
            });

            totalEvaluadas += consignacionesAtrasadas.length;

            for (const cons of consignacionesAtrasadas) {
                const fingerprint = `CONSIGNMENT_ALERT_${cons.id}_${hoy}`;
                const existing = await prisma.notification.findUnique({
                    where: { fingerprint }
                });

                if (!existing) {
                    const diffTime = Math.abs(new Date().getTime() - cons.fecha.getTime());
                    const diasReales = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

                    const title = `Consignación Pendiente`;
                    const desc = `[${sucursal.nombre}] La consignación #${cons.numeroFolio} de ${cons.cliente.nombre} lleva ${diasReales} días en la calle.`;

                    const dbNotif = await prisma.notification.create({
                        data: {
                            type: "CONSIGNMENT_ALERT",
                            title,
                            description: desc,
                            fingerprint,
                            read: false,
                            sucursalId: sucursal.id,
                        }
                    });

                    await sendNotification({
                        id: dbNotif.id,
                        type: NOTIFICATION_TYPE.CONSIGNMENT_ALERT,
                        title,
                        message: desc,
                        branch: sucursal.nombre,
                        data: { consignacionId: cons.id }
                    });

                    totalNotificacionesEnviadas++;
                }
            }
        }

        return NextResponse.json({
            success: true,
            evaluadas: totalEvaluadas,
            nuevasNotificaciones: totalNotificacionesEnviadas
        });

    } catch (error) {
        console.error("Error validando tiempo de consignaciones:", error);
        return NextResponse.json({ error: "Internal Error" }, { status: 500 });
    }
}
