# ADR 006 — Migración incremental y rollback

## Contexto

El sistema debe reorganizarse sin detener el negocio ni mezclar versiones
incompatibles de aplicación y esquema.

## Opciones

- Reemplazo completo.
- Refactor directo sin switch.
- Strangler con caracterización, switch y rollback probado.

## Decisión

Cada extracción conservará el adaptador legacy detrás de un switch mutuamente
excluyente. No habrá doble ejecución de comandos. Antes de retirar legacy se
escribirán datos con la ruta nueva, se volverá a legacy y se demostrará que puede
operar sobre esos mismos registros.

Para el piloto de ventas el switch se llamará
`SALES_REGISTER_USE_CASE=legacy|application`. El valor ausente, vacío o inválido
seleccionará `legacy` y emitirá diagnóstico; nunca activará la ruta nueva por
accidente.

`POST /api/ventas` tendrá un solo punto de dispatch, anterior a cualquier efecto
persistente. Cada request ejecutará exactamente un handler. Una vez iniciado un
handler no habrá fallback automático al otro: reintentarlo después de un commit
incierto podría duplicar venta, pago, stock o notificaciones.

En este ADR, `legacy` significa el **adaptador de compatibilidad incluido en la
versión puente `B1` del ADR 002**, no el binario original `L0`. Ambos handlers del
piloto deben obedecer la capacidad de stock: con `APP_DUAL_WRITE` escriben ambas
representaciones y con `DB_PROJECTION` escriben sólo `StockSucursal`. El checkout
de Mercado Pago y cualquier otro writer de stock deben estar también en `B1`
antes de habilitar el canary. El switch nunca habilita volver a un writer
incondicional.

## Activación del piloto

1. Desplegar en todos los writers el artefacto puente `B1`, que contiene ambos
   handlers y la selección transaccional del modo de stock, con el switch en
   `legacy`. Confirmar que no quedan instancias `L0`, incluido checkout.
2. Exigir caracterización verde de status, body JSON completo, campos nullable,
   serialización Decimal, orden de detalles y efectos persistidos.
3. Exigir que la autoridad PostgreSQL de numeración del ADR 007 esté activa y que
   la combinación de capacidad/trigger de stock esté permitida por el ADR 002.
4. Activar `application` en una instancia canary. Las demás pueden permanecer en
   `legacy` porque ambas rutas `B1` obedecen la misma capacidad, escriben el mismo
   esquema y consumen la misma autoridad de numeración; no se admite ningún
   formato durable exclusivo de la ruta nueva.
5. Comparar requests equivalentes contra snapshots de caracterización y observar
   errores, conflictos, latencia y efectos post-commit. No se ejecutan ambas rutas
   para una misma venta.
6. Ampliar gradualmente hasta que todas las instancias usen `application`.

## Rollback del piloto

Cambiar el switch a `legacy` y redesplegar. La autoridad de numeración permanece
activa porque es compatible con ambos handlers. Este rollback cambia el dispatch,
no reinstala el binario `L0`. Si se requiere volver a una versión de aplicación
anterior a `B1`, deben satisfacerse simultáneamente la compatibilidad de stock del
ADR 002 y la de numeración del ADR 007. Mientras los triggers de numeración estén
activos, ninguna instancia puede ejecutar consignaciones usando el `nuevoFolio`
local después del insert. El rollback de stock por sí solo NO autoriza ese
binario: el único target soportado es el artefacto puente compatible. La prueba de
rollback debe:

1. crear ventas mediante `application`;
2. volver a `legacy` con instancias mixtas durante el reemplazo;
3. consultar, anular y continuar numerando sobre esos registros;
4. verificar la respuesta HTTP exacta y ausencia de venta, pago, movimiento o
   notificación duplicados.
5. ejecutar ventas y checkout bajo `APP_DUAL_WRITE` y `DB_PROJECTION`, comprobando
   que ambos dispatches respeten el modo y que ninguna ruta haga dual-write
   incondicional.
6. rechazar explícitamente una instancia pre-`B1` de consignaciones mientras los
   triggers de numeración estén activos.

El handler nuevo sólo podrá retirar al legacy después de completar esa prueba y
una ventana de observación aprobada.

## Motivo

Un cambio de aplicación puede producir estado durable incompatible incluso sin
una migración de esquema.

## Consecuencias

- Todo cambio durable requiere runbook y prueba de rollback.
- Las migraciones serán aditivas; no se editarán migraciones aplicadas.
- El código legacy se elimina sólo después de observar estabilidad y demostrar
  compatibilidad de retorno.
- El switch no sustituye contratos ni idempotencia: únicamente selecciona una de
  dos implementaciones equivalentes.
