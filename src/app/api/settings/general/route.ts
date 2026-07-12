import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { revalidatePath, revalidateTag } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAuth, requireRole } from "@/lib/auth/require-auth";
import { isValidTimezone, TECHNICAL_FALLBACK_TZ } from "@/lib/timezone/get-configured-tz";
import { RUBRO_MAX_LENGTH } from "@/modules/invoices/config/rubros";
import { validateSlug } from "@/lib/storefront/slug";

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
    tiendaMetodoPago?: "whatsapp" | "mercadopago";
    separarListaPorSucursal?: boolean;
    mostrarEnTiendaOnline?: boolean;
    tiendaSlug?: string | null;
    mpAccessTokenTienda?: string | null;
    mpPublicKeyTienda?: string | null;
    tiendaLayout?: string;
    mostrarCategoriasEnHeader?: boolean;
    zonaHoraria?: string;
    rubroNegocio?: string | null;
    columnasAtributosProducto?: string[];
};

function buildIntervalOperator(offsetHours: number) {
    return Prisma.raw(offsetHours > 0 ? "-" : "+");
}

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
            tiendaMetodoPago,
            separarListaPorSucursal,
            mostrarEnTiendaOnline,
            tiendaSlug,
            mpAccessTokenTienda,
            mpPublicKeyTienda,
            tiendaLayout,
            mostrarCategoriasEnHeader,
            zonaHoraria,
            rubroNegocio,
            columnasAtributosProducto,
        } = body;

        if (tiendaMetodoPago !== undefined && tiendaMetodoPago !== "whatsapp" && tiendaMetodoPago !== "mercadopago") {
            return NextResponse.json({ error: "tiendaMetodoPago debe ser 'whatsapp' o 'mercadopago'" }, { status: 400 });
        }

        let normalizedTiendaSlug: string | null | undefined;
        if (tiendaSlug !== undefined) {
            if (tiendaSlug === null || tiendaSlug.trim() === "") {
                normalizedTiendaSlug = null;
            } else {
                const result = validateSlug(tiendaSlug);
                if (!result.ok) {
                    const messages: Record<typeof result.error, string> = {
                        empty: "El nombre de la tienda no puede estar vacío",
                        "invalid-format": "El nombre de la tienda solo puede tener letras minúsculas, números y guiones",
                        reserved: "Ese nombre no está disponible, elegí otro",
                    };
                    return NextResponse.json({ error: messages[result.error] }, { status: 400 });
                }
                normalizedTiendaSlug = result.slug;
            }
        }

        if (rubroNegocio !== undefined && rubroNegocio !== null && rubroNegocio.length > RUBRO_MAX_LENGTH) {
            return NextResponse.json(
                { error: `El rubro no puede superar los ${RUBRO_MAX_LENGTH} caracteres` },
                { status: 400 }
            );
        }

        // Validar timezone IANA si se envía
        if (zonaHoraria !== undefined && !isValidTimezone(zonaHoraria)) {
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

        const zonaHorariaActual = configActual?.zonaHoraria ?? TECHNICAL_FALLBACK_TZ;
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
                const operator = buildIntervalOperator(offsetHours);
                
                await prisma.$transaction(async (tx) => {
                    await tx.$executeRaw(Prisma.sql`UPDATE "Venta" SET "fecha" = "fecha" ${operator} ${interval}::interval`);
                    await tx.$executeRaw(Prisma.sql`UPDATE "Venta" SET "fechaAnulacion" = "fechaAnulacion" ${operator} ${interval}::interval WHERE "fechaAnulacion" IS NOT NULL`);
                    await tx.$executeRaw(Prisma.sql`UPDATE "Pago" SET "fecha" = "fecha" ${operator} ${interval}::interval`);
                    await tx.$executeRaw(Prisma.sql`UPDATE "Consignacion" SET "fecha" = "fecha" ${operator} ${interval}::interval`);
                    await tx.$executeRaw(Prisma.sql`UPDATE "Liquidacion" SET "fecha" = "fecha" ${operator} ${interval}::interval`);
                    await tx.$executeRaw(Prisma.sql`UPDATE "Gasto" SET "fecha" = "fecha" ${operator} ${interval}::interval`);
                    await tx.$executeRaw(Prisma.sql`UPDATE "SesionCaja" SET "fechaApertura" = "fechaApertura" ${operator} ${interval}::interval`);
                    await tx.$executeRaw(Prisma.sql`UPDATE "SesionCaja" SET "fechaCierre" = "fechaCierre" ${operator} ${interval}::interval WHERE "fechaCierre" IS NOT NULL`);
                    await tx.$executeRaw(Prisma.sql`UPDATE "MovimientoCaja" SET "fecha" = "fecha" ${operator} ${interval}::interval`);
                    
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
                ...(tiendaMetodoPago !== undefined && { tiendaMetodoPago }),
                ...(separarListaPorSucursal !== undefined && { separarListaPorSucursal }),
                ...(mostrarEnTiendaOnline !== undefined && { mostrarEnTiendaOnline }),
                ...(normalizedTiendaSlug !== undefined && { tiendaSlug: normalizedTiendaSlug }),
                ...(mpAccessTokenTienda !== undefined && mpAccessTokenTienda !== "**************" && { mpAccessTokenTienda }),
                ...(mpPublicKeyTienda !== undefined && { mpPublicKeyTienda }),
                ...(tiendaLayout !== undefined && { tiendaLayout }),
                ...(mostrarCategoriasEnHeader !== undefined && { mostrarCategoriasEnHeader }),
                ...(zonaHoraria !== undefined && { zonaHoraria }),
                ...(rubroNegocio !== undefined && { rubroNegocio: rubroNegocio || null }),
                ...(columnasAtributosProducto !== undefined && { columnasAtributosProducto }),
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
                tiendaMetodoPago: tiendaMetodoPago ?? "whatsapp",
                separarListaPorSucursal: separarListaPorSucursal ?? true,
                mostrarEnTiendaOnline: mostrarEnTiendaOnline ?? false,
                tiendaSlug: normalizedTiendaSlug ?? null,
                mpAccessTokenTienda: mpAccessTokenTienda ?? null,
                mpPublicKeyTienda: mpPublicKeyTienda ?? null,
                tiendaLayout: tiendaLayout ?? "grid",
                mostrarCategoriasEnHeader: mostrarCategoriasEnHeader ?? true,
                zonaHoraria: zonaHoraria ?? TECHNICAL_FALLBACK_TZ,
                rubroNegocio: rubroNegocio || null,
                columnasAtributosProducto: columnasAtributosProducto ?? [],
            }
        });

        // Invalidar caché de settings para que el cambio tome efecto inmediato
        revalidatePath("/settings/general");
        revalidateTag("config", "max");
        revalidateTag("public-catalog", "default");

        const message = migrationMessage 
            ? `Zona horaria de sucursal actualizada${migrationMessage}` 
            : "Configuración general actualizada";
            
        return NextResponse.json({ data: configActualizada, message });
    } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
            return NextResponse.json({ error: "Ese nombre de tienda ya está en uso por otra sucursal" }, { status: 400 });
        }
        console.error("Error actualizando configuración:", error);
        return NextResponse.json({ error: "Error al actualizar la configuración" }, { status: 500 });
    }
}
