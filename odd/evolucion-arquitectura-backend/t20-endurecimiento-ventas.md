# T20 — Endurecimiento del límite transaccional de ventas

## Qué cambió

La etapa compatible (T18) leía la sesión de caja abierta y resolvía el cliente
"Consumidor Final" **antes** de abrir la transacción. T20 los mueve adentro de
cada intento:

- `lockOpenCashSession(usuarioId)` bloquea la fila de `SesionCaja` con
  `FOR SHARE` y filtra por `estado = 'ABIERTA'` dentro de la transacción.
- `ensureDefaultCustomer(sucursalId)` resuelve o crea el cliente dentro de la
  transacción.

Ambas capacidades viven en el puerto `RegisterSaleTransaction`, no en la unidad
de trabajo: el adaptador Prisma es el único que sabe que hay una fila bloqueada.

## Conducta observable

| Situación | Antes | Ahora |
|---|---|---|
| El cierre de caja gana la carrera | la venta quedaba asociada a una sesión ya cerrada | `403` con el mismo mensaje, sin venta, pago ni movimiento |
| El cierre espera a la venta | — | el cierre bloquea hasta que la venta confirma y recién ahí cierra |
| Intento descartado por conflicto | podía dejar un "Consumidor Final" huérfano creado fuera de la transacción | se revierte con el resto del intento |
| Reintento | reusaba sesión y cliente del primer intento | revalida sesión y cliente en cada intento |

El adaptador `legacy` **no** cambia: sigue siendo el rollback compatible y el
switch sigue seleccionando un solo handler por request.

## Orden de locks

`SesionCaja (FOR SHARE)` → `StockAutoridad (FOR SHARE)` → `StockSucursal` →
`Producto` → inserción de venta y pago.

No hay ciclo con el cierre de caja: ese flujo toma `SesionCaja` y no toca la
capacidad de stock ni las tablas de stock, así que no puede quedar esperando un
lock que la venta ya tenga.

## Evidencia

- **PostgreSQL, concurrencia real**: el test que estaba en `test.skip` como
  "T20 pendiente" ahora corre y afirma el invariante. El cierre toma
  `SesionCaja FOR UPDATE`; el reclamo de la venta (`FOR SHARE`, misma consulta
  del adaptador) queda esperando; el cierre commitea `CERRADA`; el reclamo
  devuelve **0 filas** y no queda ninguna venta asociada. 5 verdes, 1 skipped
  (T21).
- **Unitarias del caso de uso (14)**: orden de efectos, totales, caja, cliente
  por defecto, errores de dominio, reintentos, sin fallback, y una prueba de que
  la sesión y el cliente se revalidan **en cada intento**
  (`ensureDefaultCalls = [3, 3]`).
- **Borde por ruta (13)**: los casos de error se ejecutan en ambos dispatches.
- **Caracterización HTTP completa** sobre PostgreSQL 16 con `legacy` y con
  `application`, incluida la sesión cerrada y el estado incompatible `503`.
- Regresión: stock, transiciones, numeración, OCR, consignaciones, productos,
  anulación y concurrencia, todas verdes. `tsc` y `npm run lint` limpios,
  `next build` OK.
- **Producción**: deploy `1446ecc1` SUCCESS, `/login` 200, boot correcto.
  Auditoría: `DB_PROJECTION`, trigger 1, función serializada, 34 migraciones,
  **deriva 0**, 922 ventas.

## Hallazgo para T22

La consulta de sesión filtra por `usuarioId` y `estado`, **no** por sucursal. Un
usuario con sesión abierta en la sucursal A que vende con la sucursal B activa
asocia la venta a la caja de A. Ya era así antes de T20; acotarlo cambia qué
ventas se aceptan, así que corresponde a T22 (caja y pagos) con su propia
aprobación de conducta.

## Rollback

`SALES_REGISTER_USE_CASE=legacy` (`railway variable set
"SALES_REGISTER_USE_CASE=legacy"`) revierte T18 y T20 juntos: el adaptador legacy
conserva la lectura previa a la transacción. No hay cambios de esquema ni datos.
