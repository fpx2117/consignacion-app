/* eslint-disable */
// @ts-nocheck
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, requireRole } from "@/lib/requireAuth";

// GET: Obtener la configuración actual
export async function GET() {
    const auth = await requireAuth();
    if (!auth.ok) return auth.res;

    try {
        const config = await prisma.configuracion.findUnique({
            where: { sucursalId: auth.activeSucursalId },
        }) as any;

        if (config && config.mpAccessTokenTienda) {
            config.mpAccessTokenTienda = "**************";
        }

        return NextResponse.json({ data: config }, {
            headers: {
                "Cache-Control": "private, max-age=60, stale-while-revalidate=180",
            },
        });
    } catch (error: any) {
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
        const body = await req.json();

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
            mostrarCategoriasEnHeader
        } = body;

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
            }
        });

        return NextResponse.json({ data: configActualizada, message: "Configuración actualizada" });
    } catch (error: any) {
        console.error("Error actualizando configuración:", error);
        return NextResponse.json({ error: "Error al actualizar la configuración" }, { status: 500 });
    }
}
