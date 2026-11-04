# T21 — Liquidaciones con reclamo condicional

## El defecto

Los tres escritores que consumen unidades de una consignación hacían lo mismo:
leer los acumulados, validar en memoria con `validateSettlement` y después
`update({ increment })`. Bajo `READ COMMITTED` dos liquidaciones concurrentes
leen el mismo snapshot, **ambas** pasan la validación y **ambas** incrementan:
la suma supera las unidades entregadas. La reproducción de T10 lo dejaba en
`test.skip` porque el defecto seguía vigente.

## La corrección

`src/modules/consignaciones/settlement-claim.ts` expone `claimSettlementUnits`,
un único `UPDATE` condicional:

```sql
UPDATE "ConsignacionDetalle"
SET "unitsVendidasAcum" = "unitsVendidasAcum" + $vendidas,
    "unitsDevueltasAcum" = "unitsDevueltasAcum" + $devueltas
WHERE "id" = $id
  AND ("unitsEntregadas" - "unitsVendidasAcum" - "unitsDevueltasAcum") >= $total
```

La validación y el incremento son la misma operación. El segundo escritor espera
el lock de fila y re-evalúa el predicado contra la versión confirmada: si ya no
alcanza, afecta **0 filas** y la ruta lanza `EXCEDE_PENDIENTE` (409) dentro de la
misma transacción. `validateSettlement` sigue estando como chequeo temprano; la
garantía es el reclamo.

Aplicado en los tres escritores:

| Archivo | Uso |
|---|---|
| `liquidaciones/[id]` | corrección de una liquidación |
| `liquidaciones/consignacion/[consignacionId]` | liquidación por consignación |
| `consignaciones/[id]` | edición con liquidación |

Además, la corrección ahora bloquea la fila de `Liquidacion` (`FOR UPDATE`) al
abrir la transacción: sin eso, dos correcciones concurrentes de la misma
liquidación revertían dos veces los mismos acumulados.

## Evidencia

- **PostgreSQL, concurrencia real**: el escenario que estaba en `test.skip` ahora
  corre. Dos reclamos de 4 sobre 5 unidades: el primero afecta **1 fila**, el
  segundo —tras esperar el lock y re-evaluar— afecta **0**, y el detalle queda en
  `unitsVendidasAcum = 4 ≤ unitsEntregadas = 5`.
- **6 invariantes de concurrencia**, sin skips.
- Las tres suites de autoridad de stock de liquidaciones y consignaciones, la de
  productos, anulación, OCR, numeración, stock y la caracterización HTTP de
  ventas: **13 suites de integración verdes desde una base recién migrada y en
  orden alfabético**, más la suite de liquidación por consignación ejecutada
  aislada sobre otra base nueva.
- `tsc`, `npm run lint` y `next build` limpios.
- **Producción**: deploy `30d61fbe` SUCCESS, `/login` 200. Auditoría:
  `DB_PROJECTION`, trigger 1, 34 migraciones, **deriva 0**, **0 detalles
  sobreliquidados**, 922 ventas, 248 productos, **0 consignaciones** (no hay
  dato histórico que reconciliar).

## Hallazgo colateral corregido

La suite de liquidación por consignación heredaba el trigger de proyección del
estado que dejaban las migraciones. Al dejar de instalarse en una base nueva
(T15-R), el test falló con `STOCK_AUTHORITY_INCOMPATIBLE` en la primera corrida y
con "trigger already exists" en la segunda: dependía del orden de ejecución.
Ahora establece su precondición explícitamente.

## Rollback

Es un cambio sólo de código, sin esquema ni datos. Revertir el deploy restaura la
validación en memoria. Los acumulados ya escritos siguen siendo válidos: el
reclamo nunca permite superar lo entregado.
