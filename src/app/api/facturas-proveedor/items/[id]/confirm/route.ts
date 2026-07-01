// src/app/api/facturas-proveedor/items/[id]/confirm/route.ts
// Confirma un item de factura contra un producto existente (el sugerido por el
// matching o uno elegido manualmente por el usuario). Suma stock, actualiza costo +
// historial y guarda el alias proveedor→producto. Nunca toca precioVenta.

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { EstadoItemFactura } from "@prisma/client";
import { requireAuth, requireRole } from "@/lib/auth/require-auth";
import { confirmarItemSchema } from "@/lib/validators/factura-proveedor-item";
import { cargarItemFacturaAccesible } from "@/lib/ocr/cargar-item-factura";
import {
  aplicarMovimientoStock,
  registrarCostoYAlias,
  actualizarEstadoFacturaSiCompleta,
} from "@/lib/ocr/aplicar-confirmacion";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.res;
  if (!requireRole(auth.user, ["ADMIN"])) {
    return NextResponse.json({ error: "No tienes permisos (Admin requerido)" }, { status: 403 });
  }

  const { id } = await params;
  const itemId = Number(id);
  if (!Number.isInteger(itemId)) {
    return NextResponse.json({ error: "Item de factura no encontrado" }, { status: 404 });
  }

  const body = await req.json().catch(() => null);
  const parsed = confirmarItemSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validación fallida", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const cargado = await cargarItemFacturaAccesible(auth, itemId);
  if (!cargado.ok) {
    return NextResponse.json({ error: cargado.error }, { status: cargado.status });
  }
  const { item } = cargado;

  const producto = await prisma.producto.findUnique({ where: { id: parsed.data.productoId } });
  if (!producto || producto.sucursalId !== item.factura.sucursalId) {
    return NextResponse.json({ error: "El producto elegido no pertenece a esta sucursal" }, { status: 400 });
  }

  try {
    const resultado = await prisma.$transaction(async (tx) => {
      await aplicarMovimientoStock(tx, {
        productoId: parsed.data.productoId,
        sucursalId: item.factura.sucursalId,
        cantidad: item.cantidad,
        observaciones: "Carga por OCR de factura de proveedor",
      });

      const variacion = await registrarCostoYAlias(tx, {
        productoId: parsed.data.productoId,
        proveedorId: item.factura.proveedorId,
        facturaItemId: item.id,
        codigoProveedor: item.codigoProveedor,
        descripcionNormalizada: item.descripcionNormalizada,
        precioUnitario: item.precioUnitario !== null ? Number(item.precioUnitario) : null,
        moneda: item.factura.moneda,
      });

      const itemActualizado = await tx.facturaProveedorItem.update({
        where: { id: item.id },
        data: {
          productoId: parsed.data.productoId,
          estado: EstadoItemFactura.CONFIRMADO,
          matchMotivo: item.productoId === parsed.data.productoId ? item.matchMotivo : "manual",
        },
      });

      await actualizarEstadoFacturaSiCompleta(tx, item.facturaId);

      return { itemActualizado, variacion };
    });

    return NextResponse.json({ data: resultado.itemActualizado, variacionCosto: resultado.variacion });
  } catch (error) {
    console.error("[FACTURA_PROVEEDOR_ITEM_CONFIRM_ERROR]", { itemId, error });
    return NextResponse.json({ error: "Error al confirmar el item" }, { status: 500 });
  }
}
