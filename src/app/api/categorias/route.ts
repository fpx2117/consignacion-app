/* eslint-disable */
// @ts-nocheck
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Helper to get sucursalId from headers
function getSucursalIdFromHeader(req: NextRequest): number {
  const header = req.headers.get("x-sucursal-id");
  const parsed = parseInt(header || "1", 10);
  return Number.isNaN(parsed) ? 1 : parsed;
}

// GET: Obtener todas las categorías ordenadas por nombre (por sucursal)
export async function GET(req: NextRequest) {
  try {
    const sucursalId = getSucursalIdFromHeader(req);
    const categorias = await prisma.categoria.findMany({
      where: { sucursalId },
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
    const sucursalId = getSucursalIdFromHeader(req);

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
        ...(descuentos && { descuentos }),
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