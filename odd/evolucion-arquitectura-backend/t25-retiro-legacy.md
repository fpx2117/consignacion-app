# T25 — Retiro del handler legacy

## Estado: ejecutado

Retirado el 2026-11-04 con autorización explícita del usuario, **sin la ventana de
observación** que el ADR 006 pedía. La decisión fue suya y quedó registrada: se
priorizó dejar el camino único funcionando antes de la apertura del comercio.

Datos al momento del retiro (05:45 UTC):

| Dato | Valor |
|---|---|
| Ventas totales | 922 |
| Última venta | `2026-11-03T21:17:57Z` (18:17 local), **anterior a la activación** |
| Ventas desde la activación | **0** |
| Deriva de stock | 0 |

El dispatch nuevo nunca procesó una venta real antes del retiro. Lo que sí estaba
probado: la caracterización HTTP completa con ambos dispatches, el relevo mixto
sobre los mismos registros y el smoke autenticado completo ejecutado contra el
build de un solo camino, con deriva 0.

## Qué se retiró

| Archivo | Cambio |
|---|---|
| `src/app/api/ventas/register-sale-handlers.ts` | −`registerSaleLegacy`, −`MAX_VENTA_RETRIES`, −`isRetriableVentaError`, −`buildSaleNotification` y sus imports (525 líneas menos en el commit) |
| `src/modules/ventas/register-sale-switch.ts` | eliminado |
| `src/modules/ventas/register-sale-switch.test.ts` | eliminado |
| `src/app/api/ventas/route.ts` | llama al caso de uso directamente; ya no lee el entorno |
| tests de ruta | dejaron de parametrizar por dispatcher |
| servicio de Railway | variable `SALES_REGISTER_USE_CASE` eliminada |

`POST /api/ventas` tiene un solo camino. El log por venta quedó como observabilidad
(`[ventas] sale {"ventaId":…,"numeroVenta":…,"total":…,"ms":…}`).

## Verificación

- `tsc`, `lint`, `security:test` (25) y `next build` limpios.
- **17 suites de integración verdes** desde una base nueva, sin la variable de
  switch en el entorno.
- **Smoke HTTP completo** contra el build de un solo camino y base en configuración
  de producción: login, POS efectivo y tarjeta, anulación, consignación,
  liquidación, pedido, OCR y **deriva 0**.
- **Producción**: deploy `37c6bb4a` SUCCESS, `/login` 200, arranque sin
  diagnóstico del switch, 36 migraciones, `DB_PROJECTION`, trigger 1, deriva 0.

## Rollback

Revertir el commit `9af282c` restaura el adaptador legacy y el switch. Cuesta un
redeploy, igual que costaba cambiar la variable cuando el switch existía; lo que
no se recupera es la garantía de que el artefacto restaurado sea el que procesó 922
ventas, porque se reconstruye.

## Lo que queda como deuda de proceso

La ventana de observación no ocurrió. La primera venta real después de este retiro
es la primera ejecución del camino único en producción; conviene mirar el log
`[ventas] sale` y la deriva después de esas ventas.

