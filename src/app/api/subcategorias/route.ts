/* eslint-disable */
// @ts-nocheck
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET: Obtener subcategorías por categoriaId
export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const categoriaId = searchParams.get("categoriaId");

        if (!categoriaId) {
            return NextResponse.json(
                { error: "categoriaId es obligatorio" },
                { status: 400 }
            );
        }

        const subcategorias = await prisma.subcategoria.findMany({
            where: { categoriaId: parseInt(categoriaId, 10) },
            orderBy: { nombre: "asc" },
        });
        return NextResponse.json(subcategorias);
    } catch (error) {
        return NextResponse.json(
            { error: "Error al obtener subcategorías" },
            { status: 500 }
        );
    }
}

// POST: Crear una nueva subcategoría
export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { nombre, categoriaId } = body;

        if (!nombre || !categoriaId) {
            return NextResponse.json(
                { error: "Nombre y categoriaId son obligatorios" },
                { status: 400 }
            );
        }

        const nuevaSubcategoria = await prisma.subcategoria.create({
            data: {
                nombre: nombre.trim(),
                categoriaId: parseInt(categoriaId, 10),
            },
        });

        return NextResponse.json(nuevaSubcategoria);
    } catch (error) {
        return NextResponse.json(
            { error: "Error al crear la subcategoría. Quizás ya existe en esta categoría." },
            { status: 500 }
        );
    }
}
