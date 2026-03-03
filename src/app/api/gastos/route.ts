/* eslint-disable */
// @ts-nocheck
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/requireAuth";

export async function GET(req: Request) {
    const auth = await requireAuth();
    if (!auth.ok) return auth.res;

    const { searchParams } = new URL(req.url);
    const estado = searchParams.get("estado"); // PENDIENTE | PAGADO
    const categoriaId = searchParams.get("categoriaId");

    try {
        const gastos = await prisma.gasto.findMany({
            where: {
                sucursalId: auth.activeSucursalId,
                ...(estado && { estado: estado as any }),
                ...(categoriaId && { categoriaGastoId: Number(categoriaId) }),
            },
            include: {
                categoria: true,
                user: {
                    select: { id: true, nombre: true }
                }
            },
            orderBy: { fecha: "desc" },
        });
        return NextResponse.json({ data: gastos });
    } catch (error) {
        return NextResponse.json(
            { error: "Error al obtener gastos" },
            { status: 500 }
        );
    }
}

export async function POST(req: Request) {
    const auth = await requireAuth();
    if (!auth.ok) return auth.res;

    // Solo ADMIN puede registrar gastos según requerimiento
    if (auth.user?.rol !== "ADMIN") {
        return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    try {
        const body = await req.json();
        const {
            monto,
            motivo,
            fecha,
            fechaVencimiento,
            estado,
            esRecurrente,
            frecuencia,
            categoriaGastoId
        } = body;

        if (!monto || !motivo || !categoriaGastoId) {
            return NextResponse.json(
                { error: "Monto, motivo y categoría son obligatorios" },
                { status: 400 }
            );
        }

        const startDate = fecha ? new Date(fecha) : new Date();
        const endDate = fechaVencimiento ? new Date(fechaVencimiento) : null;
        const sucursalId = auth.activeSucursalId;
        const userId = Number(auth.user.sub);

        // Si es recurrente y tiene fecha de vencimiento final, generamos cuotas
        if (!!esRecurrente && endDate && ["MENSUAL", "SEMANAL", "ANUAL"].includes(frecuencia)) {
            const recurrenciaId = Math.random().toString(36).substring(2, 11).toUpperCase();
            const dates: Date[] = [];
            const current = new Date(startDate);

            while (current <= endDate) {
                dates.push(new Date(current));
                if (frecuencia === "MENSUAL") current.setMonth(current.getMonth() + 1);
                else if (frecuencia === "SEMANAL") current.setDate(current.getDate() + 7);
                else if (frecuencia === "ANUAL") current.setFullYear(current.getFullYear() + 1);
            }

            const totalCuotas = dates.length;
            const batch = dates.map((d, index) => ({
                monto: Number(monto),
                motivo,
                fecha: d,
                fechaVencimiento: d, // En préstamos, la cuota vence el día que corresponde
                estado: index === 0 ? (estado || "PAGADO") : "PENDIENTE",
                esRecurrente: true,
                frecuencia,
                categoriaGastoId: Number(categoriaGastoId),
                sucursalId,
                userId,
                recurrenciaId,
                cuotaActual: index + 1,
                cuotaTotal: totalCuotas
            }));

            await prisma.gasto.createMany({ data: batch });

            return NextResponse.json({ message: `${totalCuotas} cuotas generadas correctamente` }, { status: 201 });
        }

        // Caso normal (único)
        const nuevoGasto = await prisma.gasto.create({
            data: {
                monto: Number(monto),
                motivo,
                fecha: startDate,
                fechaVencimiento: endDate,
                estado: estado || "PAGADO",
                esRecurrente: !!esRecurrente,
                frecuencia: frecuencia || "UNICO",
                categoriaGastoId: Number(categoriaGastoId),
                sucursalId,
                userId,
                cuotaActual: null,
                cuotaTotal: null,
                recurrenciaId: null
            },
            include: {
                categoria: true
            }
        });

        return NextResponse.json({ data: nuevoGasto }, { status: 201 });
    } catch (error) {
        console.error("Error POST Gasto:", error);
        return NextResponse.json(
            { error: "Error al registrar el gasto" },
            { status: 500 }
        );
    }
}
