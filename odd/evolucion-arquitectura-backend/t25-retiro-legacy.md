# T25 — Retiro del handler legacy: inventario y gate

## Estado: NO se retiró

El gate de T25 no está cumplido. Datos de producción al 2026-11-04 05:45 UTC:

| Dato | Valor |
|---|---|
| Ventas totales | 922 |
| Última venta | `2026-11-03T21:17:57Z` (18:17 hora local) |
| Ventas desde la activación (`2026-11-04T02:43Z`) | **0** |
| Deriva de stock | 0 |

La activación ocurrió a las 23:43 hora local, después del cierre del comercio. El
dispatch nuevo **nunca procesó una venta real**. Retirar el fallback ahora deja el
código sin ningún ejercicio con tráfico, que es exactamente lo que la ventana de
observación del ADR 006 existe para evitar.

## Lo que sí se hizo

Se agregó una línea de evidencia por venta en `POST /api/ventas`:

```json
[ventas] sale {"mode":"application","ventaId":926,"numeroVenta":659,"total":"20000","ms":78}
```

Sirve para que la ventana sea **medible**: cuántas ventas atendió el dispatch
nuevo, con qué folio, total y latencia. No cambia la respuesta ni el cálculo.

## Inventario (lo que se retiraría)

| Archivo | Qué se va |
|---|---|
| `src/app/api/ventas/register-sale-handlers.ts` | `registerSaleLegacy` (~250 líneas) y sus helpers exclusivos `MAX_VENTA_RETRIES`, `isRetriableVentaError`, `buildSaleNotification`, y el import de `calcularDescuentoEfectivo`, `calculateLineTotal`, `calculateSaleTotals`, `applyProductoGlobalDelta` |
| `src/modules/ventas/register-sale-switch.ts` | módulo completo (46 líneas) |
| `src/modules/ventas/register-sale-switch.test.ts` | pruebas del switch |
| `src/app/api/ventas/route.ts` | `readRegisterSaleUseCase`, el ternario y los imports del legacy |
| `src/app/api/ventas/route.test.ts` y `route.transaction-errors.test.ts` | los casos parametrizados por `SALES_REGISTER_USE_CASE` |
| Servicio de Railway | la variable `SALES_REGISTER_USE_CASE` |

Consumidores del legacy en producción: **sólo** `src/app/api/ventas/route.ts`. No
hay otro importador ni otra ruta. `.env.example` no declara la variable (vive sólo
en el servicio).

## Sobre el costo del rollback

Conviene decirlo con precisión: hoy el rollback es
`railway variable set "SALES_REGISTER_USE_CASE=legacy"`, que **dispara un
redeploy** (~4 min). Después del retiro, el rollback sería revertir el commit, que
también **dispara un redeploy** (~4 min). El costo operativo es el mismo; lo que se
pierde es la garantía de que el artefacto que se restaura es el que procesó 922
ventas, en lugar de uno que se reconstruye.

## Plan de retiro (cuando el gate se cumpla)

1. Confirmar en los logs al menos **N ventas reales** con
   `mode=application`, folios consecutivos, totales coherentes y `ms` razonable.
2. Confirmar deriva 0 y que las anulaciones sobre esas ventas funcionan.
3. Ejecutar el retiro en un commit único.
4. Desplegar.
5. Verificar que `SALES_REGISTER_USE_CASE` ya no exista en el servicio y que el
   arranque no emita diagnóstico del switch.
6. Rollback: revertir el commit (mismo tiempo de redeploy).

## Recomendación

Esperar la primera ventana de operación real (el comercio abre por la mañana) y
retirar con evidencia. El código ya está listo para recortarse en un commit
pequeño y reversible.
