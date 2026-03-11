# Tasks: Rediseño de Checkout Público

## Fase 1 - Base / Infraestructura

- [ ] 1.1 Actualizar `prisma/schema.prisma` para agregar el modelo `CheckoutIntent` con campos de payload snapshot (`cliente`, `items`, `envio`, `totals`), estado, referencias externas, motivo de fallo, timestamps y relación opcional a `Venta`.
- [ ] 1.2 Definir/ajustar enums en `prisma/schema.prisma` para `CheckoutIntentStatus` y proveedor de pago, alineados con el diseño (`INITIATED`, `PENDING`, `PAID`, `FAILED`, `EXPIRED`, `CANCELLED`).
- [ ] 1.3 Agregar índices y constraints de idempotencia en `prisma/schema.prisma`: unique para `externalReference`, unique nullable para `mpPaymentId`, índice por `status`, e índice por `createdAt`.
- [ ] 1.4 Generar migración Prisma en `prisma/migrations/*` que cree `CheckoutIntent` + enums + índices de idempotencia sin cambios destructivos sobre tablas existentes.
- [ ] 1.5 Verificar la migración en entorno local (`prisma migrate dev` / `prisma migrate deploy`) y documentar rollback seguro en `openspec/changes/rediseno-checkout-publico/design.md` o nota operativa asociada.
- [ ] 1.6 Definir flag de activación `PUBLIC_CHECKOUT_V2` en configuración (`.env.example`, `src/lib/env.ts` o equivalente) con valor por defecto no disruptivo.

## Fase 2 - Implementación principal

- [ ] 2.1 Refactorizar `src/app/api/public/checkout/route.ts` para que deje de crear `Venta`/`Pago` y, en su lugar, valide datos y cree un `CheckoutIntent` inicial persistido.
- [ ] 2.2 Implementar en `src/app/api/public/checkout/route.ts` el armado del snapshot inmutable del checkout (cliente, items, envío, totales) y persistirlo en `CheckoutIntent`.
- [ ] 2.3 Adaptar la creación de preferencia de MP en `src/app/api/public/checkout/route.ts` para usar `external_reference` estable derivada del intent (`intentId` o token), y devolver `checkout_token` en respuesta.
- [ ] 2.4 Crear/ajustar utilidades en `src/lib/mercadopago.ts` para consultar detalle de pago y parsear/validar `external_reference` de forma reutilizable.
- [ ] 2.5 Adaptar `src/app/api/webhooks/mercadopago/route.ts` para resolver `CheckoutIntent` por referencia externa y validar firma/evento antes de procesar.
- [ ] 2.6 Implementar idempotencia en `src/app/api/webhooks/mercadopago/route.ts` usando `mpPaymentId` único + estados terminales para evitar doble creación de venta.
- [ ] 2.7 Implementar rama `approved` en `src/app/api/webhooks/mercadopago/route.ts` con transacción atómica: validar stock, descontar stock, crear `Venta`, `VentaDetalle`, `Pago`, `Envio`, y marcar `CheckoutIntent` como `PAID` + `processedAt`.
- [ ] 2.8 Implementar ramas de rechazo/cancelación en `src/app/api/webhooks/mercadopago/route.ts` para marcar `CheckoutIntent` en `FAILED`/`CANCELLED` con `reason` trazable.
- [ ] 2.9 Crear endpoint `src/app/api/public/checkout/status/route.ts` que reciba `token`, resuelva el intent sin exponer IDs internos y responda estado público (`PENDING | PAID | FAILED`) + `ventaId`/`reason` cuando corresponda.

## Fase 3 - Integración

- [ ] 3.1 Integrar `PUBLIC_CHECKOUT_V2` en `src/app/api/public/checkout/route.ts` y `src/app/api/webhooks/mercadopago/route.ts` con fallback controlado al flujo legacy mientras dure la transición.
- [ ] 3.2 Asegurar coherencia transaccional entre checkout y webhook revisando servicios/repositorios compartidos (por ejemplo `src/lib/prisma.ts` y servicios de venta/stock existentes).
- [ ] 3.3 Definir contrato de respuesta homogéneo para `POST /api/public/checkout` y `GET /api/public/checkout/status` en handlers y validadores (`src/app/api/public/checkout/route.ts`, `src/app/api/public/checkout/status/route.ts`).
- [ ] 3.4 Agregar trazabilidad mínima en `src/app/api/public/checkout/route.ts` y `src/app/api/webhooks/mercadopago/route.ts` (logs estructurados con `intentId`, `externalReference`, `mpPaymentId`, resultado).
- [ ] 3.5 Configurar métricas mínimas del flujo V2 (intents creados, pagos aprobados, ventas creadas, fallos por stock, webhooks idempotentes) en el módulo de observabilidad existente (`src/lib/observability/*` o equivalente).

## Fase 4 - Pruebas / Verificación

- [ ] 4.1 Crear/actualizar tests unitarios para parseo/validación de `external_reference` y transiciones de estado de intent en `src/lib/mercadopago.test.ts` y/o módulos de dominio relacionados.
- [ ] 4.2 Crear tests de integración para `POST /api/public/checkout` verificando que cree `CheckoutIntent` y no cree `Venta` en ese paso (`tests/integration/public-checkout-create-intent.test.ts` o ruta equivalente).
- [ ] 4.3 Crear tests de integración para webhook `approved` en `src/app/api/webhooks/mercadopago/route.ts` verificando creación única de `Venta` + `Pago` + descuento de stock.
- [ ] 4.4 Crear tests de integración para reintento webhook con mismo `mpPaymentId` verificando deduplicación idempotente y ausencia de duplicados de venta/pago.
- [ ] 4.5 Crear tests de integración para caso de stock insuficiente post-pago: intent en `FAILED`, sin `Venta`, con `reason` persistido.
- [ ] 4.6 Crear tests de integración del endpoint `GET /api/public/checkout/status` para estados `PENDING`, `PAID`, `FAILED` y token inválido/expirado.
- [ ] 4.7 Ejecutar suite E2E de compra pública completa (inicio checkout -> webhook simulado -> polling estado final) en `tests/e2e/public-checkout-v2.spec.ts` o equivalente.
- [ ] 4.8 Verificar monitoreo mínimo en entorno de prueba: logs con correlación y métricas emitidas para cada transición crítica.

## Fase 5 - Limpieza / Documentación

- [ ] 5.1 Documentar flujo final V2 y contrato de API en `openspec/changes/rediseno-checkout-publico/design.md` (o docs técnicas del proyecto) reflejando decisión "venta solo por webhook aprobado".
- [ ] 5.2 Documentar runbook operativo para incidentes comunes (webhook duplicado, pago aprobado sin stock, intent expirado) en `docs/checkout-publico-v2-runbook.md`.
- [ ] 5.3 Identificar y remover lógica legacy de creación temprana de `Venta` en checkout público una vez validada la activación de `PUBLIC_CHECKOUT_V2`.
- [ ] 5.4 Agregar notas de despliegue y checklist de release (orden de migración, activación de flag, validaciones post-deploy) en `docs/releases/checkout-publico-v2.md`.
- [ ] 5.5 Confirmar que no queden endpoints/respuestas legacy inconsistentes y cerrar el cambio con evidencia de pruebas ejecutadas.
