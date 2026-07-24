# Remediacion de dependencias vulnerables

## Objetivo

Reducir primero los advisories con mayor riesgo efectivo para el runtime expuesto y dejar documentado el riesgo residual que no puede cerrarse hoy sin un cambio mayor o sin soporte upstream.

## Baseline auditado

Fecha de corte: 2026-03-18.

| Estado                  | Total | High | Moderate | Notas                                                                                                                                     |
| ----------------------- | ----- | ---- | -------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Antes del lote Fase 5   | 14    | 8    | 6        | `next`, `socket.io-parser`, `axios`, `flatted`, `hono`, `@hono/node-server`, `prisma/@prisma/dev` y transitivas de `chevrotain`/`lodash`. |
| Despues del lote Fase 5 | 7     | 0    | 7        | Queda solo la cadena dev-only `prisma -> @prisma/dev -> @mrleebo/prisma-ast -> chevrotain -> lodash`.                                     |

## Priorizacion aplicada

| Prioridad | Paquete                                                            | Superficie                                                   | Riesgo efectivo                                                         | Decision                                                                      |
| --------- | ------------------------------------------------------------------ | ------------------------------------------------------------ | ----------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| P1        | `next`                                                             | framework HTTP/app router                                    | Runtime expuesto a internet                                             | Actualizar a `16.2.0`.                                                        |
| P1        | `socket.io-parser`                                                 | red/tiempo real                                              | Parser de mensajes expuesto por `server.ts`                             | Forzar `4.2.6` por `overrides`.                                               |
| P1        | `axios` via `node-andreani`                                        | integracion server-side en `POST /api/public/envios/cotizar` | Dependencia directa en endpoint publico                                 | Forzar `1.13.6` por `overrides`.                                              |
| P2        | `@hono/node-server` y `hono`                                       | toolchain dev/CLI                                            | No corre en el runtime de la app, pero tenia advisories altos           | Forzar versiones corregidas para reducir baseline sin tocar codigo funcional. |
| P2        | `flatted`                                                          | tooling de lint/cache                                        | No expuesto en runtime, fix directo disponible                          | Forzar `3.4.2`.                                                               |
| P3        | `prisma/@prisma/dev` + `@mrleebo/prisma-ast` + `chevrotain/lodash` | CLI de Prisma solamente                                      | Residual dev-only y sin remediacion segura publicada en la linea actual | Mitigar y dejar seguimiento documentado.                                      |

## Lote aplicado

- `next` `16.1.6 -> 16.2.0`
- `eslint-config-next` `16.1.6 -> 16.2.0`
- `overrides.@hono/node-server = 1.19.10`
- `overrides.hono = 4.12.7`
- `overrides.socket.io-parser = 4.2.6`
- `overrides.axios = 1.13.6`
- `overrides.flatted = 3.4.2`

## Advisories cerrados en esta fase

- `next`:
  - `GHSA-mq59-m269-xvcx` - bypass de CSRF en Server Actions con `null origin`
  - `GHSA-jcc7-9wpm-mj36` - bypass de CSRF en HMR websocket de desarrollo
  - `GHSA-3x4c-7xq6-9pq8` - crecimiento no acotado de cache de `next/image`
  - `GHSA-h27x-g6w4-24gq` - buffering no acotado con riesgo de DoS
  - `GHSA-ggv3-7p47-pfv8` - request smuggling en rewrites
- `socket.io-parser`:
  - `GHSA-677m-j7p3-52f9` - adjuntos binarios no acotados
- `axios` via `node-andreani`:
  - `GHSA-wf5p-g6vw-rhxx` - CSRF en requests
  - `GHSA-jr5f-v2jv-69x6` - SSRF y fuga de credenciales via URL absoluta
  - `GHSA-43fc-jf86-j433` - DoS por `__proto__` en `mergeConfig`
- `flatted`:
  - `GHSA-25h7-pfq9-p65f` - recursion no acotada en `parse()`
- `@hono/node-server` y `hono`:
  - `GHSA-wc8c-qw6v-h7f6`, `GHSA-q5qw-h33p-qvwr` y advisories moderados asociados de `serveStatic`, cache, SSE, cookies y `parseBody`

## Advisories pendientes y mitigacion temporal

| Estado    | Cadena                                                                 | Severidad | Motivo de pendiente                                                                                                                                                                                                        | Mitigacion temporal                                                                                                                                                                                                           |
| --------- | ---------------------------------------------------------------------- | --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Pendiente | `prisma -> @prisma/dev -> @mrleebo/prisma-ast -> chevrotain -> lodash` | Moderate  | `npm audit` solo ofrece una bajada mayor a `prisma@6.19.2`, pero la linea actual publicada de Prisma 7 sigue trayendo `@prisma/dev` vulnerable y no hay fix compatible confirmado para `@mrleebo/prisma-ast`/`chevrotain`. | Riesgo acotado a toolchain local/CI; no se expone en runtime. Mantener Prisma fuera de superficies publicas, revisar release notes de Prisma en cada upgrade y reintentar cierre cuando el upstream publique fix verificable. |

## Criterio de mantenimiento

1. Ejecutar `npm run security:audit` en cada cambio de dependencias y como chequeo semanal del arbol productivo.
2. Ejecutar `npm audit` completo cuando aparezca un advisory nuevo para clasificar si es runtime o dev-only.
3. Bloquear release si aparece un advisory `high` o `critical` en dependencias productivas expuestas.
4. Si el riesgo solo afecta tooling/dev, documentar responsable, mitigacion y condicion de salida en este archivo antes de diferirlo.
5. Mantener los `overrides` mientras los paquetes padre no publiquen un rango seguro nativo; revisar su necesidad en cada upgrade semestral o cuando cambie el lockfile de seguridad.
