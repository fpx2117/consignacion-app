/* eslint-disable */
// @ts-nocheck
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/requireAuth";

// GET: Obtener todas las categorías ordenadas por nombre (por sucursal)
export async function GET(req: NextRequest) {
  // Auth: Requiere usuario autenticado
  const auth = await requireAuth();
  if (!auth.ok) return auth.res;

  try {
    const sucursalId = auth.activeSucursalId;
    const categorias = await prisma.categoria.findMany({
      where: { sucursalId },
      orderBy: { nombre: "asc" },
    });
    return NextResponse.json(categorias);
  } catch (error) {
    console.error("Error al obtener categorías:", error);
    return NextResponse.json(
      { error: "Error al obtener categorías" },
      { status: 500 }
    );
  }
}

// POST: Crear una nueva categoría
export async function POST(req: NextRequest) {
  // Auth: Requiere usuario autenticado
  const auth = await requireAuth();
  if (!auth.ok) return auth.res;

  try {
    const body = await req.json();
    const { nombre, color } = body;
    const sucursalId = auth.activeSucursalId;

    if (!nombre) {
      return NextResponse.json(
        { error: "El nombre es obligatorio" },
        { status: 400 }
      );
    }

    const nuevaCategoria = await prisma.categoria.create({
      data: {
        nombre: nombre.trim(),
        sucursalId,
        ...(color && { color }),
      },
    });

    return NextResponse.json(nuevaCategoria);
  } catch (error) {
    // Manejo simple para nombres duplicados si tienes un constraint unique
    return NextResponse.json(
      { error: "Error al crear la categoría. Quizás ya existe en esta sucursal." },
      { status: 500 }
    );
  }
}
