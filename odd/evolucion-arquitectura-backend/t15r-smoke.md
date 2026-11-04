# T15-R — Smoke autenticado de los writers `B1`

## Qué se ejecutó

El recorrido completo por HTTP contra un servidor real (`tsx server.ts`, build de
producción) y una base descartable configurada **igual que producción**: las 33
migraciones, `StockAutoridad.modo = DB_PROJECTION`, `trg_sync_producto_stock`
instalado y la función de proyección serializada.

Login real con usuario `ADMIN`, caja abierta, plan con consignaciones y OCR
habilitados. Cada paso se verificó contra la respuesta HTTP **y** contra el stock
leído por la API.

| Flujo | Evidencia |
|---|---|
| Login + sesión | `200`, cookies de sesión y sucursal activa; `auth/me` con rol `ADMIN` |
| POS efectivo | venta `1`, `numeroVenta: 1`, total `20.02`, stock `10 → 8` |
| POS tarjeta | venta `2`, `numeroVenta: 2`, total `10.74` (5.55×2 −10% +7.5%), stock `8 → 6` |
| Anulación | `DELETE /api/ventas/1` → `200`, `anulada: true`, stock `8 → 10` |
| Consignación | folio `1`, 2 unidades, disponible `10 → 8` |
| Liquidación | todo devuelto, disponible `8 → 10`, consignado `0` |
| Pedido esperado | creado y confirmado con 5 unidades, stock `10 → 15` |
| OCR (confirmar ítem) | ítem `CONFIRMADO`, stock `15 → 18` |

Movimientos persistidos, en orden:

| # | Producto | Tipo | Motivo | Cant. | Previo | Posterior |
|---|---|---|---|---|---|---|
| 1 | Mate | SALIDA | VENTA | 2 | 10 | 8 |
| 2 | Termo | SALIDA | VENTA | 2 | 8 | 6 |
| 3 | Mate | ENTRADA | DEVOLUCION_CLIENTE | 2 | 8 | 10 |
| 4 | Mate | SALIDA | CONSIGNACION | 2 | 10 | 8 |
| 5 | Mate | ENTRADA | DEVOLUCION_CLIENTE | 2 | 8 | 10 |
| 6 | Mate | ENTRADA | COMPRA | 5 | 10 | 15 |
| 7 | Mate | ENTRADA | COMPRA | 3 | 15 | 18 |

Cierre: `modo = DB_PROJECTION`, `triggers = 1`, **deriva 0** en los dos productos
(`Producto.stockDisponibleUnits = SUM(StockSucursal.stockDisponibleUnits)` y lo
mismo para consignado).

El servidor emitió el diagnóstico esperado del switch:
`SALES_REGISTER_USE_CASE is not set; using the legacy register-sale adapter.`

## Qué no se ejecutó, y por qué

- **Checkout de Mercado Pago de punta a punta.** La venta la crea el webhook al
  confirmarse el pago; el webhook valida la firma y luego consulta el pago real
  contra la API de Mercado Pago. No se puede cerrar sin cobrar de verdad. El
  writer de stock del webhook (`incrementBranchStock`/`decrementBranchStock`) y la
  creación de la intención están cubiertos por las suites de T15-H y siguen
  verdes. Es una limitación permanente, no una deuda de esta tarea.
- **Escrituras en producción.** A propósito: el smoke crea ventas, pagos,
  movimientos, una consignación, una liquidación, un pedido y una confirmación de
  factura. En el comercio en vivo eso consume folios, mueve stock real y dispara
  notificaciones. El riesgo ambiental de producción ya estaba cerrado (rol
  runtime + proyección, con sonda revertida). El script queda listo para
  ejecutarse contra producción con `SMOKE_ALLOW_REMOTE=true` si se decide asumir
  ese residuo.

El smoke corrió sobre `ca22f0a` con el switch en `legacy`. Producción sigue en
`df264904`: el adaptador legacy de T18 conserva el contrato, y la caracterización
HTTP completa lo demuestra ejecutada con ambos dispatches.

## Reproducción

```bash
# 1. Base descartable con la configuración de producción
docker run --rm -d --name t15r-postgres -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=t15r_smoke -p 55434:5432 postgres:16
DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:55434/t15r_smoke npx prisma migrate deploy
psql "$DATABASE_URL" -c "UPDATE \"StockAutoridad\" SET modo='DB_PROJECTION' WHERE id=1"

# 2. Fixture y servidor
DATABASE_URL=... T15R_CONFIRM_DATABASE=t15r_smoke SMOKE_PASSWORD='...' \
  node scripts/smoke/seed-t15r-fixture.mjs
DATABASE_URL=... RUNTIME_DATABASE_URL=... JWT_SECRET=... NODE_ENV=production PORT=3100 \
  npx tsx server.ts

# 3. Smoke
SMOKE_BASE_URL=http://localhost:3100 SMOKE_EMAIL=smoke-t15r@example.test \
  SMOKE_PASSWORD='...' SMOKE_DATABASE_URL=... node scripts/smoke/t15r-http.mjs
```

Los scripts viven en `scripts/smoke/`. El fixture exige una base `*_smoke`
confirmada por `T15R_CONFIRM_DATABASE`; el smoke exige `SMOKE_ALLOW_REMOTE=true`
para apuntar fuera de `localhost`.

## Hallazgos (no corregidos, fuera de T15-R)

1. **Una instalación nueva queda en un estado prohibido.** Con las 33 migraciones
   aplicadas y sin pasos manuales, la base queda en `APP_DUAL_WRITE` **con** el
   trigger de proyección instalado (lo crea
   `20260322000000_trigger_sync_producto_stock` y T14 no lo retira). Esa
   combinación es la que `lockStockAuthority` rechaza con
   `STOCK_AUTHORITY_INCOMPATIBLE`: **todo writer `B1` devuelve `503`**. Producción
   no lo sufre porque T14-R dejó el trigger desactivado y T16 lo reinstaló junto
   con `DB_PROJECTION`. Reproducido en una base vacía durante esta tarea.
2. **`GET /api/auth/me` devuelve el `hash` bcrypt del usuario.** El handler tipa la
   respuesta sin `hash`, pero el objeto serializado lo incluye. Es el hash propio,
   no el de terceros; igual conviene recortarlo.
