// src/app/api/facturas-proveedor/[id]/route.ts

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { EstadoFacturaProveedor } from "@prisma/client";
import { requireAuth, requireRole } from "@/lib/auth/require-auth";
import { canAccessSucursalResource } from "@/lib/security/sucursalScope";
import { updateFacturaProveedorSchema } from "@/lib/validators/factura-proveedor";

const NO_EDITABLES: EstadoFacturaProveedor[] = [
  EstadoFacturaProveedor.CONFIRMADA,
  EstadoFacturaProveedor.CANCELADA,
];

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.res;

  const { id } = await params;
  const facturaId = Number(id);
  if (!Number.isInteger(facturaId)) {
    return NextResponse.json(
      { error: "Factura no encontrada" },
      { status: 404 },
    );
  }

  const factura = await prisma.facturaProveedor.findUnique({
    where: { id: facturaId },
    include: {
      proveedor: true,
      items: { include: { producto: true }, orderBy: { id: "asc" } },
    },
  });

  if (!factura || !canAccessSucursalResource(auth, factura.sucursalId)) {
    return NextResponse.json(
      { error: "Factura no encontrada" },
      { status: 404 },
    );
  }

  return NextResponse.json({ data: factura });
}

// Edita la cabecera de la factura (proveedor detectado, número, fecha, moneda,
// total) mientras el usuario está revisando — corrige lo que la IA/OCR haya
// leído mal. No se permite una vez que la factura ya quedó CONFIRMADA/CANCELADA.
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.res;
  if (!requireRole(auth.user, ["ADMIN"])) {
    return NextResponse.json(
      { error: "No tienes permisos (Admin requerido)" },
      { status: 403 },
    );
  }

  const { id } = await params;
  const facturaId = Number(id);
  if (!Number.isInteger(facturaId)) {
    return NextResponse.json(
      { error: "Factura no encontrada" },
      { status: 404 },
    );
  }

  const body = await req.json().catch(() => null);
  const parsed = updateFacturaProveedorSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validación fallida", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const factura = await prisma.facturaProveedor.findUnique({
    where: { id: facturaId },
  });
  if (!factura || !canAccessSucursalResource(auth, factura.sucursalId)) {
    return NextResponse.json(
      { error: "Factura no encontrada" },
      { status: 404 },
    );
  }

  if (NO_EDITABLES.includes(factura.estado)) {
    return NextResponse.json(
      {
        error: `La factura está en estado ${factura.estado} y no se puede editar.`,
      },
      { status: 409 },
    );
  }

  const {
    proveedorId,
    fecha,
    proveedorNombreDetectado,
    proveedorCuitDetectado,
    numeroFactura,
    moneda,
    totalDetectado,
  } = parsed.data;

  if (proveedorId) {
    const proveedorExiste = await prisma.proveedor.findUnique({
      where: { id: proveedorId },
    });
    if (!proveedorExiste) {
      return NextResponse.json(
        { error: "Proveedor no encontrado" },
        { status: 404 },
      );
    }
  }

  const facturaActualizada = await prisma.facturaProveedor.update({
    where: { id: facturaId },
    data: {
      ...(proveedorId !== undefined ? { proveedorId } : {}),
      ...(proveedorNombreDetectado !== undefined
        ? { proveedorNombreDetectado }
        : {}),
      ...(proveedorCuitDetectado !== undefined
        ? { proveedorCuitDetectado }
        : {}),
      ...(numeroFactura !== undefined ? { numeroFactura } : {}),
      ...(moneda !== undefined ? { moneda } : {}),
      ...(totalDetectado !== undefined ? { totalDetectado } : {}),
      ...(fecha !== undefined ? { fecha: fecha ? new Date(fecha) : null } : {}),
    },
    include: {
      proveedor: true,
      items: { include: { producto: true }, orderBy: { id: "asc" } },
    },
  });

  return NextResponse.json({ data: facturaActualizada });
}
