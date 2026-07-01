// src/app/api/facturas-proveedor/[id]/confirm-all/route.ts
// Confirmación masiva: sólo aplica a items en COINCIDENCIA_SEGURA (>=95%). El resto
// sigue requiriendo revisión manual uno por uno vía /items/:id/confirm.

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { EstadoItemFactura } from "@prisma/client";
import { requireAuth, requireRole } from "@/lib/auth/require-auth";
import { canAccessSucursalResource } from "@/lib/security/sucursalScope";
import {
  aplicarMovimientoStock,
  registrarCostoYAlias,
  actualizarEstadoFacturaSiCompleta,
  purgarArchivoFacturaSiFinalizada,
} from "@/lib/ocr/aplicar-confirmacion";

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

  const factura = await prisma.facturaProveedor.findUnique({
    where: { id: facturaId },
    include: {
      items: { where: { estado: EstadoItemFactura.COINCIDENCIA_SEGURA, productoId: { not: null } } },
    },
  });

  if (!factura || !canAccessSucursalResource(auth, factura.sucursalId)) {
    return NextResponse.json({ error: "Factura no encontrada" }, { status: 404 });
  }

  if (factura.items.length === 0) {
    return NextResponse.json({ data: { confirmados: 0, errores: [] } });
  }

  let confirmados = 0;
  const errores: { itemId: number; error: string }[] = [];

  for (const item of factura.items) {
    try {
      await prisma.$transaction(async (tx) => {
        await aplicarMovimientoStock(tx, {
          productoId: item.productoId!,
          sucursalId: factura.sucursalId,
          cantidad: item.cantidad,
          observaciones: "Carga por OCR de factura de proveedor (confirmación masiva)",
        });

        await registrarCostoYAlias(tx, {
          productoId: item.productoId!,
          proveedorId: factura.proveedorId,
          facturaItemId: item.id,
          codigoProveedor: item.codigoProveedor,
          descripcionNormalizada: item.descripcionNormalizada,
          precioUnitario: item.precioUnitario !== null ? Number(item.precioUnitario) : null,
          moneda: factura.moneda,
        });

        await tx.facturaProveedorItem.update({
          where: { id: item.id },
          data: { estado: EstadoItemFactura.CONFIRMADO },
        });
      });
      confirmados++;
    } catch (error) {
      console.error("[FACTURA_PROVEEDOR_CONFIRM_ALL_ITEM_ERROR]", { itemId: item.id, error });
      errores.push({ itemId: item.id, error: error instanceof Error ? error.message : "Error desconocido" });
    }
  }

  await prisma.$transaction((tx) => actualizarEstadoFacturaSiCompleta(tx, facturaId));

  // Post-commit: purga el binario si la factura quedó completa.
  await purgarArchivoFacturaSiFinalizada(facturaId);

  return NextResponse.json({ data: { confirmados, errores } });
}
