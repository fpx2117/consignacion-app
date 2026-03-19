# Runbook de rotacion e incident response de secretos

## Estado actual de esta fase

El repo fue saneado para eliminar valores reales/plausibles de archivos locales. La rotacion real en proveedores y ambientes externos sigue pendiente porque requiere acceso operativo fuera de este repositorio.

## Inventario de categorias comprometidas detectadas

Se detectaron valores reales o plausibles previamente presentes en `.env` para estas categorias:

- base de datos PostgreSQL,
- JWT y nombre de cookie de autenticacion,
- links firmados y token PDF,
- cron y dispatch interno,
- credenciales iniciales de seed,
- Mercado Pago,
- PayPal,
- Resend.

No volver a usar ninguno de esos valores historicos.

## Checklist operativo de rotacion

### 1. Contencion inmediata

- [ ] Confirmar el commit o archivo donde existio la exposicion.
- [ ] Abrir incidente interno con responsable y ventana de seguimiento.
- [ ] Congelar cualquier reutilizacion manual de los valores expuestos.

### 2. Rotacion por sistema

#### Base de datos

- [ ] Emitir nueva password / connection string en el proveedor de DB.
- [ ] Actualizar staging y produccion.
- [ ] Verificar migraciones, health checks y consultas criticas.
- [ ] Revocar la credencial anterior.

#### JWT, cookies y secretos de firma

- [ ] Generar nuevos `JWT_SECRET`, `JWT_COOKIE_NAME`, `SHARE_LINK_SECRET`, `PDF_SECRET`, `CRON_SECRET` y `SOCKET_DISPATCH_SECRET`.
- [ ] Desplegar los nuevos valores en todos los ambientes.
- [ ] Invalidar sesiones o links firmados emitidos con secretos anteriores si el riesgo lo exige.

#### Mercado Pago

- [ ] Rotar `MP_ACCESS_TOKEN`.
- [ ] Confirmar `MP_PUBLIC_KEY` / `NEXT_PUBLIC_MP_PUBLIC_KEY` vigentes para el ambiente correcto.
- [ ] Rotar `MP_WEBHOOK_SECRET` si existe firma o secreto asociado.
- [ ] Verificar checkout, webhook y conciliacion basica.

#### PayPal

- [ ] Rotar `PAYPAL_CLIENT_ID` y `PAYPAL_SECRET` en el modo activo.
- [ ] Rotar `PAYPAL_WEBHOOK_ID` o re-registrar webhook si el proveedor lo requiere.
- [ ] Verificar alta de suscripcion, aprobacion y callback.

#### Email transaccional

- [ ] Rotar `RESEND_API_KEY`.
- [ ] Verificar envio de forgot-password y cualquier email critico.

#### Credenciales iniciales / seed

- [ ] Cambiar passwords iniciales compartidas.
- [ ] Confirmar que ningun ambiente reutilice cuentas bootstrap debiles.

### 3. Verificacion posterior

- [ ] Login y validacion de cookie/JWT funcionan con los nuevos secretos.
- [ ] Links firmados nuevos funcionan y los anteriores quedan invalidados si corresponde.
- [ ] Integraciones de pago responden sin errores de autenticacion.
- [ ] Emails transaccionales salen correctamente.
- [ ] Aplicacion conecta a DB en todos los ambientes afectados.
- [ ] Logs y alertas no muestran 401/403/500 anormales despues de la rotacion.

## Validacion local disponible desde el repo

Antes de coordinar la rotacion externa, ejecutar:

```bash
npm run security:scan-secrets-local
```

Ese control verifica que `.env` y `.env.example` mantengan placeholders seguros y que el archivo de ejemplo cubra las variables requeridas por la aplicacion.

## Cierre del incidente

Un incidente de exposicion de secretos solo puede cerrarse cuando:

1. el secreto expuesto fue reemplazado en origen,
2. todos los ambientes afectados usan el nuevo valor,
3. el valor anterior fue revocado o dejado inutilizable,
4. las integraciones dependientes fueron verificadas,
5. la evidencia operativa quedo registrada.

## Pendientes explicitos fuera del repo

- Rotacion real en proveedores externos y paneles de despliegue.
- Verificacion operativa de DB, Mercado Pago, PayPal, Resend y webhooks con los nuevos valores.
- Revocacion final de los secretos historicos detectados en la auditoria.
