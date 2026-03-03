/* eslint-disable */
// @ts-nocheck
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/requireAuth";

export async function GET() {
    const auth = await requireAuth();
    if (!auth.ok) return auth.res;

    try {
        const categorias = await prisma.categoriaGasto.findMany({
            where: { sucursalId: auth.activeSucursalId },
            orderBy: { nombre: "asc" },
        });
        return NextResponse.json({ data: categorias });
    } catch (error) {
        return NextResponse.json(
            { error: "Error al obtener categorías de gastos" },
            { status: 500 }
        );
    }
}

export async function POST(req: Request) {
    const auth = await requireAuth();
    if (!auth.ok) return auth.res;

    // Solo ADMIN puede crear categorías de gastos
    if (auth.user?.rol !== "ADMIN") {
        return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    try {
        const body = await req.json();
        const { nombre } = body;

        if (!nombre) {
            return NextResponse.json(
                { error: "El nombre es obligatorio" },
                { status: 400 }
            );
        }

        const nuevaCategoria = await prisma.categoriaGasto.create({
            data: {
                nombre: nombre.trim(),
                sucursalId: auth.activeSucursalId,
            },
        });

        return NextResponse.json({ data: nuevaCategoria }, { status: 201 });
    } catch (error) {
        console.error("POST CATEGORIA ERROR:", error);
        return NextResponse.json(
            { error: "Error al crear la categoría. Quizás ya existe." },
            { status: 500 }
        );
    }
}
