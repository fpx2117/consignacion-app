// src/app/api/facturas-proveedor/items/[id]/ignore/route.ts
// Marca un item como ignorado: no afecta stock ni costo ni alias.

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { EstadoItemFactura } from "@prisma/client";
import { requireAuth, requireRole } from "@/lib/auth/require-auth";
import { cargarItemFacturaAccesible } from "@/lib/ocr/cargar-item-factura";
import { claimItemState, ITEM_YA_PROCESADO } from "@/lib/ocr/claim-item";
import {
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
    return NextResponse.json(
      { error: "No tienes permisos (Admin requerido)" },
      { status: 403 },
    );
  }

  const { id } = await params;
  const itemId = Number(id);
  if (!Number.isInteger(itemId)) {
    return NextResponse.json(
      { error: "Item de factura no encontrado" },
      { status: 404 },
    );
  }

  const cargado = await cargarItemFacturaAccesible(auth, itemId);
  if (!cargado.ok) {
    return NextResponse.json(
      { error: cargado.error },
      { status: cargado.status },
    );
  }
  const { item } = cargado;

  const itemActualizado = await prisma
    .$transaction(async (tx) => {
      const claimed = await claimItemState(tx, {
        itemId: item.id,
        estado: EstadoItemFactura.IGNORADO,
      });
      if (!claimed) throw new Error(ITEM_YA_PROCESADO);

      await actualizarEstadoFacturaSiCompleta(tx, item.facturaId);
      return tx.facturaProveedorItem.findUniqueOrThrow({
        where: { id: item.id },
      });
    })
    .catch((error: unknown) => {
      if (error instanceof Error && error.message === ITEM_YA_PROCESADO) {
        return null;
      }
      throw error;
    });

  if (!itemActualizado) {
    return NextResponse.json(
      { error: "El item ya fue procesado por otra acción." },
      { status: 409 },
    );
  }

  // Post-commit: purga el binario si la factura quedó completa.
  await purgarArchivoFacturaSiFinalizada(item.facturaId);

  return NextResponse.json({ data: itemActualizado });
}
