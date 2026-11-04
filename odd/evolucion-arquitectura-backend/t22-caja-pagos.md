# T22 — Límites transaccionales de caja y pagos

## Caja: apertura

`POST /api/settings/pos/cajas/turno` comprobaba si había una sesión abierta y
después insertaba. Dos requests concurrentes pasaban el chequeo y quedaban **dos
sesiones abiertas** para el mismo usuario. Ahora el chequeo y el alta corren en
una transacción con `SELECT ... FOR UPDATE` sobre la fila del usuario: las
aperturas del mismo usuario se serializan y el perdedor recibe el mismo `403`.

No se agregó un índice único parcial porque Prisma no los representa y el
`migrate diff --exit-code` de la verificación de T14 lo reportaría como deriva. El
lock sobre el usuario da la misma garantía para el único camino que abre sesiones.

## Caja: cierre

Los dos endpoints de cierre (`POST .../cajas/cerrar` y `PUT .../cajas/turno`)
leían la sesión con sus ventas y movimientos, calculaban el esperado y recién
después actualizaban, **fuera de toda transacción**. Dos defectos:

1. Una venta que confirmaba entre la lectura y el cierre quedaba fuera de
   `montoFinalEsperado`.
2. Dos cierres concurrentes leían `ABIERTA` y ambos escribían: el segundo pisaba
   el total con otro cálculo.

Ahora cada cierre hace lock, lectura, cálculo y reclamo en **una sola
transacción**:

```sql
SELECT s."id" FROM "SesionCaja" s
JOIN "Caja" c ON c."id" = s."cajaId"
WHERE s."id" = $1 AND c."sucursalId" = $2
LIMIT 1 FOR UPDATE OF s
```

seguido de `UPDATE "SesionCaja" ... WHERE "id" = $1 AND "estado" = 'ABIERTA'`.
Si el `count` no es 1, la respuesta es la misma de antes (`400` en `cerrar`,
`404` en `turno`). Una venta en vuelo toma `FOR SHARE` sobre la sesión: el cierre
espera, la ve confirmada y la incluye.

## Ventas: la sesión pertenece a la sucursal

Hallazgo que T20 dejó anotado y que se cierra acá: la búsqueda de sesión filtraba
por `usuarioId` y `estado`, no por sucursal. Un usuario con caja abierta en la
sucursal A que vendía con la sucursal B activa, colgaba la venta de la caja de A.
La consulta ahora hace join con `Caja` y exige la sucursal de la venta: sin caja
abierta en su propia sucursal, la venta se rechaza con el mismo `403`.

## Pagos: qué queda definido y qué no

- **Concurrencia:** el pago manual ya descuenta `saldoCuenta` con
  `{ decrement }` dentro de una transacción, así que dos pagos concurrentes no
  pierden actualizaciones. Ese límite está bien.
- **Idempotencia:** no existe. Un reintento del cliente crea dos `Pago` y
  descuenta dos veces. Resolverlo requiere una clave de idempotencia que envíe el
  cliente y una columna única: es un cambio de esquema más contrato de UI, no un
  ajuste de límite. Queda **explícito** como el próximo paso de este eje, no como
  un olvido.

## Otro hallazgo, sin tocar

Los dos cierres calculan el esperado con criterios distintos: `cerrar` suma
**todas** las ventas `CASUAL`, mientras `turno` suma sólo ventas y cobranzas en
**efectivo** más movimientos. Uno de los dos números está mal para el negocio, o
responden a preguntas distintas. No lo unifiqué: es una decisión comercial, no
técnica.

## Evidencia

- **PostgreSQL, concurrencia**: el cierre espera a la venta en vuelo (que sostiene
  `FOR SHARE`), la incluye en el total (`50.00`) y el segundo cierre afecta **0
  filas**. La consulta del test es la misma del adaptador, con el join y
  `FOR SHARE OF s`.
- **Ruta real**: `handlePutTurno` con datos sembrados cierra en `175`
  (100 inicial + 50 ventas + 20 cobranzas + 5 ingresos), diferencia `5`, y el
  segundo intento devuelve `404` sin tocar el total persistido.
- **14 suites de integración verdes** desde una base recién migrada, incluida la
  batería completa de stock, ventas, liquidaciones, OCR y numeración.
- `tsc`, `npm run lint` y `next build` limpios.
- **Producción**: deploys `fae1ce8` y `20e9e7e3` SUCCESS, `/login` 200.
  Auditoría: `DB_PROJECTION`, trigger 1, 34 migraciones, **deriva 0**,
  **0 sesiones de caja** (el módulo no se usa hoy), 922 ventas y 922 pagos.

## Rollback

Sólo código: no hay esquema ni datos nuevos. Revertir el deploy restaura el
comportamiento anterior de apertura y cierre.
