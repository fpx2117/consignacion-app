// src/app/api/facturas-proveedor/[id]/cancel/route.ts
// Cancela una factura (baja lógica): la marca como CANCELADA y purga su binario del
// disco. No se borra el registro: los items quedan como historial, tachados en la UI.

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { EstadoFacturaProveedor } from "@prisma/client";
import { requireAuth, requireRole } from "@/lib/auth/require-auth";
import { canAccessSucursalResource } from "@/lib/security/sucursalScope";
import { purgarArchivoFacturaSiFinalizada } from "@/lib/ocr/aplicar-confirmacion";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.res;
  if (!requireRole(auth.user, ["ADMIN"])) {
    return NextResponse.json({ error: "No tienes permisos (Admin requerido)" }, { status: 403 });
  }

  const { id } = await params;
  const facturaId = Number(id);
  if (!Number.isInteger(facturaId)) {
    return NextResponse.json({ error: "Factura no encontrada" }, { status: 404 });
  }

  const factura = await prisma.facturaProveedor.findUnique({ where: { id: facturaId } });
  if (!factura || !canAccessSucursalResource(auth, factura.sucursalId)) {
    return NextResponse.json({ error: "Factura no encontrada" }, { status: 404 });
  }

  if (factura.estado === EstadoFacturaProveedor.CANCELADA) {
    return NextResponse.json({ data: factura });
  }

  const cancelada = await prisma.facturaProveedor.update({
    where: { id: facturaId },
    data: { estado: EstadoFacturaProveedor.CANCELADA },
    include: { proveedor: true, _count: { select: { items: true } } },
  });

  // Post-update: purga el binario y los blobs de OCR/IA (ya no sirven).
  await purgarArchivoFacturaSiFinalizada(facturaId);

  return NextResponse.json({ data: cancelada });
}
