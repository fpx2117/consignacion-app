# ADR-0001: Servidor custom Next.js + Socket.io

## Estado

Aprobado

## Contexto

La aplicacion requiere eventos en tiempo real para notificaciones operativas (stock, suscripciones, consignaciones). El runtime default de Next.js no resuelve por si solo la convivencia de:

- render/app + Route Handlers,
- endpoint interno para despacho de eventos,
- y servidor Socket.io autenticado con cookie JWT.

## Decision

Se usa `server.ts` como proceso principal:

1. Inicializa Next.js con `next({ dev, hostname, port })`.
2. Crea servidor HTTP nativo de Node.
3. Monta Socket.io en path `/socket.io`.
4. Implementa `/api/socket/dispatch` en el mismo proceso para emitir eventos desde handlers de API.
5. Protege dispatch con `Authorization: Bearer <SOCKET_DISPATCH_SECRET>`.
6. Autentica handshake de Socket.io validando JWT de cookie.

## Consecuencias

### Positivas

- Un solo proceso para UI, API y tiempo real.
- Menor complejidad operativa frente a desplegar un broker/proceso separado.
- Flujo directo para emitir notificaciones desde backend HTTP.

### Negativas

- Acoplamiento mayor entre runtime web y canal realtime.
- Escalado horizontal requiere afinidad de sesiones o estrategia de pub/sub si crece el volumen.
- El comando dev/build/start debe respetar el servidor custom (`tsx server.ts`).

## Alternativas consideradas

1. Ejecutar Socket.io como servicio separado: descartado por complejidad de despliegue y sincronizacion temprana.
2. Reemplazar Socket.io por polling: descartado por latencia y peor UX en alertas operativas.

## Referencias

- `server.ts`
- `src/providers/socket-provider.tsx`
- `src/providers/socket-toaster.tsx`
