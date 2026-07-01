// src/lib/ocr/cargar-item-factura.ts
// Carga un FacturaProveedorItem validando que la sucursal de la factura sea
// accesible para el usuario autenticado. Compartido por confirm/create-product/ignore.

import { prisma } from "@/lib/prisma";
import { EstadoItemFactura } from "@prisma/client";
import type { SucursalAuthContext } from "@/lib/security/sucursalScope";
import { canAccessSucursalResource } from "@/lib/security/sucursalScope";

const ESTADOS_TERMINALES: EstadoItemFactura[] = [
  EstadoItemFactura.CONFIRMADO,
  EstadoItemFactura.PRODUCTO_CREADO,
  EstadoItemFactura.IGNORADO,
];

export type CargarItemResultado =
  | { ok: true; item: NonNullable<Awaited<ReturnType<typeof buscarItem>>> }
  | { ok: false; status: 404 | 409; error: string };

function buscarItem(itemId: number) {
  return prisma.facturaProveedorItem.findUnique({
    where: { id: itemId },
    include: { factura: true },
  });
}

export async function cargarItemFacturaAccesible(
  auth: SucursalAuthContext,
  itemId: number,
): Promise<CargarItemResultado> {
  const item = await buscarItem(itemId);

  if (!item || !canAccessSucursalResource(auth, item.factura.sucursalId)) {
    return { ok: false, status: 404, error: "Item de factura no encontrado" };
  }

  if (ESTADOS_TERMINALES.includes(item.estado)) {
    return { ok: false, status: 409, error: `El item ya está en estado ${item.estado} y no se puede modificar.` };
  }

  return { ok: true, item };
}
