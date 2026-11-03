# T14-A — Capacidad persistida de autoridad de stock

## Objetivo

Establecer de forma aditiva la capacidad persistida `APP_DUAL_WRITE` y una rutina
de compensación verificable que, bajo locks en orden `StockSucursal -> Producto`,
desactive la proyección, reconcilie ambos campos globales de `Producto` desde
`StockSucursal` y deje la capacidad en `APP_DUAL_WRITE`.

Esta etapa es local y no ejecuta el fence operativo de producción.

## Contrato

- La migración crea `StockAutoridad` con una única fila `id = 1` y
  `modo = 'APP_DUAL_WRITE'`; no modifica tablas de negocio ni el trigger.
- `modo` sólo admite `APP_DUAL_WRITE` o `DB_PROJECTION`.
- La compensación exige que la fila exista y la bloquea con `FOR UPDATE` antes
  de tomar los locks de stock; así coincide con el orden futuro del puente `B1`
  (`capacidad -> StockSucursal -> Producto`) y evita una inversión.
- La compensación toma locks incompatibles en orden fijo
  `StockSucursal -> Producto`, desactiva `trg_sync_producto_stock`, recalcula
  `Producto.stockDisponibleUnits` y `stockConsignadoUnits` desde
  `SUM(StockSucursal)` y confirma sólo si la igualdad es total.
- Cualquier fallo revierte toda la transacción: trigger, capacidad y datos
  quedan exactamente como estaban.
- Una transacción legacy en vuelo impide avanzar: la compensación falla por
  `lock_timeout` y no deja cambios parciales.
- Un lector `FOR SHARE` de la capacidad bloquea un `FOR UPDATE`, y viceversa.
- No se tocan writers de stock; migrarlos a `B1` pertenece a T15.

## Estado inicial intencional

La migración deja `APP_DUAL_WRITE` junto al trigger activo en una instalación
desde cero. Esa combinación es incompatible según el ADR 002 y no debe
considerarse operativa: la compensación bajo fence es la que retira la
proyección y reconcilia. Mientras ningún writer lea la capacidad (T15), la fila
es inerte y no habilita escrituras nuevas.

## Rollout operativo (T14-R, ejecutado)

Ejecutado el 2026-11-02 con ventana de mantenimiento y fence:

1. servicio detenido y conexiones de aplicación drenadas a cero;
2. backup lógico previo (`pre-t14-20261102-180847.dump`, 4.2 MB);
3. migración aditiva `StockAutoridad` aplicada (21:09:59Z);
4. compensación bajo locks `capacidad -> StockSucursal -> Producto`;
5. verificado trigger ausente, capacidad `APP_DUAL_WRITE`, deriva 0 y T12 intacto;
6. servicio restaurado con deployment `16d898a7`, `/login` 200 y conexiones
   `consigna_runtime`.

Un `railway redeploy` intermedio (`14c1a252`) falló al reconstruir un snapshot
viejo; `main` pasa el visual guard en worktree limpio y el restore se hizo con
`railway up` desde el release T12-only. El baseline de stock queda listo para el
rollout de T15.

La compensación acepta `allowProduction`/`T14_ALLOW_PRODUCTION=true` sólo con
confirmación exacta de la base y un backup previo; sin ese opt-in sigue exigiendo
una base local terminada en `test`.

## Evidencia de cierre local

- RED observado antes de la migración: `relation "public.StockAutoridad" does not exist`.
- Migración desde cero: una fila `id=1`, `APP_DUAL_WRITE`, trigger aún activo.
- Divergencia deliberada `Producto=2/9` frente a `SUM=13/3` reconciliada a `13/3`.
- Producto sin filas de `StockSucursal` preestablecido en `7/4`, reconciliado a `0/0`.
- Transición `DB_PROJECTION` con trigger activo a `APP_DUAL_WRITE` verificada.
- Fallo inyectado antes del commit: trigger, capacidad, productos y deriva intactos.
- Transacción legacy en vuelo: fallo por `lock timeout`, sin cambios parciales;
  tras el rollback legacy, compensación exitosa y deriva cero.
- `FOR SHARE` y `FOR UPDATE` se bloquean mutuamente sobre la fila de capacidad.
- `DB_PROJECTION` sin trigger rechazado sin mutaciones.
- `prisma migrate status`, `migrate diff --exit-code` y verificación completa limpios.

## Pruebas obligatorias

- PostgreSQL 16 desde cero con todas las migraciones aplicadas.
- Migración aplicada: una sola fila, `APP_DUAL_WRITE`, trigger aún activo.
- Divergencia deliberada de `Producto` reconciliada exactamente.
- Fallo inyectado antes del commit: rollback completo.
- Transacción legacy en vuelo: compensación rechazada por lock y reintento
  exitoso después del drain.
- Semántica `FOR SHARE` / `FOR UPDATE` sobre la fila de capacidad.
- `prisma migrate status` y `migrate diff --exit-code` limpios.

## Fuera de alcance

- Aplicar el fence total, detener ingress, cron, workers o webhooks.
- Railway, producción, deploy, backfill o reescritura de historial.
- Cambiar writers, handlers o contratos HTTP (T15).
- Instalar o retirar el mecanismo de proyección definitivo (T16).

## Detenerse si

- La migración requiere editar una migración ya aplicada.
- La compensación no puede dejar el estado intacto ante un fallo.
- La reconciliación exige cambiar la aritmética o el modelo dual vigente.
