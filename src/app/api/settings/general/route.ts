import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAuth, requireRole } from "@/lib/auth/require-auth";

const TZ_DEFAULT = "America/Argentina/Buenos_Aires";

function isValidIANATz(tz: string): boolean {
  try {
    new Intl.DateTimeFormat(undefined, { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

type GeneralSettingsBody = {
    minStockGlobal?: number;
    diasAnticipacionVencimiento?: number;
    notificarVencimientos?: boolean;
    notificarStockBajo?: boolean;
    notificarVentas?: boolean;
    notificarLiquidaciones?: boolean;
    notificarConsignacionesActivas?: boolean;
    diasAvisoConsignacion?: number;
    mensajeWhatsappConsignacion?: string | null;
    mensajeWhatsappVenta?: string | null;
    usarControlDeCaja?: boolean;
    porcentajeAumentoConsignacion?: number;
    mostrarPreciosConsignacion?: boolean;
    porcentajeInteresTarjeta?: number;
    mostrarListaPrecios?: boolean;
    convertirTienda?: boolean;
    separarListaPorSucursal?: boolean;
    mpAccessTokenTienda?: string | null;
    mpPublicKeyTienda?: string | null;
    tiendaLayout?: string;
    mostrarCategoriasEnHeader?: boolean;
    zonaHoraria?: string;
};

// GET: Obtener la configuración actual
export async function GET() {
    const auth = await requireAuth();
    if (!auth.ok) return auth.res;

    try {
        const config = await prisma.configuracion.findUnique({
            where: { sucursalId: auth.activeSucursalId },
        });

        const data = config
            ? {
                ...config,
                mpAccessTokenTienda: config.mpAccessTokenTienda ? "**************" : null,
            }
            : null;

        return NextResponse.json({ data }, {
            headers: {
                "Cache-Control": "private, max-age=60, stale-while-revalidate=180",
            },
        });
    } catch {
        return NextResponse.json({ error: "Error al obtener la configuración" }, { status: 500 });
    }
}

// PUT o PATCH: Actualizar la configuración
export async function PUT(req: Request) {
    const auth = await requireAuth();
    if (!auth.ok) return auth.res;
    if (!requireRole(auth.user, ["ADMIN"])) {
        return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    try {
        const body = (await req.json()) as GeneralSettingsBody;

        const {
            minStockGlobal,
            diasAnticipacionVencimiento,
            notificarVencimientos,
            notificarStockBajo,
            notificarVentas,
            notificarLiquidaciones,
            notificarConsignacionesActivas,
            diasAvisoConsignacion,
            mensajeWhatsappConsignacion,
            mensajeWhatsappVenta,
            usarControlDeCaja,
            porcentajeAumentoConsignacion,
            mostrarPreciosConsignacion,
            porcentajeInteresTarjeta,
            mostrarListaPrecios,
            convertirTienda,
            separarListaPorSucursal,
            mpAccessTokenTienda,
            mpPublicKeyTienda,
            tiendaLayout,
            mostrarCategoriasEnHeader,
            zonaHoraria,
        } = body;

        // Validar timezone IANA si se envía
        if (zonaHoraria !== undefined && !isValidIANATz(zonaHoraria)) {
            return NextResponse.json(
                { error: `Zona horaria inválida: "${zonaHoraria}" no es una timezone IANA válida.` },
                { status: 400 }
            );
        }

        // Obtener la configuración actual para detectar cambio de timezone
        const configActual = await prisma.configuracion.findUnique({
            where: { sucursalId: auth.activeSucursalId },
            select: { zonaHoraria: true, timezoneMigrationDone: true },
        });

        const zonaHorariaActual = configActual?.zonaHoraria ?? TZ_DEFAULT;
        const timezoneMigrationDone = configActual?.timezoneMigrationDone ?? false;
        const seCambioTimezone = zonaHoraria !== undefined && zonaHoraria !== zonaHorariaActual;

        // Si cambió la timezone y no se ha migrado, calcular offset y ejecutar corrección
        let migrationMessage = "";
        if (seCambioTimezone && !timezoneMigrationDone) {
            // Calcular offset en horas entre la timezone anterior y la nueva
            const now = new Date();
            const anteriorStr = new Intl.DateTimeFormat("en-CA", {
                timeZone: zonaHorariaActual,
                year: "numeric", month: "2-digit", day: "2-digit",
                hour: "2-digit", minute: "2-digit", second: "2-digit",
                hour12: false,
            }).format(now);
            const nuevaStr = new Intl.DateTimeFormat("en-CA", {
                timeZone: zonaHoraria,
                year: "numeric", month: "2-digit", day: "2-digit",
                hour: "2-digit", minute: "2-digit", second: "2-digit",
                hour12: false,
            }).format(now);

            const anteriorMs = new Date(anteriorStr.replace(",", "") + "Z").getTime();
            const nuevaMs = new Date(nuevaStr.replace(",", "") + "Z").getTime();
            const offsetHours = Math.round((anteriorMs - nuevaMs) / 3_600_000);

            if (offsetHours !== 0) {
                const interval = `${Math.abs(offsetHours)} hours`;
                // Ejecutar corrección: restar el offset (si anterior > nueva) o sumar
                const operador = offsetHours > 0 ? '-' : '+';
                
                await prisma.$transaction(async (tx) => {
                    await tx.$executeRaw`UPDATE "Venta" SET "fecha" = "fecha" ${operador as any} ${interval}::interval`;
                    await tx.$executeRaw`UPDATE "Venta" SET "fechaAnulacion" = "fechaAnulacion" ${operador as any} ${interval}::interval WHERE "fechaAnulacion" IS NOT NULL`;
                    await tx.$executeRaw`UPDATE "Pago" SET "fecha" = "fecha" ${operador as any} ${interval}::interval`;
                    await tx.$executeRaw`UPDATE "Consignacion" SET "fecha" = "fecha" ${operador as any} ${interval}::interval`;
                    await tx.$executeRaw`UPDATE "Liquidacion" SET "fecha" = "fecha" ${operador as any} ${interval}::interval`;
                    await tx.$executeRaw`UPDATE "Gasto" SET "fecha" = "fecha" ${operador as any} ${interval}::interval`;
                    await tx.$executeRaw`UPDATE "SesionCaja" SET "fechaApertura" = "fechaApertura" ${operador as any} ${interval}::interval`;
                    await tx.$executeRaw`UPDATE "SesionCaja" SET "fechaCierre" = "fechaCierre" ${operador as any} ${interval}::interval WHERE "fechaCierre" IS NOT NULL`;
                    await tx.$executeRaw`UPDATE "MovimientoCaja" SET "fecha" = "fecha" ${operador as any} ${interval}::interval`;
                    
                    // Marcar migración como completada
                    await tx.configuracion.update({
                        where: { sucursalId: auth.activeSucursalId },
                        data: { timezoneMigrationDone: true },
                    });
                });

                migrationMessage = ` (fechas corregidas: ${offsetHours > 0 ? '-' : '+'}${Math.abs(offsetHours)}h)`;
            }
        }

        const configActualizada = await prisma.configuracion.upsert({
            where: { sucursalId: auth.activeSucursalId },
            update: {
                ...(minStockGlobal !== undefined && { minStockGlobal }),
                ...(diasAnticipacionVencimiento !== undefined && { diasAnticipacionVencimiento }),
                ...(notificarVencimientos !== undefined && { notificarVencimientos }),
                ...(notificarStockBajo !== undefined && { notificarStockBajo }),
                ...(notificarVentas !== undefined && { notificarVentas }),
                ...(notificarLiquidaciones !== undefined && { notificarLiquidaciones }),
                ...(notificarConsignacionesActivas !== undefined && { notificarConsignacionesActivas }),
                ...(diasAvisoConsignacion !== undefined && { diasAvisoConsignacion }),
                ...(mensajeWhatsappConsignacion !== undefined && { mensajeWhatsappConsignacion }),
                ...(mensajeWhatsappVenta !== undefined && { mensajeWhatsappVenta }),
                ...(usarControlDeCaja !== undefined && { usarControlDeCaja }),
                ...(porcentajeAumentoConsignacion !== undefined && { porcentajeAumentoConsignacion }),
                ...(mostrarPreciosConsignacion !== undefined && { mostrarPreciosConsignacion }),
                ...(porcentajeInteresTarjeta !== undefined && { porcentajeInteresTarjeta }),
                ...(mostrarListaPrecios !== undefined && { mostrarListaPrecios }),
                ...(convertirTienda !== undefined && { convertirTienda }),
                ...(separarListaPorSucursal !== undefined && { separarListaPorSucursal }),
                ...(mpAccessTokenTienda !== undefined && mpAccessTokenTienda !== "**************" && { mpAccessTokenTienda }),
                ...(mpPublicKeyTienda !== undefined && { mpPublicKeyTienda }),
                ...(tiendaLayout !== undefined && { tiendaLayout }),
                ...(mostrarCategoriasEnHeader !== undefined && { mostrarCategoriasEnHeader }),
                ...(zonaHoraria !== undefined && { zonaHoraria }),
            },
            create: {
                sucursalId: auth.activeSucursalId,
                minStockGlobal: minStockGlobal ?? 5,
                diasAnticipacionVencimiento: diasAnticipacionVencimiento ?? 7,
                notificarVencimientos: notificarVencimientos ?? true,
                notificarStockBajo: notificarStockBajo ?? true,
                notificarVentas: notificarVentas ?? true,
                notificarLiquidaciones: notificarLiquidaciones ?? true,
                notificarConsignacionesActivas: notificarConsignacionesActivas ?? true,
                diasAvisoConsignacion: diasAvisoConsignacion ?? 15,
                mensajeWhatsappConsignacion: mensajeWhatsappConsignacion ?? null,
                mensajeWhatsappVenta: mensajeWhatsappVenta ?? null,
                usarControlDeCaja: usarControlDeCaja ?? true,
                porcentajeAumentoConsignacion: porcentajeAumentoConsignacion ?? 0,
                mostrarPreciosConsignacion: mostrarPreciosConsignacion ?? false,
                porcentajeInteresTarjeta: porcentajeInteresTarjeta ?? 0,
                mostrarListaPrecios: mostrarListaPrecios ?? false,
                convertirTienda: convertirTienda ?? false,
                separarListaPorSucursal: separarListaPorSucursal ?? true,
                mpAccessTokenTienda: mpAccessTokenTienda ?? null,
                mpPublicKeyTienda: mpPublicKeyTienda ?? null,
                tiendaLayout: tiendaLayout ?? "grid",
                mostrarCategoriasEnHeader: mostrarCategoriasEnHeader ?? true,
                zonaHoraria: zonaHoraria ?? TZ_DEFAULT,
            }
        });

        // Invalidar caché de settings para que el cambio tome efecto inmediato
        revalidatePath("/settings/general");

        const message = migrationMessage 
            ? `Zona horaria actualizada${migrationMessage}` 
            : "Configuración actualizada";
            
        return NextResponse.json({ data: configActualizada, message });
    } catch (error) {
        console.error("Error actualizando configuración:", error);
        return NextResponse.json({ error: "Error al actualizar la configuración" }, { status: 500 });
    }
}
