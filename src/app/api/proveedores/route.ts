// src/app/api/proveedores/route.ts
// CRUD mínimo de Proveedor. Global al negocio (sin sucursalId): el aprendizaje de
// proveedor (alias, códigos, formato de factura) se comparte entre todas las sucursales.

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth/require-auth";
import { createProveedorSchema } from "@/lib/validators/proveedor";

// GET: listar proveedores activos
export async function GET(_req: NextRequest) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.res;

  try {
    const proveedores = await prisma.proveedor.findMany({
      where: { activo: true },
      orderBy: { nombre: "asc" },
    });
    return NextResponse.json(proveedores, {
      headers: {
        "Cache-Control": "private, max-age=60, stale-while-revalidate=120",
      },
    });
  } catch (err) {
    console.error("Error al obtener proveedores:", err);
    return NextResponse.json(
      { error: "Error al obtener proveedores" },
      { status: 500 },
    );
  }
}

// POST: crear un proveedor nuevo
export async function POST(req: NextRequest) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.res;

  const body = await req.json().catch(() => null);
  const parsed = createProveedorSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validación fallida", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  try {
    const nuevoProveedor = await prisma.proveedor.create({
      data: {
        nombre: parsed.data.nombre.trim(),
        cuit: parsed.data.cuit?.trim() || null,
        monedaPreferida: parsed.data.monedaPreferida,
      },
    });
    return NextResponse.json(nuevoProveedor);
  } catch (err) {
    console.error("Error al crear proveedor:", err);
    return NextResponse.json(
      { error: "Error al crear el proveedor" },
      { status: 500 },
    );
  }
}
