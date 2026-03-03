/* eslint-disable */
// @ts-nocheck
// src/app/api/settings/pos/cajas/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/requireAuth";

export async function GET() {
    const auth = await requireAuth();
    if (!auth.ok) return auth.res;
    try {
        const cajas = await prisma.caja.findMany({
            where: { activa: true, sucursalId: auth.activeSucursalId },
            orderBy: { id: "asc" }
        });
        return NextResponse.json({ data: cajas });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function POST(req: Request) {
    const auth = await requireAuth();
    if (!auth.ok) return auth.res;

    if ((auth.user as any).rol !== "ADMIN") {
        return NextResponse.json({ error: "Solo admin puede crear cajas." }, { status: 403 });
    }

    try {
        const { nombre } = await req.json();
        if (!nombre) return NextResponse.json({ error: "Nombre obligatorio." }, { status: 400 });

        const nuevaCaja = await prisma.caja.create({
            data: { nombre: nombre.trim(), activa: true, sucursalId: auth.activeSucursalId }
        });
        return NextResponse.json({ data: nuevaCaja });
    } catch (error: any) {
        if (error.code === 'P2002') return NextResponse.json({ error: "Ya existe." }, { status: 400 });
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}