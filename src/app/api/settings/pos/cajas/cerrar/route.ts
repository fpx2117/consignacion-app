/* eslint-disable */
// @ts-nocheck
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/requireAuth";

export async function POST(req: Request) {
    const auth = await requireAuth();
    if (!auth.ok) return auth.res;

    try {
        const { sesionId, montoReal, observaciones } = await req.json();

        // 1. Obtener la sesión con todos sus movimientos
        const sesion = await prisma.sesionCaja.findUnique({
            where: { id: sesionId },
            include: {
                ventas: { where: { tipo: "CASUAL" } }, // Solo ventas de mostrador
                movimientos: true,
            },
        });

        if (!sesion || sesion.estado === "CERRADA") {
            return NextResponse.json({ error: "Sesión no encontrada o ya cerrada." }, { status: 400 });
        }

        // 2. Calcular monto esperado
        const totalVentas = sesion.ventas.reduce((acc, v) => acc + Number(v.total), 0);
        const totalIngresos = sesion.movimientos
            .filter(m => m.tipo === "INGRESO")
            .reduce((acc, m) => acc + Number(m.monto), 0);
        const totalEgresos = sesion.movimientos
            .filter(m => m.tipo === "EGRESO")
            .reduce((acc, m) => acc + Number(m.monto), 0);

        const montoEsperado = Number(sesion.montoInicial) + totalVentas + totalIngresos - totalEgresos;
        const diferencia = Number(montoReal) - montoEsperado;

        // 3. Cerrar sesión y guardar auditoría
        const sesionCerrada = await prisma.sesionCaja.update({
            where: { id: sesionId },
            data: {
                estado: "CERRADA",
                fechaCierre: new Date(),
                montoFinalEsperado: montoEsperado,
                montoFinalReal: montoReal,
                diferencia: diferencia,
                observaciones: observaciones
            }
        });

        return NextResponse.json({ data: sesionCerrada });

    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}