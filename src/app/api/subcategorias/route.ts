/* eslint-disable */
// @ts-nocheck
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/requireAuth";
import { isGlobalSucursalView } from "@/lib/sucursalScope";

// GET: Obtener subcategorías por categoriaId
export async function GET(req: NextRequest) {
  // Auth: Requiere usuario autenticado
  const auth = await requireAuth();
  if (!auth.ok) return auth.res;

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
  // Auth: Requiere usuario autenticado
  const auth = await requireAuth();
  if (!auth.ok) return auth.res;
  if (isGlobalSucursalView(auth)) {
    return NextResponse.json({ error: "Vista global en modo solo lectura. Selecciona una sucursal para crear subcategorías." }, { status: 409 });
  }

  try {
    const body = await req.json();
    const { nombre, categoriaId, descuentos } = body;

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
        ...(descuentos && { descuentos }),
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
