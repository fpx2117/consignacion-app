// src/app/api/proveedores/[id]/route.ts

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth/require-auth";
import { canAccessSucursalResource, isGlobalSucursalView } from "@/lib/security/sucursalScope";
import { updateProveedorSchema } from "@/lib/validators/proveedor";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.res;

  const { id } = await params;
  const proveedorId = Number(id);
  if (!Number.isInteger(proveedorId)) {
    return NextResponse.json({ error: "Proveedor no encontrado" }, { status: 404 });
  }

  const proveedor = await prisma.proveedor.findUnique({ where: { id: proveedorId } });
  if (!proveedor || !canAccessSucursalResource(auth, proveedor.sucursalId)) {
    return NextResponse.json({ error: "Proveedor no encontrado" }, { status: 404 });
  }

  return NextResponse.json(proveedor);
}

// PATCH: actualizar nombre/cuit/moneda/activo de un proveedor
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.res;
  if (isGlobalSucursalView(auth)) {
    return NextResponse.json(
      { error: "Vista global en modo solo lectura. Selecciona una sucursal para editar un proveedor." },
      { status: 409 },
    );
  }

  const { id } = await params;
  const proveedorId = Number(id);
  if (!Number.isInteger(proveedorId)) {
    return NextResponse.json({ error: "Proveedor no encontrado" }, { status: 404 });
  }

  const body = await req.json().catch(() => null);
  const parsed = updateProveedorSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validación fallida", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const existing = await prisma.proveedor.findUnique({ where: { id: proveedorId } });
  if (!existing || !canAccessSucursalResource(auth, existing.sucursalId)) {
    return NextResponse.json({ error: "Proveedor no encontrado" }, { status: 404 });
  }

  try {
    const updated = await prisma.proveedor.update({
      where: { id: proveedorId },
      data: {
        ...(parsed.data.nombre !== undefined && { nombre: parsed.data.nombre.trim() }),
        ...(parsed.data.cuit !== undefined && { cuit: parsed.data.cuit?.trim() || null }),
        ...(parsed.data.monedaPreferida !== undefined && { monedaPreferida: parsed.data.monedaPreferida }),
        ...(parsed.data.activo !== undefined && { activo: parsed.data.activo }),
      },
    });
    return NextResponse.json(updated);
  } catch (err) {
    console.error("Error al actualizar proveedor:", err);
    return NextResponse.json({ error: "Error al actualizar el proveedor" }, { status: 500 });
  }
}

// DELETE: baja lógica (activo=false). No se borra físicamente: hay FKs con onDelete Restrict
// desde FacturaProveedor/ProductoProveedorAlias que preservan el historial de compras.
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.res;
  if (isGlobalSucursalView(auth)) {
    return NextResponse.json(
      { error: "Vista global en modo solo lectura. Selecciona una sucursal para eliminar un proveedor." },
      { status: 409 },
    );
  }

  const { id } = await params;
  const proveedorId = Number(id);
  if (!Number.isInteger(proveedorId)) {
    return NextResponse.json({ error: "Proveedor no encontrado" }, { status: 404 });
  }

  const existing = await prisma.proveedor.findUnique({ where: { id: proveedorId } });
  if (!existing || !canAccessSucursalResource(auth, existing.sucursalId)) {
    return NextResponse.json({ error: "Proveedor no encontrado" }, { status: 404 });
  }

  await prisma.proveedor.update({
    where: { id: proveedorId },
    data: { activo: false },
  });

  return NextResponse.json({ success: true });
}
