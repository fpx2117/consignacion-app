/* eslint-disable */
// @ts-nocheck
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/requireAuth";
import { MetodoPago } from "@prisma/client";

/* ==========================================================
   HELPERS DE TIEMPO
   ========================================================== */

/**
 * Suma una cantidad X de minutos a un string "HH:mm" y devuelve el nuevo "HH:mm"
 */
function sumarMinutos(horaStr: string, minutosASumar: number): string {
    const [h, m] = horaStr.split(":").map(Number);
    const date = new Date();
    date.setHours(h, m + minutosASumar, 0);
    return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
}

/**
 * Extrae el ID de usuario del token de forma robusta
 */
function getUsuarioIdFuerte(userPayload: any): number {
    if (!userPayload) throw new Error("No hay datos de usuario.");
    const rawId = userPayload.id || userPayload.userId || userPayload.usuarioId || userPayload.sub;
    const parsed = Number(rawId);
    if (!rawId || isNaN(parsed)) throw new Error("ID de usuario no encontrado.");
    return parsed;
}

/**
 * Valida si el usuario puede ABRIR una caja según su contrato laboral
 */
async function validarHorarioLaboral(usuarioId: number) {
    const ahora = new Date();
    const diaSemana = ahora.getDay();
    const horaActual = ahora.getHours().toString().padStart(2, '0') + ":" +
        ahora.getMinutes().toString().padStart(2, '0');

    const horario = await prisma.horarioLaboral.findUnique({
        where: { usuarioId_diaSemana: { usuarioId, diaSemana } },
    });

    if (!horario || !horario.activo) {
        return { permitido: false, error: "No tienes un turno asignado para hoy." };
    }

    if (horaActual < horario.horaInicio) {
        return { permitido: false, error: `Tu turno inicia a las ${horario.horaInicio}.` };
    }

    if (horaActual > horario.horaFin) {
        return { permitido: false, error: `Tu turno finalizó a las ${horario.horaFin}.` };
    }

    return { permitido: true, horaFin: horario.horaFin };
}

/* ==========================================================
   ENDPOINTS (GET, POST, PATCH, PUT)
   ========================================================== */

/**
 * GET: Obtiene la sesión actual y calcula el horario extendido real
 */
