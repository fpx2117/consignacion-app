# Checklist operativa de produccion - endurecimiento de seguridad

## Objetivo

Ejecutar en produccion el cierre operativo pendiente del cambio `endurecimiento-seguridad-integral`, cubriendo rotacion real de secretos, despliegue controlado, smoke tests y monitoreo inicial para completar `6.3` y `6.4`.

## Alcance

- Rotacion real de secretos en proveedores y plataforma de despliegue.
- Verificacion de integraciones externas con los nuevos valores.
- Monitoreo post-deploy de auth, media, pagos, correo y webhooks.
- Recoleccion de evidencia para cerrar tareas operativas pendientes.

## Pre-requisitos

- [ ] Tener acceso operativo a produccion, proveedor de DB, Mercado Pago, PayPal, Resend y panel de despliegue.
- [ ] Tener a mano `docs/security/ROTACION_SECRETOS_RUNBOOK.md`.
- [ ] Tener a mano `docs/security/AUTH_RATE_LIMITING_OPERACION.md`.
- [ ] Tener definido responsable tecnico, responsable funcional y ventana de cambio.
- [ ] Confirmar backup vigente o snapshot util antes de tocar credenciales productivas.
- [ ] Confirmar canal de comunicacion del incidente/cambio durante la ventana.

## Inventario de secretos a rotar

- [ ] `DATABASE_URL`
- [ ] `JWT_SECRET`
- [ ] `JWT_COOKIE_NAME` si aplica rotacion/cambio operativo
- [ ] `SHARE_LINK_SECRET`
- [ ] `PDF_SECRET`
- [ ] `CRON_SECRET`
- [ ] `SOCKET_DISPATCH_SECRET`
- [ ] `MP_ACCESS_TOKEN`
- [ ] `MP_PUBLIC_KEY`
- [ ] `NEXT_PUBLIC_MP_PUBLIC_KEY`
- [ ] `MP_WEBHOOK_SECRET` si aplica
- [ ] `PAYPAL_CLIENT_ID`
- [ ] `PAYPAL_SECRET`
- [ ] `PAYPAL_WEBHOOK_ID`
- [ ] `RESEND_API_KEY`
- [ ] Cuentas bootstrap / passwords iniciales aun vigentes

## Secuencia recomendada de ejecucion

### 1. Preparacion previa

- [ ] Ejecutar localmente `npm run security:scan-secrets-local` y confirmar resultado limpio.
- [ ] Confirmar que el deploy candidate corresponde al ultimo lote verificado del cambio.
- [ ] Confirmar que `npm run security:audit` ya no reporta `high`/`critical`.
- [ ] Preparar registro de evidencia con fecha, ambiente, responsable y resultado por paso.

### 2. Rotacion de secretos productivos

#### Base de datos

- [ ] Generar nueva credencial o nueva connection string en el proveedor.
- [ ] Cargar el nuevo `DATABASE_URL` en produccion.
- [ ] Aplicar redeploy controlado.
- [ ] Verificar healthcheck, login y consulta simple dependiente de Prisma.
- [ ] Revocar la credencial anterior.

#### JWT, cookies y secretos de firma

- [ ] Generar nuevos `JWT_SECRET`, `SHARE_LINK_SECRET`, `PDF_SECRET`, `CRON_SECRET` y `SOCKET_DISPATCH_SECRET`.
- [ ] Cargar secretos nuevos en produccion.
- [ ] Redeployar.
- [ ] Verificar login, logout, sesion, links firmados y generacion de PDFs.
- [ ] Definir si se invalida sesion previa masivamente y registrar la decision.

#### Mercado Pago

- [ ] Rotar `MP_ACCESS_TOKEN`.
- [ ] Confirmar `MP_PUBLIC_KEY` y `NEXT_PUBLIC_MP_PUBLIC_KEY` del ambiente correcto.
- [ ] Rotar `MP_WEBHOOK_SECRET` si existe.
- [ ] Actualizar valores en produccion.
- [ ] Verificar checkout sandbox/controlado y recepcion de webhook.

#### PayPal

- [ ] Rotar `PAYPAL_CLIENT_ID` y `PAYPAL_SECRET`.
- [ ] Rotar o recrear `PAYPAL_WEBHOOK_ID` si corresponde.
- [ ] Actualizar valores en produccion.
- [ ] Verificar flujo de aprobacion/callback en ambiente controlado.

#### Correo transaccional

- [ ] Rotar `RESEND_API_KEY`.
- [ ] Actualizar valor en produccion.
- [ ] Verificar envio de forgot-password o mail critico equivalente.

#### Credenciales bootstrap

- [ ] Cambiar passwords iniciales o cuentas compartidas remanentes.
- [ ] Confirmar que no queden usuarios bootstrap con credenciales debiles activas.

### 3. Smoke tests inmediatos post-rotacion

#### Auth

