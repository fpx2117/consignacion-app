/* eslint-disable */
// @ts-nocheck
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/requireAuth";

export async function GET() {
    const auth = await requireAuth();
    if (!auth.ok) return auth.res;

    if ((auth.user as any).rol !== "ADMIN") {
        return NextResponse.json({ error: "Permisos insuficientes" }, { status: 403 });
    }

    const sucursales = await prisma.sucursal.findMany({
        orderBy: { id: "asc" }
    });

    return NextResponse.json({ data: sucursales });
}

export async function POST(req: Request) {
    const auth = await requireAuth();
    if (!auth.ok) return auth.res;

    if ((auth.user as any).rol !== "ADMIN") {
        return NextResponse.json({ error: "Permisos insuficientes" }, { status: 403 });
    }

    try {
        const { nombre, activa } = await req.json();

        if (!nombre) {
            return NextResponse.json({ error: "Nombre obligatorio" }, { status: 400 });
        }

        const nueva = await prisma.sucursal.create({
            data: {
                nombre: nombre.trim(),
                activa: activa ?? true
            }
        });

        return NextResponse.json({ data: nueva }, { status: 201 });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