export async function GET() {
    const auth = await requireAuth();
    if (!auth.ok) return auth.res;

    try {
        const usuarioId = getUsuarioIdFuerte(auth.user);

        const sesionAbierta = await prisma.sesionCaja.findFirst({
            where: { usuarioId, estado: "ABIERTA", caja: { sucursalId: auth.activeSucursalId } },
            include: {
                caja: true,
                ventas: { where: { tipo: "CASUAL" } },
                pagos: true,
                movimientos: true
            },
        });

        const ahora = new Date();
        const horarioHoy = await prisma.horarioLaboral.findUnique({
            where: { usuarioId_diaSemana: { usuarioId, diaSemana: ahora.getDay() } }
        });

        let horaFinCalculada = horarioHoy?.horaFin;

        // 🛡️ SINCRONIZACIÓN INTELIGENTE
        // Si hay una sesión abierta, escaneamos las notas en busca de extensiones dinámicas
        if (sesionAbierta?.observaciones && horaFinCalculada) {
            const regex = /\[EXTENSIÓN (\d+)MIN/g;
            let totalMinutosExtra = 0;
            let match;

            // Sumamos todos los bloques encontrados (ej: 15 + 60 + 30...)
            while ((match = regex.exec(sesionAbierta.observaciones)) !== null) {
                totalMinutosExtra += parseInt(match[1]);
            }

            if (totalMinutosExtra > 0) {
                horaFinCalculada = sumarMinutos(horaFinCalculada, totalMinutosExtra);
            }
        }

        return NextResponse.json({
            data: sesionAbierta,
            horarioConfigurado: horarioHoy ? {
                ...horarioHoy,
                horaFin: horaFinCalculada // ✅ Devolvemos la hora real con extensiones
            } : null
        });
    } catch (error: any) {
        console.error("Error al obtener el turno activo:", error);
        return NextResponse.json({ error: "Error al obtener el turno activo" }, { status: 500 });
    }
}

/**
 * POST: Abre un nuevo turno de caja (Solo en horario permitido)
 */
export async function POST(req: Request) {
    const auth = await requireAuth();
    if (!auth.ok) return auth.res;

    try {
        const usuarioId = getUsuarioIdFuerte(auth.user);
        const { cajaId, montoInicial } = await req.json();

        // Validar horario antes de permitir apertura
        const verificacion = await validarHorarioLaboral(usuarioId);
        if (!verificacion.permitido) {
            return NextResponse.json({ error: verificacion.error }, { status: 403 });
        }

        // Validar que la caja pertenezca a la sucursal activa
        const cajaSelect = await prisma.caja.findUnique({ where: { id: Number(cajaId) } });
        if (!cajaSelect || cajaSelect.sucursalId !== auth.activeSucursalId) {
            return NextResponse.json({ error: "Caja no válida para esta sucursal." }, { status: 403 });
        }

        const activa = await prisma.sesionCaja.findFirst({
            where: { usuarioId, estado: "ABIERTA" } // Mantenemos global para evitar dobles turnos del mismo user
        });
        if (activa) return NextResponse.json({ error: "Ya tienes una sesión abierta." }, { status: 403 });

        const nueva = await prisma.sesionCaja.create({
            data: {
                cajaId: Number(cajaId),
                usuarioId,
                montoInicial: Number(montoInicial),
                estado: "ABIERTA"
            },
        });

        return NextResponse.json({ data: nueva });
    } catch (error: any) {
        console.error("Error al abrir el turno de caja:", error);
        return NextResponse.json({ error: "Error al abrir el turno de caja" }, { status: 500 });
    }
}

/**
 * PATCH: Registra una extensión de tiempo personalizada
 */
export async function PATCH(req: Request) {
    const auth = await requireAuth();
    if (!auth.ok) return auth.res;

    try {
        const { minutos } = await req.json(); // Recibe 15, 30, 60, etc.
        const usuarioId = getUsuarioIdFuerte(auth.user);

        const sesion = await prisma.sesionCaja.findFirst({
            where: { usuarioId, estado: "ABIERTA", caja: { sucursalId: auth.activeSucursalId } }
        });

        if (!sesion) return NextResponse.json({ error: "No hay sesión para extender." }, { status: 404 });

        const timeStamp = new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
        const tagExtension = `[EXTENSIÓN ${minutos}MIN: ${timeStamp}]`;

        const actualizada = await prisma.sesionCaja.update({
            where: { id: sesion.id },
            data: {
                observaciones: sesion.observaciones
                    ? `${sesion.observaciones} ${tagExtension}`
                    : tagExtension
            }
        });

        return NextResponse.json({ data: actualizada });
    } catch (error: any) {
        console.error("Error al extender el turno:", error);
        return NextResponse.json({ error: "Error al extender el turno" }, { status: 500 });
    }
}

/**
 * PUT: Cierre de caja y Arqueo final
 */
export async function PUT(req: Request) {
    const auth = await requireAuth();
    if (!auth.ok) return auth.res;

    try {
        const usuarioId = getUsuarioIdFuerte(auth.user);
        const { montoReal, observaciones } = await req.json();

        const sesion = await prisma.sesionCaja.findFirst({
            where: { usuarioId, estado: "ABIERTA", caja: { sucursalId: auth.activeSucursalId } },
            include: {
                ventas: { where: { tipo: "CASUAL" } },
                pagos: true,
                movimientos: true
            },
        });

        if (!sesion) return NextResponse.json({ error: "Caja no encontrada." }, { status: 404 });

        // Cálculos de auditoría
        let esperado = Number(sesion.montoInicial);
        const ventasEfe = sesion.ventas.filter((v: any) => v.metodoPago === MetodoPago.EFECTIVO).reduce((t, v) => t + Number(v.total), 0);
        const cobranzasEfe = sesion.pagos.filter((p: any) => p.metodo === MetodoPago.EFECTIVO).reduce((t, p) => t + Number(p.monto), 0);
        const ingresos = sesion.movimientos.filter(m => m.tipo === "INGRESO").reduce((t, m) => t + Number(m.monto), 0);
        const egresos = sesion.movimientos.filter(m => m.tipo === "EGRESO").reduce((t, m) => t + Number(m.monto), 0);

        esperado = esperado + ventasEfe + cobranzasEfe + ingresos - egresos;
        const diferencia = Number(montoReal) - esperado;

        const cerrada = await prisma.sesionCaja.update({
            where: { id: sesion.id },
            data: {
                estado: "CERRADA",
                fechaCierre: new Date(),
                montoFinalEsperado: esperado,
                montoFinalReal: Number(montoReal),
                diferencia,
                observaciones: `${sesion.observaciones || ""} | Cierre: ${observaciones || ""}`
            },
        });

        return NextResponse.json({
            message: "Caja cerrada correctamente",
            data: cerrada,
            extra: { esperadoEfectivo: esperado }
        });
    } catch (error: any) {
        console.error("Error al cerrar la caja:", error);
        return NextResponse.json({ error: "Error al cerrar la caja" }, { status: 500 });
    }
}