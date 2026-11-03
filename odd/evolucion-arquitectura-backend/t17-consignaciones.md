# T17-B — Cálculos puros de consignaciones y recargo

## Objetivo

Sacar de los adaptadores tres cálculos que estaban repetidos inline:
`applyConsignmentMarkup`, `calculatePendingUnits` y `validateSettlement`.

## Contrato

`src/modules/pricing/consignment-markup.ts`:

- `applyConsignmentMarkup(basePrice, percentage)` — `basePrice * (1 + pct/100)`,
  con `Number(percentage) || 0`. No redondea: el redondeo lo decide cada
  adaptador (el carrito redondea a centavos al final; la consignación persiste el
  valor tal cual).

`src/modules/consignaciones/units.ts`:

- `calculatePendingUnits({ unitsEntregadas, unitsVendidasAcum, unitsDevueltasAcum })`
  — la resta vigente, sin recortar a 0: un estado inconsistente se ve negativo.
- `validateSettlement({ ...contadores, unitsVendidas, unitsDevueltas })` — devuelve
  `{ ok: true, pending, requested, remaining }` o
  `{ ok: false, reason: "EXCEDE_PENDIENTE", pending, requested }`. No lanza: el
  adaptador decide el error.

Ambas son puras: sin Prisma, sin configuración global, sin fechas, sin redondeo.

## Sitios migrados

Recargo de consignación (8 expresiones en 7 archivos):

- `src/lib/storefront/catalog-cart-pricing.ts` — carrito del catálogo.
- `src/app/api/consignaciones/route.ts` — alta de consignación
  (`precioUnitario` persistido).
- `src/app/api/consignaciones/[id]/route.ts` — detalle agregado al editar.
- `src/app/(system-guard)/(protected)/consignaciones/nueva/page.tsx`,
  `consignaciones/[id]/page.tsx` (dos lugares) y `consignaciones/[id]/liquidar/page.tsx`
  — precios sugeridos en la UI.
- `src/app/(system-guard)/(protected)/liquidaciones/[id]/editar/page.tsx` —
  totales al editar una liquidación.

Unidades pendientes (11 expresiones en 9 archivos):

- `POST /api/consignaciones` (`[id]`): validación de liquidación y cierre
  automático.
- `PUT /api/liquidaciones/[id]`: validación y cierre automático.
- `POST /api/liquidaciones/consignacion/[consignacionId]`: validación y cierre.
- `dashboard/actions/dashboard-actions.ts` y `GET /api/dashboard/consignaciones`:
  agregados por consignación.
- `ver/consig/[period]/pdf`: totales del reporte (dos lugares).
- `consignaciones/[id]/liquidar/page.tsx`: pendientes por fila.

Los tres sitios de validación conservan el mismo contrato observable: mensaje
`EXCEDE_PENDIENTE:<detalleId>` y mapeo a `409` en el handler.

## Qué NO cambia

- No hay redondeo nuevo. `100 * (1 + 10/100)` sigue dando
  `110.00000000000001`; unificarlo sería una decisión de política monetaria.
- El margen negativo de consignación se sigue aceptando como configuración.
- Las unidades pendientes siguen pudiendo ser negativas si el estado persistido
  es inconsistente; los reportes siguen aplicando `Math.max(0, …)` donde ya lo
  hacían.
- Sin cambios en locks, transacciones, folios ni stock.

## Evidencia

- Recargo: diferencial con `Object.is` contra la expresión literal anterior sobre
  5 precios × 8 porcentajes (`undefined`, `null`, `0`, `10`, `21`, `7.5`, `100`,
  `-5`), más casos fijados.
- Pendientes: los seis estados representativos (completo, parcial, exacto, cero,
  negativo por exceso de ventas, negativo por exceso de devoluciones) y la
  validación en sus bordes: consumir exactamente lo pendiente es válido, un solo
  excedente rechaza, pendiente 0 no permite liquidar y sí permite liquidar 0.
- Integración PostgreSQL 16 descartable, ejecutada archivo por archivo (no con
  `--test`, que interpreta los corchetes de `[id]` como glob y no corre nada):
  `consignaciones/route`, `consignaciones/stock-authority`,
  `consignaciones/[id]/stock-authority`, `liquidaciones/[id]/stock-authority`,
  `liquidaciones/consignacion/[consignacionId]/stock-authority` y
  `ventas/[id]/route`, todos con 1 test verde.
- Las rutas unitarias de consignaciones y liquidaciones siguen verdes.
- Test de inventario: las dos fórmulas sólo aparecen en su módulo; casos
  sintéticos fuera de módulo fallan como corresponde.

## Límite de la prueba

El test de pendientes fija la definición (incluidos los negativos); no es un
oráculo independiente de la resta, porque la resta **es** la definición. El valor
está en `validateSettlement` y en que los once sitios dejaron de reimplementarla.

## Fuera de alcance

- `calculateGrossProfit`, `calculateMarginPercentage`, `calculateStockTransition`
  (T17-C).
- Política de redondeo, T16, producción, commit, push y deploy.
