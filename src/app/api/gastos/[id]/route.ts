import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth/require-auth";
import { canAccessSucursalResource, isGlobalSucursalView } from "@/lib/sucursalScope";
import { EstadoGasto, FrecuenciaGasto } from "@prisma/client";
import { formatTimeInputAR, parseDateTimeInputAR } from "@/lib/utils-date";
import { resolveTimezoneForAuth } from "@/lib/get-configured-tz";

export async function GET(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const auth = await requireAuth();
    if (!auth.ok) return auth.res;

    const { id } = await params;

    try {
        const gasto = await prisma.gasto.findUnique({
            where: { id: Number(id) },
            include: {
                categoria: true,
                user: {
                    select: { id: true, nombre: true }
                },
                sucursalesCompartidas: true,
            }
        });

        if (!gasto || !canAccessSucursalResource(auth, gasto.sucursalId)) {
            return NextResponse.json({ error: "Gasto no encontrado" }, { status: 404 });
        }

        return NextResponse.json({ data: gasto });
    } catch {
        return NextResponse.json(
            { error: "Error al obtener el gasto" },
            { status: 500 }
        );
    }
}

export async function PUT(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const auth = await requireAuth();
    if (!auth.ok) return auth.res;
    if (isGlobalSucursalView(auth)) {
        return NextResponse.json({ error: "Vista global en modo solo lectura. Selecciona una sucursal para editar gastos." }, { status: 409 });
    }

    if (auth.user?.rol !== "ADMIN") {
        return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    const { id } = await params;

    try {
        const body = await req.json();
        const {
            monto,
            motivo,
            fecha,
            hora,
            fechaVencimiento,
            horaVencimiento,
            estado,
            esRecurrente,
            frecuencia,
            categoriaGastoId,
            sucursalesCompartir, // number[] para actualizar reparto, [] para desactivar
        } = body;

        const existing = await prisma.gasto.findUnique({
            where: { id: Number(id) },
            include: { sucursalesCompartidas: true },
        });

        if (!existing || existing.sucursalId !== auth.activeSucursalId) {
            return NextResponse.json({ error: "Gasto no encontrado" }, { status: 404 });
        }

        const montoFinal = monto !== undefined ? Number(monto) : Number(existing.monto);
        const timezone = await resolveTimezoneForAuth(auth);
        const horaFecha = typeof hora === "string" && hora ? hora : formatTimeInputAR(existing.fecha, timezone.tz) || "00:00";
        const horaFechaVencimiento = typeof horaVencimiento === "string" && horaVencimiento
            ? horaVencimiento
            : existing.fechaVencimiento
                ? (formatTimeInputAR(existing.fechaVencimiento, timezone.tz) || "23:59")
                : "23:59";

        // Actualizar reparto si viene en el payload
        let nuevoEsCompartido = existing.esCompartido;
        if (sucursalesCompartir !== undefined) {
            if (Array.isArray(sucursalesCompartir) && sucursalesCompartir.length > 1) {
                nuevoEsCompartido = true;
                const nuevoProporcional = montoFinal / sucursalesCompartir.length;
                await prisma.gastoSucursal.deleteMany({ where: { gastoId: existing.id } });
                await prisma.gastoSucursal.createMany({
                    data: sucursalesCompartir.map((sid: number) => ({
                        gastoId: existing.id,
                        sucursalId: sid,
                        montoProporcional: nuevoProporcional,
                    })),
                });
            } else {
                // Array vacío o 1 sucursal: desactivar reparto
                nuevoEsCompartido = false;
                await prisma.gastoSucursal.deleteMany({ where: { gastoId: existing.id } });
            }
        } else if (monto !== undefined && existing.esCompartido && existing.sucursalesCompartidas.length > 0) {
            // Solo cambió el monto: recalcular proporcionales existentes
            const nuevoProporcional = montoFinal / existing.sucursalesCompartidas.length;
            await prisma.gastoSucursal.updateMany({
                where: { gastoId: existing.id },
                data: { montoProporcional: nuevoProporcional },
            });
        }

        const updated = await prisma.gasto.update({
            where: { id: Number(id) },
            data: {
                ...(monto !== undefined && { monto: montoFinal }),
                ...(motivo !== undefined && { motivo }),
                ...(fecha !== undefined && { fecha: parseDateTimeInputAR(fecha as string, horaFecha, timezone.tz) }),
                ...(fechaVencimiento !== undefined && { fechaVencimiento: fechaVencimiento ? parseDateTimeInputAR(fechaVencimiento as string, horaFechaVencimiento, timezone.tz) : null }),
                ...(estado !== undefined && { estado: estado as EstadoGasto }),
                ...(esRecurrente !== undefined && { esRecurrente: !!esRecurrente }),
                ...(frecuencia !== undefined && { frecuencia: frecuencia as FrecuenciaGasto }),
                ...(categoriaGastoId !== undefined && { categoriaGastoId: Number(categoriaGastoId) }),
                esCompartido: nuevoEsCompartido,
            },
            include: {
                categoria: true,
                sucursalesCompartidas: true,
            }
        });

        return NextResponse.json({ data: updated });
    } catch {
        return NextResponse.json(
            { error: "Error al actualizar el gasto" },
            { status: 500 }
        );
    }
}

export async function DELETE(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const auth = await requireAuth();
    if (!auth.ok) return auth.res;
    if (isGlobalSucursalView(auth)) {
        return NextResponse.json({ error: "Vista global en modo solo lectura. Selecciona una sucursal para eliminar gastos." }, { status: 409 });
    }

    if (auth.user?.rol !== "ADMIN") {
        return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    const { id } = await params;

    try {
        const existing = await prisma.gasto.findUnique({
            where: { id: Number(id) }
        });

        if (!existing || existing.sucursalId !== auth.activeSucursalId) {
            return NextResponse.json({ error: "Gasto no encontrado" }, { status: 404 });
        }

        await prisma.gasto.delete({
            where: { id: Number(id) }
        });

        return NextResponse.json({ success: true });
    } catch {
        return NextResponse.json(
            { error: "Error al eliminar el gasto" },
            { status: 500 }
        );
    }
}
