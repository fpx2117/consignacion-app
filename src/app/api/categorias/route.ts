import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth/require-auth";
import { buildSucursalWhere, isGlobalSucursalView } from "@/lib/sucursalScope";

// GET: Obtener todas las categorías ordenadas por nombre (por sucursal)
export async function GET(_req: NextRequest) {
  // Auth: Requiere usuario autenticado
  const auth = await requireAuth();
  if (!auth.ok) return auth.res;

  try {
    const sucursalWhere = buildSucursalWhere(auth);
    const categorias = await prisma.categoria.findMany({
      where: sucursalWhere,
      orderBy: { nombre: "asc" },
    });
    return NextResponse.json(categorias, {
      headers: {
        "Cache-Control": "private, max-age=120, stale-while-revalidate=300",
      },
    });
  } catch (err) {
    console.error("Error al obtener categorías:", err);
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
  if (isGlobalSucursalView(auth)) {
    return NextResponse.json({ error: "Vista global en modo solo lectura. Selecciona una sucursal para crear categorías." }, { status: 409 });
  }

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
  } catch {
    // Manejo simple para nombres duplicados si tienes un constraint unique
    return NextResponse.json(
      { error: "Error al crear la categoría. Quizás ya existe en esta sucursal." },
      { status: 500 }
    );
  }
}
