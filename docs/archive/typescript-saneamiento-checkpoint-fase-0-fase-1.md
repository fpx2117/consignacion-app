# Checkpoint saneamiento TypeScript - Fase 0 / arranque Fase 1

> **ARCHIVADO (2026-06-30): completado y superado.** El checkpoint reportaba archivos con `@ts-nocheck` pendientes de sanear; hoy no quedan restantes en `src/`. Se conserva solo como referencia histórica del proceso.

Fecha: 2026-03-14

## Baseline congelado

- Estado inicial verificado del repo: `npx eslint .`, `npx tsc --noEmit` y `npm run build` en verde.
- Deuda inicial relevada en `src`: 134 archivos con `@ts-nocheck`.
- Deuda inicial relevada en `src/lib`: 16 archivos con `@ts-nocheck`.

## Lote saneado en esta ejecucion

Se retiro `@ts-nocheck` de estos modulos compartidos de `src/lib/**`:

- `src/lib/apiService.ts`
- `src/lib/audit.ts`
- `src/lib/file-utils.ts`
- `src/lib/mercadopago.ts`
- `src/lib/notifyStock.ts`
- `src/lib/paymentConfig.ts`
- `src/lib/paypal.ts`
- `src/lib/pedidos-esperados.ts`
- `src/lib/requireAuth.ts`
- `src/lib/requireSubscription.ts`
- `src/lib/socket-trigger.ts`
- `src/lib/stock-alerts.ts`
- `src/lib/types.ts`
- `src/lib/reports/base/history-inventory-report.template.ts`
- `src/lib/reports/base/inventory-report-template.ts`
- `src/lib/reports/base/remito-template.ts`

## Correcciones aplicadas

- `src/lib/apiService.ts`: se agrego la importacion faltante de `Subcategoria` para que el transporte HTTP compile sin `@ts-nocheck`.
- El resto del lote quedo tipado correctamente sin cambios funcionales, conservando las firmas y contratos actuales.

## Estado al cerrar esta fase

- Deuda restante en `src/lib`: 0 archivos con `@ts-nocheck`.
- Deuda restante en `src`: 119 archivos con `@ts-nocheck`.
- Validacion final repetida en verde: `npx eslint .`, `npx tsc --noEmit`, `npm run build`.

## Punto de reanudacion sugerido

1. Continuar con `src/app/api/**`, empezando por auth, pagos, notificaciones y settings.
2. Luego avanzar sobre `src/app/(system-guard)/**` priorizando caja, clientes, consignaciones y pedidos esperados.
3. Dejar componentes visuales y paginas de reportes publicos para una fase posterior, salvo que bloqueen compilacion.

## Riesgos remanentes

- Sigue habiendo alta concentracion de `@ts-nocheck` en rutas API y pantallas protegidas; levantar esos archivos puede exponer contratos inconsistentes con Prisma y respuestas HTTP.
- Varias superficies siguen usando `any` de forma explicita; no bloquean la compilacion, pero son el siguiente foco para endurecer tipos sin romper flujo.
