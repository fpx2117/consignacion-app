// src/app/api/facturas-proveedor/items/[id]/route.ts
// Edita un item de factura (texto, código de proveedor, cantidad, precio) antes
// de confirmarlo — corrige lo que la IA/OCR haya leído mal. No toca stock, costo
// ni alias; eso sigue ocurriendo únicamente en confirm/create-product.

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, requireRole } from "@/lib/auth/require-auth";
import { cargarItemFacturaAccesible } from "@/lib/ocr/cargar-item-factura";
import { updateFacturaProveedorItemSchema } from "@/lib/validators/factura-proveedor-item";

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
  const itemId = Number(id);
  if (!Number.isInteger(itemId)) {
    return NextResponse.json(
      { error: "Item de factura no encontrado" },
      { status: 404 },
    );
  }

  const body = await req.json().catch(() => null);
  const parsed = updateFacturaProveedorItemSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validación fallida", details: parsed.error.flatten() },
      { status: 400 },
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

  const {
    textoOriginal,
    codigoProveedor,
    cantidad,
    precioUnitario,
    totalLinea,
  } = parsed.data;

  // Si se edita cantidad o precio y no se manda un total de línea explícito,
  // se recalcula para que quede consistente con lo que el usuario corrigió.
  const cantidadFinal = cantidad ?? item.cantidad;
  const precioFinal =
    precioUnitario !== undefined && precioUnitario !== null
      ? precioUnitario
      : Number(item.precioUnitario ?? 0);
  const recalcularTotal =
    (cantidad !== undefined || precioUnitario !== undefined) &&
    totalLinea === undefined;

  const itemActualizado = await prisma.facturaProveedorItem.update({
    where: { id: item.id },
    data: {
      ...(textoOriginal !== undefined ? { textoOriginal } : {}),
      ...(codigoProveedor !== undefined ? { codigoProveedor } : {}),
      ...(cantidad !== undefined ? { cantidad } : {}),
      ...(precioUnitario !== undefined ? { precioUnitario } : {}),
      ...(totalLinea !== undefined
        ? { totalLinea }
        : recalcularTotal
          ? { totalLinea: cantidadFinal * precioFinal }
          : {}),
    },
  });

  return NextResponse.json({ data: itemActualizado });
}
