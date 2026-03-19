# Politica de manejo de secretos

## Objetivo

Evitar secretos reales activos dentro del repositorio y definir una politica verificable para rotacion, custodia y respuesta ante exposicion.

## Alcance

Aplica a secretos de base de datos, JWT, cookies, links firmados, cron, sockets, email transaccional, proveedores de pago, cuentas iniciales de seed y cualquier otro valor con capacidad de autenticar, firmar o acceder a datos.

## Principios obligatorios

1. Ningun secreto real activo debe vivir en archivos versionados.
2. Todo secreto expuesto en el repo se considera comprometido aunque luego se elimine.
3. Produccion, staging y cualquier ambiente compartido deben resolver secretos fuera del repo.
4. Desarrollo local puede usar placeholders o valores no productivos claramente marcados.
5. La opcion por defecto es la mas segura: si hay duda, rotar y revocar.

## Origen por ambiente

| Ambiente | Origen permitido | Regla |
|----------|------------------|-------|
| Local | `.env` local no compartido o gestor local del desarrollador | Solo placeholders o credenciales locales no productivas. |
| CI | Variables protegidas del proveedor CI | Nunca copiar secretos en fixtures o artefactos generados. |
| Staging | Secret store / variables del entorno | Valores independientes de produccion. |
| Produccion | Secret store / variables del entorno | El repo no es autoridad para secretos productivos. |

## Responsables

| Rol | Responsabilidad |
|-----|-----------------|
| Responsable tecnico del cambio | Coordinar saneamiento del repo y seguimiento de pendientes. |
| Owner de plataforma / deploy | Actualizar secretos en cada ambiente y ejecutar rollback seguro. |
| Owner del proveedor externo | Rotar claves en Mercado Pago, PayPal, Resend u otros paneles. |
| QA / operacion | Verificar integraciones luego de cada rotacion y guardar evidencia. |

## Frecuencia minima de rotacion

| Tipo de secreto | Frecuencia minima | Disparadores adicionales |
|-----------------|-------------------|--------------------------|
| DB, JWT, cookies, links firmados, cron, socket, PDF | Cada 90 dias | Exposicion, fuga sospechada, cambio de personal, incidente de acceso. |
| Pago y webhooks (Mercado Pago, PayPal) | Cada 90 dias o segun el proveedor, lo que sea mas estricto | Exposicion, fallo de webhook, cambio de cuenta, auditoria. |
| Email transaccional (Resend u otro) | Cada 90 dias | Exposicion, abuso de envios, rebotes anomalos. |
| Credenciales iniciales / seed | Inmediata luego del bootstrap | Nunca reutilizar valores compartidos. |

## Procedimiento ante exposicion

1. Registrar el incidente y el alcance del secreto afectado.
2. Revocar o reemplazar el secreto en el origen correspondiente.
3. Actualizar todos los ambientes afectados de forma coordinada.
4. Invalidar sesiones, tokens o enlaces firmados derivados del valor expuesto cuando aplique.
5. Verificar integraciones, logs y alertas despues del cambio.
6. Conservar evidencia minima: fecha, responsable, sistemas alcanzados y resultado de validacion.

## Controles de repositorio

- `.env` queda sanitizado con valores locales no productivos.
- `.env.example` queda habilitado para versionado y onboarding seguro.
- Cualquier archivo nuevo de ejemplo debe usar placeholders obvios (`change-me`, `example`, `dev-only`).
- Ejecutar `npm run security:scan-secrets-local` antes de proponer cambios sobre configuracion sensible.

## Evidencia y auditoria

Cada rotacion debe dejar como minimo:

- fecha y hora,
- secreto o categoria rotada,
- ambientes actualizados,
- responsable,
- validaciones ejecutadas,
- incidentes o regresiones detectadas.

## No permitido

- Reutilizar un secreto que estuvo expuesto en el repo.
- Copiar secretos reales a `docs/`, `openspec/`, tests, seeds o capturas.
- Compartir `.env` por chat, tickets o PRs.
- Considerar cerrado un incidente solo por borrar la linea del repositorio.
