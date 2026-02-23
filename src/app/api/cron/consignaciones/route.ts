import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendNotification } from "@/lib/socket-trigger";
import { NOTIFICATION_TYPE } from "@/lib/notificationes/notificaciones-types";

// Permite ser llamado sin auth explícita para que un cron service pueda pegarle
export async function GET() {
    try {
        const config = await prisma.configuracion.findUnique({
            where: { id: 1 },
        });

        if (!config || !config.notificarConsignacionesActivas) {
            return NextResponse.json({ message: "Alertas de consignaciones desactivadas" });
        }

        const { diasAvisoConsignacion } = config;

        // Calculamos la fecha límite (Consignaciones creadas ANTES de esta fecha están atrasadas)
        const limiteDate = new Date();
        limiteDate.setDate(limiteDate.getDate() - diasAvisoConsignacion);

        const consignacionesAtrasadas = await prisma.consignacion.findMany({
            where: {
                estado: "ABIERTA",
                fecha: { lte: limiteDate },
            },
            include: {
                cliente: true
            }
        });

        let notificacionesEnviadas = 0;
        const hoy = new Date().toISOString().split("T")[0]; // YYYY-MM-DD para evitar spam el mismo día

        for (const cons of consignacionesAtrasadas) {
            const fingerprint = `CONSIGNMENT_ALERT_${cons.id}_${hoy}`;

            // Verificamos si ya notificamos HOY sobre esta consignación
            const existing = await prisma.notification.findUnique({
                where: { fingerprint }
            });

            if (!existing) {
                // Cuántos días exactos lleva?
                const diffTime = Math.abs(new Date().getTime() - cons.fecha.getTime());
                const diasReales = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

                const title = `Consignación Pendiente`;
                const desc = `La consignación #${cons.numeroFolio} de ${cons.cliente.nombre} lleva ${diasReales} días en la calle.`;

                const dbNotif = await prisma.notification.create({
                    data: {
                        type: "CONSIGNMENT_ALERT",
                        title,
                        description: desc,
                        fingerprint,
                        read: false,
                    }
                });

                await sendNotification({
                    id: dbNotif.id,
                    type: NOTIFICATION_TYPE.CONSIGNMENT_ALERT,
                    title,
                    message: desc,
                    data: { consignacionId: cons.id }
                });

                notificacionesEnviadas++;
            }
        }

        return NextResponse.json({
            success: true,
            evaluadas: consignacionesAtrasadas.length,
            nuevasNotificaciones: notificacionesEnviadas
        });

    } catch (error) {
        console.error("Error validando tiempo de consignaciones:", error);
        return NextResponse.json({ error: "Internal Error" }, { status: 500 });
    }
}
