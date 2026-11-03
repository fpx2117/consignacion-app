// src/modules/pricing/consignment-markup.ts
// Recargo de consignación: el precio que se cobra al cliente consignatario es el
// precio de venta más un porcentaje configurado por el comercio.
//
// Función pura y única fuente de la fórmula. La usan la creación de
// consignaciones y el carrito del catálogo público, que hasta T17 la repetían
// inline. No redondea: el redondeo lo decide cada adaptador (el carrito redondea
// a centavos al final; la consignación persiste el valor tal cual).

export function applyConsignmentMarkup(
  basePrice: number,
  percentage?: number | null,
): number {
  const surcharge = Number(percentage) || 0;
  return basePrice * (1 + surcharge / 100);
}
