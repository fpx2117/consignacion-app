# T16 — Cutover a `DB_PROJECTION`

## Estado

Herramienta implementada y verificada. **El defecto que bloqueaba el cutover está
corregido** por la migración aditiva `20261101040000_serialize_stock_projection`.
Falta ejecutarlo en producción.

## El defecto y la corrección

El trigger histórico recalculaba `Producto = SUM(StockSucursal)` dentro de cada
transacción. Bajo `READ COMMITTED` ese `SELECT` no bloquea sobre filas no
confirmadas: lee la última versión confirmada. Dos writers concurrentes en
sucursales distintas del mismo producto calculaban cada uno una suma que ignoraba
al otro y el último pisaba la proyección. La verificación de T16 lo reprodujo:
**deriva 1**.

La corrección no cambia el mecanismo ni las rutas de creación: agrega
`PERFORM 1 FROM "Producto" WHERE "id" = v_producto_id FOR UPDATE` antes del
recalculo. El lock convierte la proyección en una sección crítica por producto: el
segundo writer espera el commit del primero y su `SUM` arranca de un snapshot
nuevo que ya incluye el cambio confirmado.

Se descartó la proyección por delta: con el lock, el `SUM` sigue siendo idempotente
para las rutas que crean producto y stock con el mismo valor inicial, así que no
hace falta tocar T15-F/G.

## La herramienta de cutover

`scripts/migrations/cutover-t16-stock-projection.mjs` hace
`APP_DUAL_WRITE` (B1, sin trigger) → `DB_PROJECTION` (B1, con proyección) en una
sola transacción:

- Confirmación exacta de base; local y terminada en `test` salvo
  `T16_ALLOW_PRODUCTION=true`, que además exige `T16_ATTEST_B1=true` (el script no
  puede detectar instancias `L0`).
- `pg_advisory_xact_lock`, capacidad `FOR UPDATE`, luego `StockSucursal` y
  `Producto` en `SHARE ROW EXCLUSIVE` (bloquea escrituras, deja leer).
- Exige estado inicial `APP_DUAL_WRITE` sin trigger, función pública no
  `SECURITY DEFINER` y **serializada** (`FOR UPDATE` en su definición); si no,
  rechaza y no toca nada.
- Reconcilia, instala el trigger, prueba entrada/salida real y verifica deriva 0
  antes de commitear.
- Devuelve evidencia: `driftBefore`, `probe`, `productCount`.

## Evidencia

`npm run stock:cutover:test` (bases descartables, PostgreSQL 16) cubre:

- Cutover completo y rollback compensatorio, con deriva 0 en ambos extremos.
- Entrada, salida y restitución proyectadas por el trigger.
- **Concurrencia**: dos writers en sucursales distintas del mismo producto dejan
  deriva 0 (antes: 1).
- Producto sin filas de sucursal reconciliado a 0.
- Rechazo de estados incompatibles (capacidad distinta, trigger ya instalado).
- Rechazo de una función de proyección no serializada.
- Atomicidad: un fallo inyectado en `beforeCommit` revierte trigger y capacidad.
- El lock de capacidad de un writer B1 bloquea el `FOR UPDATE` del cutover.

Regresión: `npm run stock:authority:test` (T14) sigue verde, y las suites de
integración de autoridad, transiciones, OCR, concurrencia y POS pasan sobre el
esquema con la función nueva.

## Ejecución en producción (2026-11-03)

Deploy `75207a3a` con la migración; `prisma migrate deploy` aplicado dentro del
contenedor (33 migraciones). Cutover transaccional: `driftBefore=0`, `probe=in-out`,
`productCount=248`, commit confirmado. Estado final: `DB_PROJECTION`, trigger
presente, deriva 0, `/login` 200. Sonda posterior en una transacción revertida:
`1 → 2 → 1` con proyección igual a la suma en cada paso.

## Lo que queda después

- Observación de `B1` en `DB_PROJECTION` antes de cualquier `C2` (cambio de código,
  fuera de T16).
- Smoke autenticado de los flujos de T15-R.
- Rollback disponible en cualquier momento: `compensate-t14`
  (`DB_PROJECTION → APP_DUAL_WRITE`), ya probado en descartable.
