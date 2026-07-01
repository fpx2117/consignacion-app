// src/app/api/facturas-proveedor/[id]/route.ts

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth/require-auth";
import { canAccessSucursalResource } from "@/lib/security/sucursalScope";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.res;

  const { id } = await params;
  const facturaId = Number(id);
  if (!Number.isInteger(facturaId)) {
    return NextResponse.json({ error: "Factura no encontrada" }, { status: 404 });
  }

  const factura = await prisma.facturaProveedor.findUnique({
    where: { id: facturaId },
    include: {
      proveedor: true,
      items: { include: { producto: true }, orderBy: { id: "asc" } },
    },
  });

  if (!factura || !canAccessSucursalResource(auth, factura.sucursalId)) {
    return NextResponse.json({ error: "Factura no encontrada" }, { status: 404 });
  }

  return NextResponse.json({ data: factura });
}
