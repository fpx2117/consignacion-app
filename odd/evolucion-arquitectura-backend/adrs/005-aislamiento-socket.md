# ADR 005 — Aislamiento de eventos Socket.IO

## Contexto

El servidor autentica JWT, emite globalmente y no utiliza salas por sucursal o
usuario ni revalida una sesión revocada.

## Opciones

- Mantener broadcast global.
- Filtrar sólo en el cliente.
- Autorizar conexiones y enrutar eventos mediante salas del servidor.

## Decisión

El servidor validará sesión vigente y unirá cada socket únicamente a salas
autorizadas de instalación, sucursal y usuario. Los productores emitirán al
destino mínimo necesario.

## Motivo

El filtrado cliente no es un límite de seguridad y el broadcast expone eventos
entre sucursales de una misma instalación.

## Consecuencias

- Reconexión y revocación tendrán pruebas de integración.
- El payload y nombre de eventos se conservarán durante la transición.
- La entrega confiable se resolverá separadamente mediante outbox si es necesaria.
