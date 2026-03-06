/* eslint-disable */
// @ts-nocheck
// src/app/api/pagos/[clienteId]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/requireAuth";

export async function POST(
    req: NextRequest,
    { params }: { params: Promise<{ clienteId: string }> }
) {
    const auth = await requireAuth();
    if (!auth.ok) return auth.res;

    const usuarioId = Number((auth.user as any).id);

    try {
        const { clienteId: clienteIdStr } = await params; // ✅ await al params
        const clienteId = Number(clienteIdStr);

        if (isNaN(clienteId)) {
            return NextResponse.json({ error: "ID de cliente inválido" }, { status: 400 });
        }

        const body = await req.json();
        const { monto, metodo } = body;

        if (!monto || monto <= 0 || !metodo) {
            return NextResponse.json({ error: "Monto y método son obligatorios" }, { status: 400 });
        }

        const sesionActiva = await prisma.sesionCaja.findFirst({
            where: { usuarioId, estado: "ABIERTA" },
        });

        if (!sesionActiva) {
            return NextResponse.json(
                { error: "No puedes cobrar pagos sin abrir tu turno de caja primero." },
                { status: 403 }
            );
        }

        const result = await prisma.$transaction(async (tx) => {
            const nuevoPago = await tx.pago.create({
                data: {
                    clienteId,
                    sucursalId: auth.activeSucursalId, // <--- NUEVO
                    tipo: "DEUDA",                     // <--- NUEVO
                    monto,
                    metodo,
                    sesionCajaId: sesionActiva.id,
                },
            });

            const clienteActualizado = await tx.cliente.update({
                where: { id: clienteId },
                data: { saldoCuenta: { decrement: monto } },
            });

            return { pago: nuevoPago, saldo: clienteActualizado.saldoCuenta };
        });

        return NextResponse.json({ data: result });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}