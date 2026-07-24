// src/app/api/proveedores/route.ts
// CRUD mínimo de Proveedor. Por sucursal: cada sucursal tiene sus propios
// proveedores, salvo vista global (ADMIN), que ve todos en modo solo lectura.

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth/require-auth";
import {
  buildSucursalWhere,
  isGlobalSucursalView,
} from "@/lib/security/sucursalScope";
import { createProveedorSchema } from "@/lib/validators/proveedor";

// GET: listar proveedores activos de la sucursal activa (o todos, en vista global)
export async function GET(_req: NextRequest) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.res;

  try {
    const isGlobal = isGlobalSucursalView(auth);
    const proveedores = await prisma.proveedor.findMany({
      where: { activo: true, ...buildSucursalWhere(auth) },
      orderBy: isGlobal
        ? [{ sucursalId: "asc" }, { nombre: "asc" }]
        : [{ nombre: "asc" }],
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

// POST: crear un proveedor nuevo en la sucursal activa
export async function POST(req: NextRequest) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.res;
  if (isGlobalSucursalView(auth)) {
    return NextResponse.json(
      {
        error:
          "Vista global en modo solo lectura. Selecciona una sucursal para crear un proveedor.",
      },
      { status: 409 },
    );
  }

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
        sucursalId: auth.activeSucursalId,
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
