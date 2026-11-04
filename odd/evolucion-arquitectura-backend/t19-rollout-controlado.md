# T19 — Activación y relevo mixto del piloto

## Despliegue

`main` (`9e9de01..93910fe`) desplegó **`c0a56a80`** (SUCCESS, `/login` 200). El
`startCommand` ya no migra, así que la migración `20261101050000` se aplicó
explícitamente dentro del contenedor: 34 migraciones, schema al día.

Auditoría posterior al deploy y a la migración:

```json
{"mode":"DB_PROJECTION","trigger":1,"serialized":1,"migrations":34,
 "drift":0,"ventas":922,"productos":248,"consignaciones":0}
```

El `trigger:1` es la prueba de que la migración condicional **no** retiró la
proyección en una base ya cortada.

## Relevo mixto (mismos registros, ambos dispatches)

Sobre una base descartable en la configuración de producción (`DB_PROJECTION` +
trigger), tres fases con el servidor reiniciado con el switch correspondiente:

| Fase | Switch | Acciones | Resultado |
|---|---|---|---|
| A | `application` | 3 ventas (efectivo, tarjeta, efectivo) | folios 1-3, stock mate 7 / termo 6 |
| B | `legacy` | lee las 3, anula la 2, crea 2 más | folios 4-5, la 2 queda `anulada`, lectura idéntica |
| C | `application` | crea 1 más y lista | folio 6, listado 6 |

Cierre: **6 ventas, 6 pagos, 7 movimientos, 1 anulada**, sin `numeroVenta`
duplicado (`1..6` únicos y monótonos) y **deriva 0** en ambos productos. La
venta creada por `application` se anuló desde `legacy` y la numeración siguió
desde `application` sin reiniciar contadores.

Latencia observada (misma máquina, sin carga): login 229-266 ms; venta 35-79 ms
en ambos dispatches, sin diferencia apreciable.

## Activación

`SALES_REGISTER_USE_CASE=application` en el servicio de producción. Railway
redespliega al cambiar la variable: deploy **`b2a2d0b8`** SUCCESS, `/login` 200,
`SWITCH=[application] NODE_ENV=[production]` dentro del contenedor, sin errores
en los logs de arranque.

No hay instancia canary: el servicio es único, así que la activación es al 100%
del tráfico. Se asumió con la evidencia previa (caracterización con ambos
dispatches, smoke HTTP completo y relevo mixto) y con rollback de una variable.

## Rollback

```bash
railway variable set "SALES_REGISTER_USE_CASE=legacy"
```

Dispara un redeploy (~4 min). No toca esquema, numeración ni datos: los registros
creados por `application` quedan legibles, anulables y numerables por `legacy`,
que es exactamente lo que probó la fase B. Después de cualquier rollback, la
verificación es la misma auditoría de arriba con `drift = 0`.

## Ventana de observación (gate de T25)

Con tráfico real, revisar en cada venta:

1. `POST /api/ventas` responde 200 con `{data, pago}`, sin 500.
2. `numeroVenta` sigue la secuencia por sucursal, sin huecos repetidos.
3. La deriva se mantiene en 0 (`Producto = SUM(StockSucursal)`).
4. Los logs no muestran `Error POS`, `Autoridad de stock rechazada` ni
   `STOCK_AUTHORITY_INCOMPATIBLE`.
5. Notificación `NEW_ORDER` presente una sola vez por venta.

La primera venta real es la primera ejecución del dispatch nuevo con tráfico: si
falla, el rollback es inmediato y no deja estado inconsistente.
