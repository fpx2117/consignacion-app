// src/app/api/facturas-proveedor/route.ts

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { EstadoFacturaProveedor } from "@prisma/client";
import { requireAuth } from "@/lib/auth/require-auth";
import { buildSucursalWhere } from "@/lib/security/sucursalScope";

const ESTADOS_VALIDOS = new Set<string>(Object.values(EstadoFacturaProveedor));

// GET: listar facturas de proveedor de la sucursal activa (o todas, en vista global ADMIN)
export async function GET(req: NextRequest) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.res;

  try {
    const { searchParams } = new URL(req.url);
    const estadoParam = searchParams.get("estado")?.trim();
    const estado = estadoParam && ESTADOS_VALIDOS.has(estadoParam)
      ? (estadoParam as EstadoFacturaProveedor)
      : undefined;
    const proveedorIdParam = searchParams.get("proveedorId");
    const proveedorId = proveedorIdParam ? Number(proveedorIdParam) : undefined;

    const sucursalWhere = buildSucursalWhere(auth);

    const facturas = await prisma.facturaProveedor.findMany({
      where: {
        ...sucursalWhere,
        ...(estado ? { estado } : {}),
        ...(proveedorId ? { proveedorId } : {}),
      },
      include: {
        proveedor: true,
        _count: { select: { items: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ data: facturas });
  } catch (err) {
    console.error("Error al listar facturas de proveedor:", err);
    return NextResponse.json(
      { error: "Error al obtener las facturas de proveedor" },
      { status: 500 },
    );
  }
}
