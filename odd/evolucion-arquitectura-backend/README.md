# Evolución segura de la arquitectura backend

Estado: diagnóstico y diseño propuestos; implementación no autorizada.

## Objetivo

Reorganizar progresivamente el backend para corregir problemas de integridad,
concurrencia, seguridad y mantenibilidad sin reescribir la aplicación ni
modificar sus contratos HTTP, comportamiento comercial, interfaz, Next.js,
Prisma o PostgreSQL.

## Documentos

- [Exploración](./exploration.md): evidencia confirmada, riesgos estáticos y
  validaciones pendientes.
- [Diseño](./design.md): arquitectura objetivo, límites de módulos y estrategia
  para cálculos puros.
- [Tareas](./tasks.md): avance, bloqueos y secuencia de ejecución propuesta.
- [ADRs](./adrs/): decisiones, alternativas y consecuencias que deberán
  aprobarse antes de implementar.

## Decisiones vigentes

1. Cada comercio utiliza su propia instalación y base de datos. No se
   introducirá `Organization`, `Tenant` ni una arquitectura multi-tenant.
2. La solución seguirá siendo un monolito modular. No hay evidencia que
   justifique microservicios.
3. Se aplicará Clean Architecture como regla de dependencias y DDD solamente en
   módulos con reglas e invariantes reales.
4. Los cálculos comerciales se extraerán como funciones puras antes de mover
   masivamente archivos.
5. `StockSucursal` será la fuente canónica de stock. El mecanismo temporal que
   mantenga `Producto` como proyección legacy sólo se aprobará después de probar
   su comportamiento concurrente y documentar una matriz de compatibilidad.
6. Ventas será el piloto para establecer el patrón arquitectónico, condicionado
   a caracterización, rollback ejecutable y autoridad única de numeración.
7. La rama canónica y única de trabajo es `main`. Las ramas alternativas
   existentes se consideran legacy y no deben usarse para nuevos cambios.
8. PostgreSQL asignará tanto `numeroVenta` por sucursal como `numeroFolio` por
   cliente, incluyendo la convivencia temporal con instancias legacy.

## Baseline de análisis

- Rama canónica: `main`.
- SHA observado en `origin/main`: `014eaee6bb659a007b506196d5f9ecea3132dcab`.
- El SHA identifica el punto analizado; no reemplaza la obligación de actualizar
  `main` mediante fast-forward antes de una futura implementación.
- Producción/Railway se despliega desde `main`.

## Restricciones

- No implementar, migrar datos, confirmar commits, publicar ni desplegar sin una
  autorización posterior y explícita.
- No alterar contratos observables durante la extracción.
- No eliminar ramas locales o remotas sin autorización expresa: es una operación
  destructiva distinta de dejar de utilizarlas.
- Separar siempre hechos confirmados, riesgos derivados del análisis estático y
  defectos reproducidos dinámicamente.
