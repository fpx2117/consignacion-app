# Plan de desacople de Socket.IO

## Objetivo
Separar el tiempo real (Socket.IO) del servidor principal de Next.js para mejorar escalabilidad, latencia y aislación de fallos, sin cambiar funcionalidades visibles para el usuario.

## Estado actual
- Next.js y Socket.IO corren acoplados en el mismo proceso (`server.ts`).
- El frontend usa `SocketProvider` y eventos (`new-notification`) para notificaciones en vivo.
- La autenticación del socket se basa en sesión/cookie del mismo dominio.

## Viabilidad
**Sí, es viable.**

### Beneficios esperados
- Menor impacto del tráfico websocket sobre requests HTTP tradicionales.
- Escalado independiente: API web por un lado, realtime por otro.
- Menor riesgo de degradación global por picos de conexiones socket.

### Riesgos / costos
- Complejidad operativa mayor (2 servicios en vez de 1).
- Necesidad de sincronizar eventos entre servicios (bus de eventos o cola).
- Manejo explícito de autenticación cross-service (JWT corto o session token firmado).

## Diseño objetivo (alto nivel)
1. **Servicio Web (Next.js):** SSR, APIs, auth, negocio.
2. **Servicio Realtime (Socket.IO):** conexiones WS, rooms, broadcast.
3. **Bus de eventos interno:** Redis Pub/Sub (recomendado) o cola equivalente.
4. **Contrato de eventos versionado:** payloads tipados (`event`, `version`, `data`, `tenant/sucursalId`).

## Fases recomendadas

### Fase 0 - Preparación
- Definir catálogo de eventos actuales y consumidores.
- Versionar contratos (`v1`, `v2`) para evitar rompimientos.
- Añadir métricas base: conexiones activas, mensajes/s, errores, latencia ack.

### Fase 1 - Adapter interno (sin mover infraestructura)
- Crear interfaz de publicación de eventos (`RealtimePublisher`).
- Reemplazar llamados directos a Socket.IO en backend por el adapter.
- Mantener implementación actual (in-process) para no romper nada.

### Fase 2 - Servicio Socket dedicado (staging)
- Levantar servicio Socket.IO separado.
- Agregar autenticación por token firmado de corta vida emitido por Next.
- Conectar Next -> Socket service vía Redis Pub/Sub.

### Fase 3 - Migración progresiva
- Habilitar feature flag: `REALTIME_EXTERNAL=true`.
- Migrar primero notificaciones no críticas.
- Validar reconexiones, rooms por sucursal/usuario y permisos.

### Fase 4 - Cutover y hardening
- Pasar 100% tráfico realtime al servicio externo.
- Mantener fallback temporal in-process por rollback rápido.
- Alertas y SLOs: disponibilidad WS, cola de eventos, p95 de entrega.

## Requisitos técnicos mínimos
- Redis (Pub/Sub) o broker equivalente.
- Token de acceso WS firmado (exp corto, 1-5 min) + refresh controlado.
- Namespaces/rooms por `sucursalId` y `userId`.
- Idempotencia en consumidores para evitar duplicados.

## Criterios de éxito
- p95 de entrega de notificación en vivo < 300 ms.
- 0 pérdida de eventos en pruebas de reconexión.
- Sin degradación de TTFB del servicio web bajo carga websocket.
- Rollback probado en < 5 min.

## Plan de rollback
- Feature flag para volver a in-process Socket.IO.
- Mantener adapter dual durante una ventana de estabilización.
- Monitoreo de tasa de error y latencia para disparar rollback automático.

## Estimación de esfuerzo
- Fase 0-1: 2-4 días.
- Fase 2-3: 4-8 días.
- Fase 4: 1-2 días.

Total aproximado: **1.5 a 3 semanas** según disponibilidad del entorno de pruebas y observabilidad.
