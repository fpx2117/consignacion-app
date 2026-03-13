# Tareas: Integracion de pagos proveedor-agnostica (GalioPay inicial)

## Fase 1: Infraestructura y base de datos

- [ ] 1.1 Extender `CheckoutIntentProvider` con `GALIOPAY` y agregar campos provider-agnosticos en `prisma/schema.prisma` (`providerPaymentId`, `providerLinkId`, `providerStatus`, `providerRawLastEvent`, `lastSyncedAt`, `webhookProcessedAt`, `idempotencyKey`).
- [ ] 1.2 Crear migracion `prisma/migrations/*_integracion_galiopay/migration.sql` con cambios forward-compatible (enum, columnas nuevas e indices).
- [ ] 1.3 Agregar constraints/indices de idempotencia en `prisma/migrations/*_integracion_galiopay/migration.sql` para evitar duplicados por `paymentProvider + providerPaymentId` y busqueda por `externalReference`.
- [ ] 1.4 Incorporar configuracion de GalioPay y flags de rollout en `src/lib/paymentConfig.ts` (`featureFlags.galioPayEnabled`, `featureFlags.publicCheckoutProviderAgnostic`, `clientId`, `apiKey`, `webhookSecret`).
- [ ] 1.5 Actualizar `src/app/api/settings/general/route.ts` para persistir y enmascarar credenciales GalioPay sin exponer `apiKey` en respuestas ni logs.
- [ ] 1.6 Definir politica de fallback de proveedor en `src/lib/paymentConfig.ts` para mantener `MERCADOPAGO` por defecto cuando no haya override valido.

## Fase 2: Implementacion principal (modulo payments)

- [ ] 2.1 Crear `src/lib/payments/types.ts` con contrato comun (`PaymentProviderAdapter`, tipos de estado normalizado y contratos de link/status/webhook).
- [ ] 2.2 Crear `src/lib/payments/stateMapper.ts` con mapeo explicito de estados externos -> `CheckoutIntentStatus` y fallback controlado a `PENDING`.
- [ ] 2.3 Crear `src/lib/payments/provider.ts` con factory/registry para resolver adapter por proveedor y error controlado en proveedor no soportado.
- [ ] 2.4 Implementar `src/lib/payments/galiopay.adapter.ts` para `createPaymentLink`, `getPaymentStatus` y `parseWebhookEvent` usando credenciales solo del backend.
- [ ] 2.5 Crear `src/lib/payments/mercadopago.adapter.ts` encapsulando la logica actual de MercadoPago bajo el contrato comun sin cambiar comportamiento funcional.
- [ ] 2.6 Crear `src/lib/payments/checkoutProcessor.ts` con procesamiento transaccional idempotente (lock por `externalReference`, deduplicacion por `providerPaymentId`, actualizacion de `CheckoutIntent`, alta de venta/pago/stock).
- [ ] 2.7 Estandarizar logs de pagos en `src/lib/payments/checkoutProcessor.ts` y adapters con campos `provider`, `externalReference`, `providerPaymentId`, `intentId`, `eventId`, `normalizedStatus`.

## Fase 3: Integracion API, webhook y seguridad

- [ ] 3.1 Refactorizar `src/app/api/public/checkout/route.ts` para resolver proveedor efectivo (request -> configuracion sucursal -> fallback MP), crear link via adapter y persistir metadata provider-agnostica.
- [ ] 3.2 Actualizar `src/lib/apiService.ts` para aceptar `paymentProvider` opcional en `createPublicCheckout` manteniendo compatibilidad con consumidores actuales.
- [ ] 3.3 Ajustar `src/app/api/public/checkout/status/route.ts` para responder estado publico normalizado y, si aplica, sincronizar estado remoto en intents no terminales.
- [ ] 3.4 Crear `src/app/api/webhooks/galiopay/route.ts` con validacion de autenticidad (firma/token), parseo de evento y procesamiento idempotente via `checkoutProcessor`.
- [ ] 3.5 Modificar `src/app/api/webhooks/mercadopago/route.ts` para reutilizar `checkoutProcessor` en checkout publico sin romper la ruta ni contratos existentes de MP.
- [ ] 3.6 Implementar guardas por feature flag en `src/app/api/public/checkout/route.ts` y `src/app/api/webhooks/galiopay/route.ts` para activar/desactivar GalioPay sin rollback de migraciones.
- [ ] 3.7 Agregar estrategia de rollback operativo documentada en codigo/config (desactivar `galioPayEnabled`, forzar default `MERCADOPAGO`, opcionalmente responder webhook GalioPay con 200 sin procesar) en `src/lib/paymentConfig.ts` y `src/app/api/webhooks/galiopay/route.ts`.

## Fase 4: Pruebas y no regresion

- [ ] 4.1 Crear pruebas unitarias para `src/lib/payments/stateMapper.ts` cubriendo casos GalioPay/MP (`approved`, `pending`, `cancelled`, desconocido -> `PENDING`).
- [ ] 4.2 Crear pruebas unitarias para `src/lib/payments/provider.ts` verificando resolucion correcta de adapters y error en proveedor no soportado.
- [ ] 4.3 Crear pruebas unitarias para `src/lib/payments/galiopay.adapter.ts` con mocks de HTTP para headers requeridos, parseo de respuestas y manejo de errores.
- [ ] 4.4 Crear pruebas de integracion para `src/app/api/public/checkout/route.ts` validando creacion de `CheckoutIntent` con proveedor elegido, persistencia de IDs externos y respuesta estable (`init_point`, `checkout_token`, `payment_provider`).
- [ ] 4.5 Crear pruebas de integracion para `src/app/api/webhooks/galiopay/route.ts` cubriendo firma valida (actualiza estado), firma invalida (403) y evento duplicado (no duplica `Venta`/`Pago`).
- [ ] 4.6 Crear pruebas de integracion para `src/app/api/public/checkout/status/route.ts` cubriendo estados terminales/no terminales y formato publico sin datos sensibles.
- [ ] 4.7 Ejecutar pruebas de regresion de MercadoPago sobre `src/app/api/webhooks/mercadopago/route.ts`, `src/app/api/public/checkout/route.ts` y `src/app/api/public/checkout/status/route.ts` para confirmar ausencia de ruptura funcional.
- [ ] 4.8 Definir y validar prueba E2E de checkout GalioPay sandbox (crear link, simular webhook de aprobacion, verificar `PAID` y venta unica) en la suite E2E existente del proyecto.

## Fase 5: Observabilidad, documentacion y release

- [ ] 5.1 Instrumentar metricas por proveedor en `src/lib/payments/checkoutProcessor.ts` y rutas webhook (`payment_link_created_total`, `webhook_received_total`, `webhook_invalid_signature_total`, `checkout_paid_total`, `checkout_failed_total`, `idempotent_skip_total`).
- [ ] 5.2 Configurar alertas operativas y umbrales de monitoreo para invalid signature, intents en timeout y divergencia pagos-vs-ventas en la configuracion de observabilidad usada por el proyecto.
- [ ] 5.3 Documentar variables de entorno y politicas de secretos de GalioPay en `README.md` y/o documentacion operativa del repositorio (clientId/apiKey/webhookSecret, enmascarado y almacenamiento seguro).
- [ ] 5.4 Documentar runbook de despliegue gradual y rollback por flags en `openspec/changes/integracion-galiopay/design.md` o documento operativo equivalente (sucursal piloto, cohortes, fallback MP).
- [ ] 5.5 Registrar checklist de validacion pre-release y post-release (migracion aplicada, flags por entorno, webhook configurado, smoke tests de checkout y no regresion MP) en documentacion de release del proyecto.
