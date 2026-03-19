# Tareas: Endurecimiento de seguridad integral

## Alcance operativo

Este plan cubre solo la documentacion y ejecucion futura del endurecimiento de seguridad. No implica reescrituras funcionales fuera de los hallazgos auditados.

## Fase 0: Baseline y confirmacion del riesgo

**Dependencias**: ninguna.

### Checklist atomico

- [ ] 0.1 Confirmar y registrar el bypass multi-sucursal actual en `src/lib/auth/require-auth.ts`, incluyendo prioridad actual `header > cookie > JWT` y rutas criticas afectadas.
- [ ] 0.2 Inventariar secretos reales presentes en `.env` por categoria: base de datos, JWT, links firmados, credenciales iniciales, pagos y correo.
- [ ] 0.3 Inventariar flujos de upload/serving actuales (`src/app/api/upload/route.ts`, `src/app/api/files/[...path]/route.ts`, `public/uploads`, `UPLOAD_DIR`) y formatos servidos hoy.
- [ ] 0.4 Identificar endpoints sensibles sin throttling en auth/recovery (`login`, `forgot-password`, `reset-password`) y registrar su patron actual de respuesta.
- [ ] 0.5 Obtener baseline de advisories vigentes desde la herramienta aprobada (`npm audit` o SCA del pipeline) y clasificar por severidad/explotabilidad.

### Criterios de salida

- Hallazgos auditados confirmados con evidencia tecnica y alcance definido.
- Inventario inicial listo para priorizar implementacion y validacion.

## Fase 1: Endurecimiento de autorizacion multi-sucursal

**Dependencias**: Fase 0 completada.

### Checklist atomico

- [x] 1.1 Redefinir el contrato de `requireAuth()` para que `activeSucursalId` solo surja de una fuente controlada por servidor y siempre validada contra sucursales permitidas.
- [x] 1.2 Eliminar el uso de `x-sucursal-id` como override de contexto autorizado en `src/lib/auth/require-auth.ts`.
- [x] 1.3 Centralizar helper de validacion de sucursal efectiva para que las rutas no repliquen logica de autorizacion inconsistente.
- [x] 1.4 Revisar rutas multi-sucursal criticas que consumen `auth.activeSucursalId` y asegurar que no acepten headers como verdad implicita.
- [x] 1.5 Cubrir con tests unitarios/integracion los casos ADMIN, EMPLEADO, vista global, cookie invalida y header malicioso.

### Criterios de salida

- Ninguna request puede pivotear a otra sucursal solo enviando `x-sucursal-id`.
- El contexto devuelto por auth queda alineado con permisos reales del usuario.

## Fase 2: Saneamiento de secretos y politica operativa

**Dependencias**: Fase 0 completada.

### Checklist atomico

- [ ] 2.1 Tratar los valores reales de `.env` como secretos comprometidos y ejecutar rotacion por proveedor/sistema.
- [x] 2.2 Reemplazar `.env` versionado por placeholders o valores no productivos aptos para desarrollo local.
- [x] 2.3 Crear o actualizar `.env.example` con todas las variables requeridas y comentarios de formato, sin credenciales reales.
- [x] 2.4 Documentar politica de manejo de secretos: origen por ambiente, responsables, frecuencia de rotacion y procedimiento ante exposicion.
- [ ] 2.5 Validar que despliegues, integraciones de pago, correo y DB funcionen con los nuevos secretos rotados.

### Criterios de salida

- El repositorio no contiene secretos reales activos.
- Existe politica escrita y verificable de rotacion y manejo por ambiente.

## Fase 3: Endurecimiento de uploads y serving de archivos

**Dependencias**: Fase 0 completada.

### Checklist atomico

