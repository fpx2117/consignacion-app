# T17-C — Ganancia, margen y transición de stock

## Objetivo

Cerrar la extracción de cálculos puros de T17 con las tres fórmulas que faltaban:
ganancia, margen y transición de stock.

## Contrato

`src/modules/finance/profit.ts`:

- `calculateLineProfit({ subtotal, units, unitCost })` —
  `subtotal - unitCost × units`.
- `calculateGrossProfit(lines, globalDiscount)` — suma las líneas en orden y resta
  el descuento global **al final**, igual que la acumulación histórica.
- `calculateMarginPercentage({ profit, base })` — `profit / base × 100`, o `0` si
  la base no es positiva. **No redondea**: el reporte de POS redondea en su
  plantilla y el asistente muestra el decimal.

`src/modules/inventory/stock-authority.ts`:

- `calculateStockTransition(post, appliedDelta)` — `{ prev: post - delta, post }`.
  Es el orden que se persiste en `MovimientoStock` (`stockPrevio`/`stockPosterior`)
  y se deriva del post-image ya persistido, no de una lectura previa.

## Sitios migrados

| Fórmula | Sitios |
| --- | --- |
| Ganancia bruta por venta | `lib/dashboard/kpi-logic.ts`, `ver/pos/[period]/pdf` |
| Ganancia por línea liquidada | `ver/consig/[period]/pdf` (cuatro agregados) |
| Margen porcentual | `producto-wizard-dialog.tsx`, `pos-report-template.ts` |
| Transición de stock | `incrementBranchStock`, `decrementBranchStock`, `aplicarMovimientoStock` |

## Qué NO cambia

- Sin redondeo nuevo. `Math.round` sigue exactamente donde estaba (plantilla de
  POS); el resto conserva el decimal.
- El descuento global se resta después de acumular, preservando el orden de
  operaciones (no es lo mismo que restarlo por línea en coma flotante).
- Un descuento mayor que la ganancia deja ganancia negativa; base 0 o negativa da
  margen 0.
- La transición de stock sigue devolviendo `prev` derivado del post-image; un
  estado inconsistente (stock negativo) no se recorta.
- Sin cambios en locks, transacciones, folios ni autoridad de stock.

## Evidencia

- `calculateLineProfit`: diferencial por `Object.is` sobre 6 subtotales × 4
  unidades × 4 costos, incluido subtotal negativo.
- `calculateGrossProfit`: 4 carritos × 6 descuentos, comparados contra la
  acumulación literal; casos de ganancia negativa, carrito vacío y descuento sin
  carrito.
- `calculateMarginPercentage`: base 0 y negativa, ganancia negativa, redondeo
  delegado al llamador.
- `calculateStockTransition`: alta, baja, post 0, post negativo y coma flotante
  exacta.
- Pureza estricta de `profit.ts` (sin Prisma, fechas, configuración ni redondeo).
- Integración PostgreSQL 16 descartable de autoridad y transiciones de stock, más
  la aplicación de stock de OCR, que ahora usa la transición centralizada.

## Fuera de alcance

- T16, producción, commit, push y deploy.
- La doble resta de `descuentoGlobal` en reportes (bug preexistente, requiere
  aprobación aparte).
