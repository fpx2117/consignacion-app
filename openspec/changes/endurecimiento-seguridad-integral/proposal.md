# Propuesta: Endurecimiento de seguridad integral

## Intencion

La auditoria de seguridad ya identifico cinco hallazgos con impacto alto o transversal sobre autenticacion, aislamiento multi-sucursal, manejo de secretos, superficie de archivos expuestos y resistencia ante abuso. El problema no es un bug aislado sino una combinacion de controles debiles que hoy permite operar con confianza excesiva en headers manipulables, secretos reales en el repositorio, uploads servidos publicamente sin validacion fuerte, flujos sensibles sin rate limiting y dependencias con advisories pendientes.

Este cambio define el endurecimiento de seguridad para cerrar esas brechas sin redisenar el producto ni introducir cambios funcionales de negocio.

## Alcance

### Dentro del alcance

- Eliminar el bypass de autorizacion multi-sucursal originado por `x-sucursal-id` en `src/lib/auth/require-auth.ts` y formalizar una unica fuente de contexto de sucursal validada por el servidor.
- Definir politica de secretos para reemplazar credenciales reales en `.env`, establecer rotacion obligatoria y separar secretos locales de valores de produccion.
- Endurecer el flujo de uploads y serving de archivos con validacion fuerte de tipo, tamano, extensiones permitidas, nombres, almacenamiento y politicas de respuesta seguras.
- Agregar rate limiting y controles anti-abuso en endpoints de autenticacion y recuperacion de cuenta.
- Establecer plan de remediacion para dependencias con advisories, incluyendo criterio de priorizacion, actualizacion y validacion posterior.
- Documentar rollout, monitoreo y rollback para los controles anteriores.

### Fuera del alcance

- Reemplazo total del esquema de autenticacion JWT por sesiones server-side.
- Migracion a proveedor externo de secretos (Vault, AWS Secrets Manager, Doppler, etc.) en esta iteracion.
- Reescritura completa del modulo de media management o CDN dedicada.
- Refactors funcionales no relacionados con seguridad.
- Cambios de UX salvo los estrictamente necesarios para respuestas de error, throttling o validacion.

## Enfoque

La estrategia se divide en cinco frentes coordinados:

1. **Autorizacion multi-sucursal**: el servidor deja de confiar en `x-sucursal-id` como selector de contexto autorizado. La sucursal activa debe resolverse desde estado server-side/cookie validada y cruzarse siempre contra las sucursales permitidas para el usuario autenticado.
2. **Secretos y operacion**: los valores reales detectados en `.env` pasan a tratarse como incidente operativo. Se define rotacion inmediata, plantilla `.env.example`, politica de no versionado de secretos y checklist de despliegue.
3. **Uploads y archivos publicos**: se limita la superficie aceptando solo tipos explicitamente permitidos, con verificacion por firma/magic number cuando aplique, limites de peso, nombres opacos, almacenamiento fuera de rutas publicas directas y serving con headers defensivos.
4. **Proteccion anti-abuso**: login, forgot password y reset password incorporan rate limiting por IP, identidad y ventana temporal, mas registros de auditoria y respuestas uniformes.
5. **Dependencias vulnerables**: se corrigen advisories confirmados con un lote priorizado por severidad/explotabilidad y una validacion posterior de compatibilidad.

## Areas afectadas

| Area | Impacto | Descripcion |
|------|---------|-------------|
| `src/lib/auth/require-auth.ts` | Modificado | Eliminar confianza en `x-sucursal-id` como override de contexto y validar pertenencia real de sucursal. |
| `src/app/api/auth/login/route.ts` | Modificado | Incorporar rate limiting y respuesta compatible con politicas anti-abuso. |
| `src/app/api/auth/forgot-password/route.ts` | Modificado | Agregar throttling, controles anti-enumeracion reforzados y auditoria. |
| `src/app/api/auth/reset-password/route.ts` | Modificado | Agregar rate limiting, invalidacion y controles de consumo de token. |
| `src/app/api/upload/route.ts` | Modificado | Restringir tipos de archivo, tamanos, nombre generado y validacion de contenido. |
| `src/app/api/files/[...path]/route.ts` | Modificado | Endurecer serving, control de acceso segun tipo de archivo y headers defensivos. |
| `.env` | Modificado | Retirar secretos reales del repo y dejar solo placeholders/no productivos. |
| `.env.example` | Nuevo o modificado | Plantilla segura para desarrollo y onboarding sin valores sensibles. |
| `package.json` / lockfile | Modificado | Actualizar dependencias afectadas por advisories confirmados. |
| `docs/` o runbooks operativos | Modificado | Politica de secretos, rotacion, response playbook y proceso de upgrades de seguridad. |

## Riesgos

| Riesgo | Probabilidad | Mitigacion |
|--------|--------------|------------|
| Regresion en acceso multi-sucursal para administradores | Media | Tests de autorizacion por rol, sucursal activa y vista global antes del deploy. |
| Bloqueo de usuarios legitimos por rate limiting agresivo | Media | Umbrales por endpoint, ventanas cortas, backoff progresivo y observabilidad inicial. |
| Archivos existentes dejan de servirse por nuevas reglas | Media | Inventario de extensiones actuales y modo de compatibilidad temporal para legado conocido. |
| Rotacion de secretos rompe integraciones externas | Alta | Rotacion por etapas, doble validez temporal donde aplique y checklist por proveedor. |
| Upgrade de dependencias introduce cambios incompatibles | Media | Lote incremental, changelog review, typecheck/build/tests y plan de rollback por paquete. |

## Plan de rollback

1. Revertir el lote de codigo del control que cause regresion, sin reintroducir secretos reales al repositorio.
2. Mantener un mecanismo temporal de compatibilidad para archivos legacy y thresholds de rate limiting configurables por entorno.
3. Si una dependencia actualizada rompe runtime, volver a la ultima version estable documentada y reabrir remediation por paquete.
4. Para secretos, el rollback nunca consiste en reutilizar valores expuestos; se debe conservar la rotacion y ajustar solo configuracion o despliegue.

## Dependencias

- Inventario confiable de sucursales permitidas por usuario para validar contexto server-side.
- Variables de entorno segregadas por ambiente y acceso al panel/proveedor donde deben rotarse.
- Mecanismo de almacenamiento o serving de archivos compatible con URLs opacas y validacion centralizada.
- Herramienta de analisis de dependencias (`npm audit`, SCA del pipeline o equivalente) para confirmar cierre de advisories.

## Criterios de exito

- [ ] Ninguna request autenticada puede cambiar de sucursal efectiva solo enviando `x-sucursal-id` sin autorizacion server-side.
- [ ] El repositorio deja de contener secretos reales activos y existe politica documentada de rotacion y manejo por ambiente.
- [ ] Uploads solo aceptan archivos permitidos y el serving no expone arbitrariamente contenido no validado.
- [ ] Login, forgot password y reset password cuentan con rate limiting efectivo y observable.
- [ ] Las dependencias con advisories priorizados quedan actualizadas o mitigadas con justificacion documentada.
- [ ] El despliegue incluye validaciones, monitoreo inicial y plan de respuesta ante regresiones de seguridad.
