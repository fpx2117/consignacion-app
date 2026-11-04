# Deuda técnica: las cuatro deudas conocidas, resueltas

## 1. El descuento global se restaba dos veces

`Venta.total` ya viene neto de `descuentoGlobal` (y del recargo de tarjeta). Cuatro
puntos de agregación lo restaban otra vez, así que una venta con descuento global
mostraba menos de lo que cobró:

| Archivo | Punto |
|---|---|
| `lib/dashboard/kpi-logic.ts` | serie de tendencia del dashboard |
| `app/ver/dashboard/[period]/pdf/route.ts` | tendencia del PDF de dashboard |
| `app/ver/pos/[period]/pdf/route.ts` | `netoVenta` de la tendencia POS |
| `app/ver/pos/[period]/pdf/route.ts` | total por método de pago |

Se quitó la segunda resta. El descuento **sigue** reportándose y **sigue**
alimentando `calculateGrossProfit`, que lo necesita porque los subtotales de línea
son brutos.

Prueba: `kpi-logic.integration.test.ts` siembra una venta con `total = 90` y
`descuentoGlobal = 10` y exige que la tendencia sume **90**, no 80.

## 2. Dos cierres de caja con números distintos

`POST /api/settings/pos/cajas/cerrar` era un duplicado del cierre de turno con
otra fórmula (todas las ventas `CASUAL` en lugar de efectivo + cobranzas +
movimientos). **Ningún cliente lo llamaba**: `apiService.cerrarCaja` usa
`PUT /api/settings/pos/cajas/turno` y no había otra referencia.

Se eliminó el endpoint. Unificar la fórmula habría sido elegir un número a ojo;
eliminar el camino muerto deja uno solo y verificable.

## 3. Idempotencia de pagos manuales

Un reintento del cobro creaba un segundo `Pago` y descontaba `saldoCuenta` dos
veces.

- `Pago.idempotencyKey String? @unique` (migración
  `20261101060000_pago_idempotency_key`). Los pagos de venta, liquidación y
  webhooks escriben `NULL` y en PostgreSQL varios `NULL` no colisionan.
- `POST /api/pagos/[clienteId]` lee el header `Idempotency-Key`. El reintento
  choca con el índice único, **la transacción entera se revierte** (el `decrement`
  no se aplica dos veces) y el handler devuelve el pago existente con el saldo
  actual, en `200`.
- `apiService.createPago` acepta la clave y la envía como header.
- Se eliminó `POST /api/clientes/[id]/pagos`: era un segundo escritor de cobros,
  sin referencia en la UI y **sin exigir turno de caja abierto**.

Prueba: `pagos/[clienteId]/route.integration.test.ts` cobra 30, reintenta con la
misma clave (mismo `pago.id`, saldo 70, un solo `Pago`) y con otra clave (nuevo
cobro, saldo 40).

## 4. El escaneo de secretos

Estaba en rojo por tres motivos, ninguno un secreto real:

- `migration-repair.md` y `t12-numbering-bridge.md` mostraban URLs elididas
  (`postgresql://.../db`) sin marcador de placeholder. Ahora muestran URLs de
  `127.0.0.1`, que es lo que esos comandos requieren.
- `scripts/smoke/*.mjs` tenían la misma forma en sus ejemplos de uso. Corregido.
- El `.env` local apuntaba al **proxy TCP de producción con credenciales**. Ahora
  apunta a una base local; la URL de producción se obtiene de Railway cuando hace
  falta (`railway variables`), no queda en disco. El archivo está ignorado por
  git, así que nunca se versionó.

`npm run security:scan-secrets-local` y `npm run security:test` (25 tests) pasan.

## Evidencia

- 16 suites de integración verdes desde una base recién migrada; `tsc`, `lint`,
  `security:test` y `next build` limpios.
- Producción: deploy `267ff1eb` SUCCESS, `/login` 200, migración
  `20261101060000` aplicada (35 migraciones), `DB_PROJECTION`, trigger 1,
  **deriva 0**, columna e índice de idempotencia presentes, 922 ventas y 922 pagos
  intactos.

## Contrato que cambió

`Pago` ahora serializa `idempotencyKey` (nullable). Es aditivo y el test de
contrato de ventas lo fija en `null` para los pagos de venta.
