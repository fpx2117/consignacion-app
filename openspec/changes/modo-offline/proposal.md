# Propuesta de Feature: Modo Offline

## Contexto

El sistema actual funciona en modo online-first y depende de conectividad para autenticacion, operaciones de negocio y sincronizacion en tiempo real.

Esta propuesta registra una iniciativa para habilitar uso offline controlado, empezando por el flujo de mostrador (POS), con sincronizacion posterior al recuperar conectividad.

## Objetivo

Permitir que usuarios operen procesos criticos del POS sin internet, con consistencia eventual y trazabilidad completa al sincronizar.

## Alcance Propuesto

### MVP (prioridad alta)

- Consulta local de productos y clientes cacheados.
- Creacion de ventas offline como operaciones pendientes.
- Registro de pagos offline para metodos permitidos.
- Cola de mutaciones (outbox) con reintentos automaticos.
- Sincronizacion al reconectar con idempotencia.
- Indicador visual de estado de conectividad y sincronizacion.

### Fuera de MVP (online-only inicialmente)

- Checkout publico e integraciones externas (webhooks y pasarelas).
- Suscripciones y pagos online.
- Integraciones logisticas.
- Generacion de reportes PDF y enlaces publicos.

## Estrategia Tecnica Recomendada

1. PWA + Service Worker para app shell y cache de lecturas.
2. IndexedDB como almacenamiento local transaccional.
3. Capa `offline` en cliente para repositorios locales y outbox.
4. `clientMutationId`/idempotency key en mutaciones criticas.
5. Sync engine con retries, backoff y checkpoints.
6. Politicas de conflicto por dominio:
   - Catalogo/configuracion: last-write-wins con `updatedAt`.
   - Stock/caja/ventas: conciliacion explicita, no LWW simple.

## Riesgos y Mitigaciones

- Sobreventa por concurrencia offline en varios dispositivos.
  - Mitigar con idempotencia, validacion server-side y resolucion de conflictos.
- Desbalance de caja por cierres con pendientes sin sincronizar.
  - Mitigar con bloqueo de cierre final y estado de cierre provisional.
- UX confusa si no se distingue pendiente vs confirmado.
  - Mitigar con estados visibles, historial de sync y mensajes accionables.

## Roadmap de Implementacion

### Fase 0 - Descubrimiento y contratos (1-2 semanas)

- Matriz por endpoint: offline-ready, cache-only, online-only.
- Contrato tecnico de idempotencia y versionado de mutaciones.
- Politicas operativas validadas con negocio.

### Fase 1 - Fundacion offline (2-3 semanas)

- App shell offline (manifest + SW).
- Base de datos local y repositorios de lectura.
- Estado global de conectividad/sync en UI.

### Fase 2 - MVP operativo POS (3-5 semanas)

- Outbox para ventas/pagos.
- Flujos de venta y pago en modo offline.
- Sincronizacion automatica con reintentos e idempotencia.

### Fase 3 - Conflictos, caja y observabilidad (2-4 semanas)

- Centro de sincronizacion para pendientes y errores.
- Reglas de conciliacion para stock y caja.
- Metricas y alertas operativas.

### Fase 4 - Escalado (4+ semanas)

- Extender offline a consignaciones/liquidaciones.
- Endurecer seguridad de dispositivo y auditoria.
- Optimizar sincronizacion incremental multi-modulo.

## Areas del Repo a Impactar (referencia inicial)

- `src/lib/apiService.ts`
- `src/lib/requireAuth.ts`
- `src/app/(system-guard)/(protected)/layout.tsx`
- `src/app/(system-guard)/(protected)/ventas/nueva/page.tsx`
- `src/app/api/ventas/route.ts`
- `src/app/api/pagos/route.ts`
- `src/app/api/clientes/route.ts`
- `prisma/schema.prisma`
- `server.ts`
- `src/lib/offline/*` (nuevo)

## Criterios de Aceptacion Iniciales (MVP)

- La app puede abrirse sin red con shell cacheado.
- El operador puede crear una venta offline y verla como pendiente.
- Al reconectar, la venta se sincroniza una sola vez.
- Los conflictos se detectan, quedan auditados y son resolubles.

## Estado

Feature candidata para planificacion y priorizacion en roadmap.
