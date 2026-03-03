/* eslint-disable */
// @ts-nocheck
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET: Obtener todas las categorías ordenadas por nombre
export async function GET() {
  try {
    const categorias = await prisma.categoria.findMany({
      orderBy: { nombre: "asc" },
    });
    return NextResponse.json(categorias);
  } catch (error) {
    return NextResponse.json(
      { error: "Error al obtener categorías" },
      { status: 500 }
    );
  }
}

// POST: Crear una nueva categoría
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { nombre, color, descuentos } = body;

    if (!nombre) {
      return NextResponse.json(
        { error: "El nombre es obligatorio" },
        { status: 400 }
      );
    }

    const nuevaCategoria = await prisma.categoria.create({
      data: {
        nombre: nombre.trim(),
        ...(color && { color }),
        ...(descuentos && { descuentos }),
      },
    });

    return NextResponse.json(nuevaCategoria);
  } catch (error) {
    // Manejo simple para nombres duplicados si tienes un constraint unique
    return NextResponse.json(
      { error: "Error al crear la categoría. Quizás ya existe." },
      { status: 500 }
    );
  }
}