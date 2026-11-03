# T16 — Cutover a `DB_PROJECTION`: herramienta lista, diseño no probado

## Qué se construyó

`scripts/migrations/cutover-t16-stock-projection.mjs` hace la transición
`APP_DUAL_WRITE` (B1, sin trigger) → `DB_PROJECTION` (B1, con proyección) en una
sola transacción:

- Confirmación exacta de base; local y terminada en `test` salvo
  `T16_ALLOW_PRODUCTION=true`, que además exige `T16_ATTEST_B1=true` (el script no
  puede detectar instancias `L0`).
- `pg_advisory_xact_lock`, capacidad `FOR UPDATE`, luego `StockSucursal` y
  `Producto` en `SHARE ROW EXCLUSIVE` (bloquea escrituras, deja leer).
- Valida estado inicial: capacidad `APP_DUAL_WRITE` y trigger ausente; exige la
  función `public.sync_producto_stock()` no `SECURITY DEFINER`.
- Reconcilia `Producto = SUM(StockSucursal)`, instala el trigger, prueba
  entrada/salida real sobre una fila y verifica deriva 0 antes de commitear.
- Devuelve evidencia: `driftBefore`, `probe`, `productCount`.

`scripts/migrations/verify-t16-stock-projection.mjs` (npm `stock:cutover:test`)
cubre en bases descartables: cutover + comportamiento de la proyección +
rollback, rechazo de estados incompatibles, rollback ante fallo inyectado en
`beforeCommit`, bloqueo del lock de capacidad, guardas de producción y un producto
sin filas de sucursal.

## El resultado que importa

**La verificación falla a propósito.** El caso concurrente —dos writers en
sucursales distintas, el escenario que el ADR 002 exige reproducir antes de
aprobar el trigger— deja **deriva 1**:

```
T16 bloqueado: la proyección por SUM pierde actualizaciones con writers
concurrentes en sucursales distintas (drift=1).
```

## Por qué

El trigger recalcula `Producto = SUM(StockSucursal)` dentro de cada transacción.
Un `SELECT` bajo `READ COMMITTED` **no bloquea** sobre filas no confirmadas: lee la
última versión confirmada. Con dos transacciones concurrentes en sucursales
distintas, la segunda suma el valor viejo de la primera y pisa la proyección.
Es exactamente el motivo por el que `stock-authority.ts` eligió deltas atómicos
para `APP_DUAL_WRITE` (T15-A).

La reproducción de T10 ya lo insinuaba; ahora está caracterizada sobre la base
real de T16, con el mecanismo que se pretendía activar.

## Consecuencia

`DB_PROJECTION` **no es seguro** con el trigger actual. T16 no se ejecuta en
producción. Producción sigue en `APP_DUAL_WRITE`, que es la configuración que sí
pasa concurrencia (deltas atómicos por fila).

## Opciones (decisión pendiente)

1. **Quedarse en `APP_DUAL_WRITE`** y retirar el objetivo `C2`. Es la opción más
   barata y ya está validada; el costo es mantener el delta en la aplicación y no
   poder simplificar los writers.
2. **Proyección por delta**: nueva migración que reemplace el trigger por uno que
   aplique `NEW - OLD` (o `+NEW` en INSERT, `-OLD` en DELETE) sobre `Producto`.
   Los incrementos se serializan en el lock de fila de `Producto`, así que es
   seguro bajo concurrencia. Requiere migración nueva, no editar la existente,
   verificación de concurrencia y recién entonces el cutover ya escrito.
3. **Serializar writers** con `FOR UPDATE` sobre `Producto`: correcto pero
   convierte cada venta en un cuello de botella; no recomendado.

La opción 2 es la única que preserva el objetivo arquitectónico. La herramienta
de cutover ya está lista para usarse cuando la proyección sea segura; lo que falta
es el mecanismo, no la transición.

## Límites conocidos

- El veredicto de concurrencia cubre sucursales distintas sobre el mismo producto.
  Falta el caso de dos writers sobre la **misma** fila (hoy serializado por el lock
  de fila) y el de INSERT/DELETE concurrentes.
- La guarda "solo local" es defensa en profundidad: una URL puede cambiar el host
  real; la barrera efectiva es la confirmación exacta del nombre de base.
