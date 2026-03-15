import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth/require-auth";
import { isGlobalSucursalView } from "@/lib/sucursalScope";
import { EstadoGasto, FrecuenciaGasto } from "@prisma/client";

export async function GET(req: Request) {
    const auth = await requireAuth();
    if (!auth.ok) return auth.res;

    const { searchParams } = new URL(req.url);
    const estado = searchParams.get("estado"); // PENDIENTE | PAGADO
    const categoriaId = searchParams.get("categoriaId");

    try {
        const isGlobal = isGlobalSucursalView(auth);

        if (isGlobal) {
            const gastosGlobales = await prisma.gasto.findMany({
                where: {
                    ...(estado && { estado: estado as EstadoGasto }),
                    ...(categoriaId && { categoriaGastoId: Number(categoriaId) }),
                },
                include: {
                    categoria: true,
                    user: { select: { id: true, nombre: true } },
                    sucursalesCompartidas: true,
                },
                orderBy: { fecha: "desc" },
            });

            return NextResponse.json({ data: gastosGlobales });
        }

        // Gastos propios de esta sucursal
        const ownGastos = await prisma.gasto.findMany({
            where: {
                sucursalId: auth.activeSucursalId,
                ...(estado && { estado: estado as EstadoGasto }),
                ...(categoriaId && { categoriaGastoId: Number(categoriaId) }),
            },
            include: {
                categoria: true,
                user: { select: { id: true, nombre: true } },
                sucursalesCompartidas: true,
            },
            orderBy: { fecha: "desc" },
        });

        // Normalizar gastos propios: si son compartidos, usar el montoProporcional
        const normalizedOwn = ownGastos.map((g) => {
            if (g.esCompartido && g.sucursalesCompartidas?.length > 0) {
                const link = g.sucursalesCompartidas.find(
                    (s) => s.sucursalId === auth.activeSucursalId
                );
                if (link) {
                    return { ...g, monto: link.montoProporcional };
                }
            }
            return g;
        });

        // Gastos compartidos con esta sucursal por otra sucursal (ella es la dueña)
        const sharedLinks = await prisma.gastoSucursal.findMany({
            where: {
                sucursalId: auth.activeSucursalId,
                gasto: {
                    NOT: { sucursalId: auth.activeSucursalId },
                    ...(estado && { estado: estado as EstadoGasto }),
                },
            },
            include: {
                gasto: {
                    include: {
                        categoria: true,
                        user: { select: { id: true, nombre: true } },
                        sucursalesCompartidas: true,
                    },
                },
            },
        });

        // Filtrar por categoría si aplica y mapear con montoProporcional
        const compartidos = sharedLinks
            .filter((link) => !categoriaId || link.gasto.categoriaGastoId === Number(categoriaId))
            .map((link) => ({
                ...link.gasto,
                monto: link.montoProporcional,
                esVistaCompartida: true,
            }));

        // Merge y ordenar por fecha desc
        const all = [...normalizedOwn, ...compartidos].sort(
            (a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime()
        );

        return NextResponse.json({ data: all });
    } catch {
        return NextResponse.json(
            { error: "Error al obtener gastos" },
            { status: 500 }
        );
    }
}

export async function POST(req: Request) {
    const auth = await requireAuth();
    if (!auth.ok) return auth.res;
    if (isGlobalSucursalView(auth)) {
        return NextResponse.json({ error: "Vista global en modo solo lectura. Selecciona una sucursal para crear gastos." }, { status: 409 });
    }

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
            categoriaGastoId,
            sucursalesCompartir, // number[] - IDs de sucursales con las que compartir
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

        const esCompartido =
            Array.isArray(sucursalesCompartir) && sucursalesCompartir.length > 1;
        const totalSucursales = esCompartido ? sucursalesCompartir.length : 1;
        const montoProporcional = Number(monto) / totalSucursales;

        // Si es recurrente y tiene fecha de vencimiento final, generamos cuotas
        if (!!esRecurrente && endDate && (["MENSUAL", "SEMANAL", "ANUAL"] as FrecuenciaGasto[]).includes(frecuencia as FrecuenciaGasto)) {
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

            // Crear cada cuota individualmente para poder crear los GastoSucursal asociados
            for (let index = 0; index < dates.length; index++) {
                const d = dates[index];
                const gasto = await prisma.gasto.create({
                    data: {
                        monto: Number(monto),
                        motivo,
                        fecha: d,
                        fechaVencimiento: d,
                        estado: index === 0 ? ((estado as EstadoGasto) || "PAGADO") : "PENDIENTE",
                        esRecurrente: true,
                        frecuencia: frecuencia as FrecuenciaGasto,
                        categoriaGastoId: Number(categoriaGastoId),
                        sucursalId,
                        userId,
                        recurrenciaId,
                        cuotaActual: index + 1,
                        cuotaTotal: totalCuotas,
                        esCompartido,
                    },
                });

                if (esCompartido) {
                    await prisma.gastoSucursal.createMany({
                        data: sucursalesCompartir.map((sid: number) => ({
                            gastoId: gasto.id,
                            sucursalId: sid,
                            montoProporcional,
                        })),
                    });
                }
            }

            return NextResponse.json(
                { message: `${totalCuotas} cuotas generadas correctamente` },
                { status: 201 }
            );
        }

        // Caso normal (único)
        const nuevoGasto = await prisma.gasto.create({
            data: {
                monto: Number(monto),
                motivo,
                fecha: startDate,
                fechaVencimiento: endDate,
                        estado: (estado as EstadoGasto) || "PAGADO",
                        esRecurrente: !!esRecurrente,
                        frecuencia: (frecuencia as FrecuenciaGasto) || "UNICO",
                categoriaGastoId: Number(categoriaGastoId),
                sucursalId,
                userId,
                cuotaActual: null,
                cuotaTotal: null,
                recurrenciaId: null,
                esCompartido,
            },
            include: { categoria: true },
        });

        if (esCompartido) {
            await prisma.gastoSucursal.createMany({
                data: sucursalesCompartir.map((sid: number) => ({
                    gastoId: nuevoGasto.id,
                    sucursalId: sid,
                    montoProporcional,
                })),
            });
        }

        return NextResponse.json({ data: nuevoGasto }, { status: 201 });
    } catch (err) {
        console.error("Error POST Gasto:", err);
        return NextResponse.json(
            { error: "Error al registrar el gasto" },
            { status: 500 }
        );
    }
}