- [ ] Login valido con usuario admin.
- [ ] Login valido con usuario empleado.
- [ ] Login invalido devuelve respuesta segura.
- [ ] Forgot password responde sin enumeracion visible.
- [ ] Reset password con token valido completa flujo.
- [ ] Reset password con token invalido/expirado responde de forma uniforme.

#### Autorizacion multi-sucursal

- [ ] Admin puede operar en sucursal permitida.
- [ ] Empleado no puede pivotear a sucursal ajena.
- [ ] Cambio de sucursal sigue funcionando con el flujo endurecido.
- [ ] Verificar comportamiento de vista global si esta habilitada en produccion.

#### Uploads y archivos

- [ ] Subir imagen valida permitida.
- [ ] Intento de archivo no permitido es rechazado.
- [ ] Archivo nuevo se sirve por `/api/files/...` con headers correctos.
- [ ] Archivo legacy critico sigue accesible si depende aun de compatibilidad transitoria.

#### Pagos, correo y jobs

- [ ] Checkout/control de suscripcion con Mercado Pago.
- [ ] Callback/webhook de Mercado Pago recibido correctamente.
- [ ] Callback/webhook de PayPal recibido correctamente.
- [ ] Forgot-password entrega email.
- [ ] Job o cron sensible sigue autenticando correctamente.

### 4. Monitoreo intensivo post-deploy

Ventana sugerida: primeros 30-60 minutos.

- [ ] Revisar `401`, `403`, `429` y `5xx` en logs/apm.
- [ ] Revisar eventos `AUTH_RATE_LIMIT_WARNING` y `AUTH_RATE_LIMIT_BLOCK` buscando falsos positivos.
- [ ] Revisar errores de uploads/serving (`403`, `404`, MIME incorrecto, rechazos inesperados).
- [ ] Revisar errores de Prisma y de conexion a DB.
- [ ] Revisar errores de Resend, Mercado Pago, PayPal y webhooks.
- [ ] Confirmar que no haya picos anormales de rechazos de login o recuperacion.
- [ ] Ajustar thresholds de rate limiting solo si aparece un patron legitimo bloqueado.

### 5. Criterio de rollback operativo

Ejecutar rollback solo si aparece alguno de estos eventos:

- [ ] Login masivamente roto o sesion inutilizable.
- [ ] Error sostenido de DB tras rotacion.
- [ ] Pagos o webhooks rotos en produccion.
- [ ] Correo transaccional critico caido.
- [ ] Serving de archivos rompe flujos esenciales del negocio.

Si se activa rollback:

- [ ] Revertir deploy de aplicacion si corresponde.
- [ ] Restaurar configuracion estable en plataforma.
- [ ] NO reutilizar secretos viejos comprometidos; usar valores nuevos alternativos si hace falta.
- [ ] Abrir incidente y registrar timestamps, sintomas y decision tecnica.

## Evidencia minima para cerrar 6.3 y 6.4

- [ ] Registro de secretos rotados por proveedor/ambiente.
- [ ] Confirmacion de revocacion de secretos anteriores.
- [ ] Resultado de smoke tests post-rotacion.
- [ ] Captura o log de webhooks/pagos/correo verificados.
- [ ] Ventana de monitoreo completada sin incidentes criticos.
- [ ] Lista de ajustes aplicados a thresholds de rate limiting, si hubo.

## Criterio de cierre

Se puede considerar cerrada la parte operativa cuando:

- [ ] Todos los secretos productivos comprometidos fueron reemplazados.
- [ ] Los valores anteriores quedaron revocados o inutilizables.
- [ ] Las integraciones externas quedaron verificadas.
- [ ] El monitoreo inicial post-deploy no muestra regresiones criticas.
- [ ] La evidencia operativa quedo archivada en el registro del cambio/incidente.

## Registro sugerido de ejecucion

```text
Fecha:
Ambiente: produccion
Responsable tecnico:
Responsable funcional:
Version desplegada:

Secretos rotados:
- DATABASE_URL: [hora / responsable / resultado]
- JWT_SECRET: [hora / responsable / resultado]
- MP_ACCESS_TOKEN: [hora / responsable / resultado]
- PAYPAL_SECRET: [hora / responsable / resultado]
- RESEND_API_KEY: [hora / responsable / resultado]

Smoke tests:
- Login admin: OK/FAIL
- Login empleado: OK/FAIL
- Forgot password: OK/FAIL
- Upload valido: OK/FAIL
- Webhook MP: OK/FAIL
- Webhook PayPal: OK/FAIL

Monitoreo 30-60 min:
- 401/403/429: OK/FAIL
- Media/uploads: OK/FAIL
- DB/Prisma: OK/FAIL
- Correo: OK/FAIL

Decision final:
- Cerrar 6.3: SI/NO
- Cerrar 6.4: SI/NO
- Observaciones:
```