- [x] 3.1 Definir allowlist de tipos permitidos por caso de uso y limite de tamano maximo para uploads.
- [x] 3.2 Implementar validacion combinada de extension, MIME declarado y firma binaria/magic number cuando corresponda.
- [x] 3.3 Generar nombres opacos en servidor y desacoplar nombre original del identificador publico.
- [x] 3.4 Endurecer `src/app/api/files/[...path]/route.ts` con validacion de recurso, headers defensivos y restriccion de tipos servibles.
- [x] 3.5 Definir estrategia para archivos legacy ya almacenados y su compatibilidad transitoria, si aplica.
- [x] 3.6 Cubrir con pruebas intentos de subir archivos disfrazados, payloads no permitidos, tamano excedido y rutas ambiguas.

### Criterios de salida

- El backend rechaza archivos no aprobados aunque el cliente los envie manualmente.
- El serving deja de exponer contenido arbitrario sin control fuerte.

## Fase 4: Rate limiting y anti-abuso en auth/recovery

**Dependencias**: Fase 0 completada.

### Checklist atomico

- [x] 4.1 Incorporar rate limiting configurable en `src/app/api/auth/login/route.ts`.
- [x] 4.2 Incorporar rate limiting configurable en `src/app/api/auth/forgot-password/route.ts` manteniendo respuesta anti-enumeracion.
- [x] 4.3 Incorporar rate limiting configurable en `src/app/api/auth/reset-password/route.ts`, incluyendo control por token/identidad/IP.
- [x] 4.4 Registrar eventos de seguridad para intentos bloqueados, patrones anomalos y abuso reiterado.
- [x] 4.5 Ajustar mensajes y codigos de respuesta para no filtrar informacion sensible ni permitir enumeracion.
- [ ] 4.6 Validar thresholds iniciales en escenarios reales y documentar tuning operativo.

### Criterios de salida

- Los endpoints sensibles resisten brute force/flooding basico con observabilidad suficiente.
- Las respuestas siguen siendo uniformes y no facilitan enumeracion de cuentas o tokens.

## Fase 5: Remediacion de dependencias con advisories

**Dependencias**: Fase 0 completada.

### Checklist atomico

- [x] 5.1 Priorizar advisories por severidad, explotabilidad y exposicion en runtime.
- [x] 5.2 Actualizar primero dependencias vinculadas a auth, parsing, uploads, serving y framework de red.
- [x] 5.3 Ejecutar build, lint, typecheck y smoke tests despues de cada lote de upgrade.
- [x] 5.4 Documentar advisories cerrados, dependencias pendientes y mitigaciones temporales cuando un upgrade mayor no sea inmediato.
- [x] 5.5 Fijar criterio de mantenimiento para evitar que advisories criticos vuelvan a acumularse sin seguimiento.

### Criterios de salida

- Los advisories priorizados quedan cerrados o mitigados con decision explicita y documentada.
- Existe evidencia reproducible del estado de seguridad del arbol de dependencias tras el cambio.

## Fase 6: Verificacion integral y rollout

**Dependencias**: Fases 1 a 5 completadas.

### Checklist atomico

- [x] 6.1 Ejecutar suite de pruebas de auth multi-sucursal, uploads, serving y auth/recovery con rate limiting.
- [x] 6.2 Ejecutar validaciones tecnicas del proyecto (`npm run lint`, `npx tsc --noEmit`, `npm run build`) y baseline de advisories posterior.
- [ ] 6.3 Completar checklist operativo de rotacion de secretos por ambiente y verificar integraciones externas.
- [ ] 6.4 Monitorear 401/403/429, errores de media y fallos de integraciones en la ventana inicial post-deploy.
- [x] 6.5 Publicar reporte de cierre con cambios aplicados, riesgos residuales y acciones diferidas si quedaran pendientes.

### Criterios de aceptacion global

- [ ] El bypass por `x-sucursal-id` queda cerrado sin romper el acceso legitimo multi-sucursal.
- [ ] No quedan secretos reales activos dentro del repositorio.
- [ ] Uploads y archivos servidos respetan allowlists y validaciones fuertes.
- [ ] Auth/recovery tiene rate limiting efectivo y observable.
- [ ] El baseline de advisories mejora y cualquier residual queda documentado con mitigacion.
