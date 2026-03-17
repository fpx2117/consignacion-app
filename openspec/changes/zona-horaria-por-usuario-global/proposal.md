# Propuesta: Zona horaria por usuario global

## Intencion

Eliminar el supuesto de negocio de que `America/Argentina/Buenos_Aires` es la zona horaria correcta para todos los casos y reemplazar la decision actual de usar solo la sucursal como fuente de verdad.

El nuevo objetivo es que cada usuario pueda definir su zona horaria y que esa configuracion se aplique de forma consistente en todos los modulos del sistema. La precedencia requerida sera: `usuario > sucursal > fallback tecnico`.

El fallback tecnico se mantiene solo por compatibilidad temporal durante la transicion; no debe consolidarse como comportamiento deseado del producto.

## Alcance

### Dentro del alcance

- Incorporar una configuracion de zona horaria por usuario y definirla como fuente primaria para calculos y presentacion.
- Mantener la configuracion por sucursal como fuente secundaria de compatibilidad y override organizacional cuando el usuario no tenga valor propio.
- Centralizar la resolucion de zona horaria en un helper/servicio comun con precedencia `usuario > sucursal > fallback tecnico`.
- Remover hardcodes y fallbacks dispersos en backend, reportes, utilidades de fechas y UI.
- Alinear endpoints, pantallas y templates para que consuman la zona horaria resuelta en lugar de asumir `America/Argentina/Buenos_Aires`.
- Dejar explicitado en specs/diseno posteriores que este cambio reemplaza la decision arquitectonica del change `configuracion-zona-horaria`, orientado solo por sucursal.

### Fuera del alcance

- Migrar o reescribir fechas historicas ya persistidas en la base de datos.
- Permitir multiples zonas horarias activas para un mismo usuario en una misma sesion.
- Resolver preferencias regionales adicionales (locale, formato numerico, idioma) mas alla de la zona horaria.
- Eliminar inmediatamente el fallback tecnico global; su retiro queda para una etapa posterior cuando la cobertura de configuracion sea total.

## Enfoque

La implementacion debera introducir una unica capa de resolucion de zona horaria consumida por APIs, utilidades compartidas, reportes y pantallas. Esa capa debera consultar primero la preferencia del usuario autenticado, luego la configuracion de la sucursal activa y, solo si ambas no existen, aplicar un fallback tecnico temporal.

El cambio tambien debera identificar y reemplazar los hardcodes existentes en schema, helpers y rutas para evitar comportamientos inconsistentes entre modulos. La configuracion por sucursal no desaparece, pero deja de ser la unica fuente de verdad y pasa a ser un nivel secundario de precedencia.

## Areas afectadas

| Area | Impacto | Descripcion |
|------|---------|-------------|
| `prisma/schema.prisma` | Modificado | Incorporar soporte persistente para zona horaria por usuario y revisar defaults hardcodeados. |
| `src/lib/get-configured-tz.ts` | Modificado | Centralizar la precedencia `usuario > sucursal > fallback tecnico`. |
| `src/lib/utils-date.ts` | Modificado | Resolver rangos y calculos de fecha con la zona horaria efectiva, sin asumir Buenos Aires. |
| `src/lib/utils-format.ts` | Modificado | Formatear fechas/horas usando la zona horaria resuelta. |
| `src/lib/reports/template-helpers.ts` | Modificado | Unificar el formateo de reportes con la misma fuente de verdad. |
| `src/lib/pedidos-esperados.ts` | Modificado | Eliminar supuestos fijos de zona horaria en logica operativa. |
| `src/app/api/settings/**` | Modificado | Exponer y persistir configuracion de zona horaria por usuario, manteniendo compatibilidad con sucursal. |
| `src/app/api/settings/pos/cajas/turno/route.ts` | Modificado | Validar horarios operativos con la zona horaria efectiva. |
| `src/app/api/ventas/[id]/route.ts` | Modificado | Dejar de responder con fechas calculadas bajo hardcodes locales. |
| `src/app/api/historial/anios/route.ts` | Modificado | Calcular rangos y agregaciones anuales con la precedencia definida. |
| `src/app/(system-guard)/(protected)/gastos/page.tsx` | Modificado | Ajustar filtros y presentacion para la zona horaria resuelta. |
| `src/app/**` y componentes UI relacionados | Modificado | Revisar otras rutas/pantallas que hoy consumen fallbacks implicitos o formateo local inconsistente. |

## Riesgos

| Riesgo | Probabilidad | Mitigacion |
|--------|--------------|------------|
| Inconsistencias entre modulos si parte del codigo sigue usando hardcodes | Alta | Inventario explicito de puntos afectados y adopcion obligatoria del resolver comun. |
| Regresiones en calculos de rangos (hoy, mes, ano, turnos) | Media | Cubrir utilidades y endpoints criticos con pruebas sobre distintas zonas horarias. |
| Confusion operativa por convivencia de configuracion por usuario y por sucursal | Media | Documentar la precedencia en UI, API y artefactos de OpenSpec. |
| Dependencia prolongada del fallback tecnico | Media | Tratarlo como compatibilidad temporal, medir uso y planificar retiro posterior. |

## Plan de Reversion (Rollback)

Si el cambio introduce errores funcionales, se puede volver temporalmente al esquema anterior desactivando la lectura de zona horaria por usuario y restaurando la resolucion basada en sucursal mas fallback tecnico. Como la compatibilidad por sucursal se mantiene, el rollback puede hacerse en codigo sin requerir eliminar datos nuevos de configuracion.

## Dependencias

- Definir donde se persiste la preferencia de zona horaria del usuario y como se obtiene en el contexto autenticado.
- Confirmar compatibilidad con el change existente `configuracion-zona-horaria` para reaprovechar lo ya valido a nivel sucursal.
- Contar con una lista/validacion confiable de zonas horarias IANA para API y UI.
- Revisar modulos que hoy dependen de helpers de fecha compartidos para evitar bypass del resolver central.

## Criterios de exito

- [ ] Existe una unica resolucion documentada y reutilizable con precedencia `usuario > sucursal > fallback tecnico`.
- [ ] Un usuario puede definir su zona horaria y verla aplicada en todos los modulos relevantes del sistema.
- [ ] La configuracion por sucursal sigue funcionando solo como nivel secundario de compatibilidad.
- [ ] Los hardcodes de `America/Argentina/Buenos_Aires` quedan removidos de los puntos criticos identificados o encapsulados exclusivamente como fallback tecnico temporal.
- [ ] Reportes, filtros, rangos de fechas, turnos y vistas operativas usan la misma zona horaria efectiva.
- [ ] La propuesta de arquitectura deja explicitamente reemplazada la decision previa de usar solo sucursal como fuente de verdad.
