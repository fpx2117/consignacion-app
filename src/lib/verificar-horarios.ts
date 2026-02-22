// src/lib/verificar-horario.ts
import { prisma } from "@/lib/prisma";

export async function tienePermisoHorario(usuarioId: number) {
    const ahora = new Date();
    const diaSemana = ahora.getDay(); // 0 (Domingo) a 6 (Sábado)
    const horaActual = ahora.getHours().toString().padStart(2, '0') + ":" +
        ahora.getMinutes().toString().padStart(2, '0');

    // Buscamos el horario para el día de hoy
    const horario = await prisma.horarioLaboral.findUnique({
        where: {
            usuarioId_diaSemana: {
                usuarioId,
                diaSemana,
            },
        },
    });

    // Si no tiene horario asignado o está desactivado, denegamos por seguridad
    if (!horario || !horario.activo) return { permitido: false, motivo: "No tienes turno asignado para hoy." };

    // Comprobación de rango horario
    if (horaActual < horario.horaInicio) {
        return { permitido: false, motivo: `Tu turno aún no comienza (Inicia a las ${horario.horaInicio}).` };
    }

    if (horaActual > horario.horaFin) {
        return { permitido: false, motivo: `Tu turno ya finalizó (Terminó a las ${horario.horaFin}).` };
    }

    return { permitido: true };
}