// src/modules/finance/profit.ts
// Ganancia y margen de una venta o de una línea liquidada.
//
// Función pura y única fuente de las tres fórmulas que estaban repetidas en el
// dashboard, los PDF de POS y consignaciones y el asistente de productos:
//
//   ganancia de línea = subtotal - costoUnitario × unidades
//   ganancia bruta    = Σ ganancia de línea - descuento global
//   margen            = ganancia / base × 100   (0 si la base no es positiva)
//
// No redondea. El redondeo es una decisión de presentación: el reporte de POS
// redondea a entero en su plantilla y el asistente muestra el decimal.

export type ProfitLine = {
  /** Subtotal de la línea ya neto de descuentos de línea. */
  subtotal: number;
  units: number;
  /** Costo por unidad; el llamador aplica su propio `|| 0` de origen. */
  unitCost: number;
};

export function calculateLineProfit(line: ProfitLine): number {
  return line.subtotal - line.unitCost * line.units;
}

/**
 * Ganancia bruta de una operación: suma las líneas en orden y resta el
 * descuento global al final, igual que la acumulación histórica.
 */
export function calculateGrossProfit(
  lines: readonly ProfitLine[],
  globalDiscount?: number | null,
): number {
  let profit = 0;
  for (const line of lines) {
    profit += calculateLineProfit(line);
  }
  return profit - (Number(globalDiscount) || 0);
}

/**
 * Margen porcentual sobre una base. `base <= 0` devuelve 0 en lugar de Infinity,
 * que es el comportamiento que tenían todos los llamadores.
 */
export function calculateMarginPercentage(input: {
  profit: number;
  base: number;
}): number {
  return input.base > 0 ? (input.profit / input.base) * 100 : 0;
}
