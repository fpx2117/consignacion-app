# T18 — Piloto `RegistrarVenta` detrás del switch

## Estado

Implementado y verificado en descartable. **No desplegado**: el artefacto es el
mismo binario puente `B1` con los dos handlers y el switch en `legacy`
(ausente). La activación es T19.

## El switch

`SALES_REGISTER_USE_CASE=legacy|application`, resuelto en un único punto de
`POST /api/ventas` **antes** de cualquier efecto durable:

- sólo el valor exacto `application` habilita la ruta nueva;
- ausente, vacío o inválido resuelven a `legacy` y emiten **un** diagnóstico por
  proceso (para que el valor por defecto no inunde los logs);
- la request ejecuta exactamente un handler; no hay ejecución doble ni fallback
  después de iniciar efectos.

Ambos handlers son `B1`: bloquean la capacidad de stock con `FOR SHARE`, respetan
`APP_DUAL_WRITE|DB_PROJECTION` y crean la venta con la autoridad PostgreSQL de
numeración. Ninguno hace dual-write incondicional.

## Capas

```text
src/modules/ventas/
├── application/register-sale.ts        # caso de uso + puertos + errores
├── infrastructure/prisma-register-sale.ts  # unidad de trabajo Prisma
└── register-sale-switch.ts             # resolución del switch
src/app/api/ventas/
├── ventas-route-deps.ts                # puertos HTTP compartidos
├── register-sale-handlers.ts           # legacy + application + post-commit
└── route.ts                            # auth, validación, dispatch, errores
```

La aplicación no importa Prisma, Next.js ni Socket.IO. `RegisterSaleUnitOfWork`
abre la transacción `Serializable` y expone capacidades concretas
(cliente, autoridad de stock, movimiento, venta, pago); el caso de uso conserva
los reintentos (`P2002`/`P2034`, máximo 3) y decide los totales con las funciones
puras de T17.

La ruta quedó reducida a autenticar, validar, construir el comando, despachar,
ejecutar los efectos post-commit y traducir errores.

## Contrato preservado

- `Serializable` + reintentos, orden de locks (`capacidad -> StockSucursal ->
  Producto`), `FOR UPDATE` de la proyección y delta global según la autoridad.
- Decremento condicional con stock suficiente y `MovimientoStock` con
  `stockPrevio`/`stockPosterior` derivados del estado persistido.
- Cliente por defecto ("Consumidor Final") resuelto antes de la transacción y
  validación de alcance de sucursal dentro de ella.
- Verificación de caja con el mismo `403` y el mismo mensaje.
- Totales, descuento de catálogo, descuento manual, recargo de tarjeta y
  `Decimal` persistido sin redondeo nuevo.
- Dos lecturas del reloj (venta y pago) con la timezone resuelta.
- Respuesta `{ data, pago }` completa, con relaciones, nullable y orden de
  detalles.
- Efectos post-commit en el mismo orden: alertas de stock, notificación
  `NEW_ORDER` (sólo si `notificarVentas !== false`) y emisión por socket sin
  bloquear la respuesta.

## Diferencias conocidas (no observables en HTTP)

- El adaptador legacy conserva el `pg_advisory_xact_lock(1000000 + sucursalId)` y
  la lectura inerte de `MAX(numeroVenta)` previos a T12. El caso de uso omite la
  lectura, pero el adaptador Prisma **sí** toma ese advisory lock antes de crear
  la venta, para no cambiar el orden de adquisición frente al webhook de Mercado
  Pago.
- Si la relectura posterior al decremento no encuentra la fila, legacy responde
  `500` con un mensaje propio y la ruta nueva con el error de Prisma. La
  respuesta HTTP es idéntica (`500` sanitizado); sólo cambia el log.
- El caso de uso relee el `Producto` para la alerta (la transición compartida no
  lo devuelve). Una lectura extra por ítem, dentro de la misma transacción.

## Evidencia

- `tsc --noEmit` limpio; `npm run lint` en 0 problemas.
- `register-sale.test.ts` (13): orden de efectos, totales y detalles, descuento
  manual sobre catálogo, caja requerida, control de caja desactivado, cliente por
  defecto, cliente de otra sucursal, producto sin asignación, stock insuficiente,
  reintentos (éxito al tercero y agotamiento), error no reintentable sin fallback,
  notificación desactivada y acumulación de alertas.
- `register-sale-switch.test.ts` (7): valor exacto, ausente, vacío, inválido,
  `legacy` explícito y diagnóstico único por proceso.
- `route.test.ts` (9) y `route.transaction-errors.test.ts` (13) corren los casos
  de borde en **ambos** dispatches.
- `route.integration.test.ts` (contrato HTTP completo sobre PostgreSQL 16,
  incluida `APP_DUAL_WRITE`, `DB_PROJECTION`, estado incompatible `503` y
  autoridad de numeración ausente) pasa ejecutado con `legacy` y con
  `application`. Es la prueba de equivalencia: mismas aserciones, mismo
  resultado, handlers distintos.
- Regresión verde: `sale-totals`, `domain-formulas`, `producto-stock-writers`,
  `stock-authority.integration`, `venta-numbering-authority.integration`,
  `concurrency-invariants.integration`, anulación `ventas/[id]`,
  `aplicar-confirmacion.integration`.

## Lo que falta

- **T19**: activar `application` en una instancia canary, comparar contra los
  snapshots de caracterización, observar errores/conflictos/latencia/efectos y
  ensayar el rollback mixto (ventas creadas por `application`, consultadas,
  anuladas y renumeradas por `legacy`).
- La ventana de observación de `B1` en producción sigue abierta antes de
  cualquier `C2`.

## Deuda de guardrails corregida en esta tarea

- `venta-numbering-wiring.test.ts` inventariaba `src/app/api/ventas/route.ts`
  como writer; ahora el inventario son los dos adaptadores reales.
- `producto-stock-writers.test.ts` no incluía los scripts de cutover/verificación
  de T16 en su allowlist de SQL crudo, así que fallaba desde T16. Se declararon
  explícitamente.
