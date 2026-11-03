# T17-A — Núcleo aritmético de ventas

## Objetivo

Extraer de `POST /api/ventas` los cálculos de línea y de totales a funciones
puras, sin mover un solo bit del resultado observable (ADR 003).

## Contrato

`src/modules/ventas/sale-totals.ts`:

- `applyDiscount` — descuento de línea: el manual manda; si es `0`, aplica el de
  catálogo por unidad multiplicado por las unidades.
- `calculateLineTotal` — `unitPrice * units - discount`.
- `applyCardSurcharge` — recargo sobre el neto, sólo si el medio lo habilita y la
  tasa es positiva.
- `calculateSaleTotals` — suma los subtotales en orden, resta el descuento global
  y suma el recargo calculado sobre `subtotal - descuentoGlobal`.

Reglas de pureza: todo entra por argumentos, no hay Prisma, configuración global,
fechas ni eventos. El adaptador (la ruta) sigue resolviendo el descuento de
catálogo con `calcularDescuentoEfectivo` y mapeando el medio de pago.

## Qué NO cambia

- No se introduce redondeo ni punto fijo: los totales conservan la representación
  de coma flotante previa y Prisma la persiste igual.
- Un descuento global mayor al subtotal sigue dejando total negativo.
- El recargo de tarjeta sigue calculándose sobre el neto y sólo con `TARJETA`.
- `descuentoGlobal` se sigue guardando como el monto aplicado.

## Evidencia de equivalencia

- Diferencial contra una transcripción literal del código anterior: 480 casos de
  línea y 375 de totales, comparados con `Object.is` (no `==`), incluyendo
  `0.1 + 0.2`, `1500.5 * 2 - 300.1`, tasas `7.5`/`21`/`100`, descuentos manuales
  y de catálogo simultáneos, y totales negativos.
- Casos fijados a mano con valores exactamente representables.
- Contrato persistido: `route.integration.test.ts` sobre PostgreSQL 16 descartable
  verifica los `Decimal` almacenados con el carrito de 3+2 unidades, descuento
  manual, descuento de catálogo, descuento global `0.01` y tarjeta `7.5%`:
  `total` `42.99`, líneas `30.01` y `9.99`, `descuentoGlobal` `0.01`.
- Pureza verificada estáticamente: sin `@prisma`, `new Date`, `Date.now`,
  `Math.random`, `toFixed` ni `Math.round`.
- Se restauró la aserción T09 que se había perdido al reescribir `route.test.ts`:
  la venta y el pago se fechan con la timezone resuelta (`America/Bogota`), no con
  una zona fija. Se probó por mutación: cambiando la zona resuelta a
  `America/Santiago` la prueba falla.

## Cómo correrlo

```bash
node --import tsx --test src/modules/ventas/sale-totals.test.ts
node --import tsx src/app/api/ventas/route.test.ts
node --import tsx --test src/app/api/ventas/route.transaction-errors.test.ts
# con PostgreSQL descartable (TEST_DATABASE_URL + T12_CONFIRM_DATABASE):
node --import tsx --test src/app/api/ventas/route.integration.test.ts
```

## Hallazgo registrado (no corregido)

En ventas POS, `total` ya tiene restado el descuento global, pero varios reportes
lo restan otra vez (`src/lib/dashboard/kpi-logic.ts:542`,
`src/app/ver/dashboard/[period]/pdf/route.ts:214`,
`src/app/ver/pos/[period]/pdf/route.ts:381`). Corregirlo cambia cifras visibles y
requiere aprobación separada; queda fuera de T17.

## Fuera de alcance

- `applyConsignmentMarkup`, `calculatePendingUnits`, `validateSettlement`,
  `calculateGrossProfit`, `calculateMarginPercentage`,
  `calculateStockTransition` (T17-B/C).
- Redondeo por línea, punto fijo y cualquier cambio de política monetaria.
- Frontend del POS, reportes, T16, producción, commit, push y deploy.
