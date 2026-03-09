/* eslint-disable */
// @ts-nocheck
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/requireAuth";

export async function GET() {
    const auth = await requireAuth();
    if (!auth.ok || (auth.user as any).rol !== "ADMIN") return auth.res;

    try {
        const usuarios = await prisma.usuario.findMany({
            include: { horarios: true },
            where: { activo: true }
        });
        return NextResponse.json({ data: usuarios });
    } catch (error: any) {
        console.error("Error al obtener los horarios:", error);
        return NextResponse.json({ error: "Error al obtener los horarios" }, { status: 500 });
    }
}

export async function POST(req: Request) {
    const auth = await requireAuth();
    if (!auth.ok || (auth.user as any).rol !== "ADMIN") return auth.res;

    try {
        const { usuarioId, horarios } = await req.json();

        // Guardamos o actualizamos cada día usando upsert
        for (const h of horarios) {
            await prisma.horarioLaboral.upsert({
                where: { usuarioId_diaSemana: { usuarioId, diaSemana: h.diaSemana } },
                update: { horaInicio: h.horaInicio, horaFin: h.horaFin, activo: h.activo },
                create: { usuarioId, diaSemana: h.diaSemana, horaInicio: h.horaInicio, horaFin: h.horaFin, activo: h.activo }
            });
        }

        return NextResponse.json({ message: "Horarios actualizados" });
    } catch (error: any) {
        console.error("Error al actualizar los horarios:", error);
        return NextResponse.json({ error: "Error al actualizar los horarios" }, { status: 500 });
    }
}