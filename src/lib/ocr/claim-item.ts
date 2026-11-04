// src/lib/ocr/claim-item.ts
// Transición condicional de un ítem de factura de proveedor.
//
// El chequeo en `cargarItemFacturaAccesible` (estado terminal → 409) es una
// lectura previa: dos confirmaciones concurrentes pueden pasar las dos y aplicar
// stock dos veces. El reclamo convierte "chequear y cambiar" en un único UPDATE
// condicionado al estado, dentro de la misma transacción que aplica el stock: si
// el ítem ya fue procesado, el `count` es 0, la transacción entera se revierte y
// el stock no se duplica.

import { EstadoItemFactura, type Prisma } from "@prisma/client";

import { ESTADOS_TERMINALES } from "@/lib/ocr/cargar-item-factura";

export type ItemClaimInput = {
  itemId: number;
  estado: EstadoItemFactura;
  productoId?: number | null;
  matchMotivo?: string | null;
};

/** Devuelve `false` si el ítem ya estaba en un estado terminal. */
export async function claimItemState(
  tx: Prisma.TransactionClient,
  input: ItemClaimInput,
): Promise<boolean> {
  const updated = await tx.facturaProveedorItem.updateMany({
    where: {
      id: input.itemId,
      estado: { notIn: ESTADOS_TERMINALES },
    },
    data: {
      estado: input.estado,
      ...(input.productoId !== undefined
        ? { productoId: input.productoId }
        : {}),
      ...(input.matchMotivo !== undefined
        ? { matchMotivo: input.matchMotivo }
        : {}),
    },
  });

  return updated.count === 1;
}

export const ITEM_YA_PROCESADO = "ITEM_YA_PROCESADO";
