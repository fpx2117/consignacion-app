// src/modules/ventas/sale-totals.ts
// Núcleo aritmético del registro de ventas (ADR 003).
//
// Reglas no negociables:
//   - Reproduce EXACTAMENTE la aritmética y el orden de las operaciones que hoy
//     ejecuta POST /api/ventas. No se redondea nada: los totales se persisten con
//     la misma representación de coma flotante que antes.
//   - Funciones puras: reciben todos sus datos, no consultan Prisma, no leen
//     configuración global, no crean fechas, no emiten eventos.
//   - Unificar el redondeo es una decisión separada (ADR 003): este módulo no la
//     toma. Cualquier cambio acá debe pasar por los tests de equivalencia.

export type LineDiscountInput = {
  /** Precio unitario efectivo (override de sucursal o precio del producto). */
  unitPrice: number;
  units: number;
  /** Descuento absoluto cargado a mano en el POS para la línea completa. */
  manualDiscount?: number | null;
  /** Descuento de catálogo por unidad, ya resuelto por el adaptador. */
  catalogDiscountPerUnit?: number | null;
};

export type LineTotal = {
  unitPrice: number;
  units: number;
  discount: number;
  subtotal: number;
};

export type SaleTotalsInput = {
  /** Subtotal de cada línea, en el orden en que se cargaron. */
  lineSubtotals: readonly number[];
  globalDiscount?: number | null;
  appliesCardSurcharge: boolean;
  cardSurchargePercentage?: number | null;
};

export type SaleTotals = {
  subtotal: number;
  globalDiscount: number;
  surcharge: number;
  total: number;
};

/**
 * Descuento total de la línea: el manual manda; si no hay manual (0), se aplica
 * el descuento de catálogo por unidad multiplicado por las unidades.
 */
export function applyDiscount(input: LineDiscountInput): number {
  const manual = Number(input.manualDiscount ?? 0) || 0;
  if (manual !== 0) return manual;
  if (input.catalogDiscountPerUnit == null) return 0;
  return input.catalogDiscountPerUnit * input.units;
}

export function calculateLineTotal(input: LineDiscountInput): LineTotal {
  const discount = applyDiscount(input);
  return {
    unitPrice: input.unitPrice,
    units: input.units,
    discount,
    subtotal: input.unitPrice * input.units - discount,
  };
}

/**
 * Recargo de tarjeta sobre un monto. Sólo aplica cuando el medio lo habilita y
 * la configuración tiene una tasa positiva; si no, devuelve 0 exacto.
 */
export function applyCardSurcharge(input: {
  amount: number;
  appliesCardSurcharge: boolean;
  cardSurchargePercentage?: number | null;
}): number {
  const percentage = Number(input.cardSurchargePercentage ?? 0) || 0;
  if (!input.appliesCardSurcharge || !(percentage > 0)) return 0;
  return input.amount * (percentage / 100);
}

/**
 * Totales de la venta. Suma los subtotales en orden, resta el descuento global y
 * suma el recargo de tarjeta, que se calcula sobre el neto.
 */
export function calculateSaleTotals(input: SaleTotalsInput): SaleTotals {
  let subtotal = 0;
  for (const lineSubtotal of input.lineSubtotals) {
    subtotal += lineSubtotal;
  }

  const globalDiscount = Number(input.globalDiscount ?? 0) || 0;
  const surcharge = applyCardSurcharge({
    amount: subtotal - globalDiscount,
    appliesCardSurcharge: input.appliesCardSurcharge,
    cardSurchargePercentage: input.cardSurchargePercentage,
  });

  return {
    subtotal,
    globalDiscount,
    surcharge,
    total: subtotal - globalDiscount + surcharge,
  };
}
