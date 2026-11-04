# Mejoras de arquitectura — diagnóstico y backlog

Estado: diagnóstico cerrado; backlog propuesto. **Implementación no autorizada.**

Este documento nace de una revisión estática del repositorio completo. No es una
auditoría de seguridad ni un profiling en runtime. Cada afirmación numérica fue
verificada contra el código en el baseline declarado abajo; lo que no pudo
confirmarse está marcado como pendiente.

## Objetivo

Cerrar las brechas entre lo que el sistema **es** y lo que el sistema **dice ser**,
y reducir el costo de mantenimiento de los flujos con más riesgo operativo, sin
reescribir la aplicación ni alterar contratos HTTP, comportamiento comercial o
interfaz.

## Alcance

Dentro:

- coherencia entre documentación y código;
- trazabilidad (auditoría) y aislamiento por sucursal;
- testabilidad y capacidad de correr la suite completa;
- tamaño y cohesión de los archivos de mayor riesgo;
- definición explícita del modelo de render (SPA vs RSC);
- performance medible: índices, agregaciones, bundle y Web Vitals.

Fuera:

- reescritura de la aplicación;
- migración de datos;
- microservicios;
- multi-tenancy (ver decisión 1).

## Relación con `evolucion-arquitectura-backend`

`odd/evolucion-arquitectura-backend/` cubrió la **integridad del backend**:
concurrencia, autoridad de stock, numeración, idempotencia y retiro del handler
legacy (T01–T25, cerradas y desplegadas).

Este esfuerzo es distinto y complementario: toca **cobertura de pruebas,
trazabilidad, aislamiento, mantenibilidad y coherencia documental**, incluyendo
superficie de frontend. Por eso vive en su propia carpeta y no reabre T01–T25.

## Decisiones vigentes heredadas

Estas decisiones ya fueron tomadas y aprobadas. Este documento **no las
reabre**; las respeta y solo propone alinear el código y la documentación con
ellas.

1. **Cada comercio usa su propia instalación y base de datos.** No habrá
   `Organization`, `Tenant` ni multi-tenancy. Fuente:
   `odd/evolucion-arquitectura-backend/README.md`, decisión 1, y T02 de su
   `tasks.md`.
2. **Monolito modular**, sin microservicios.
3. **Clean Architecture** como regla de dependencias; DDD solo donde haya
   invariantes reales.
4. **`StockSucursal` es la fuente canónica de stock.**
5. **Ventas es el piloto** del patrón arquitectónico.
6. **La rama canónica es `main`.** Las ramas alternativas son legacy.

## Corrección respecto de la revisión oral

En la devolución inicial señalé la ausencia de modelo `Tenant` como un problema
de producto. **Es un falso positivo**: la decisión 1 de
`evolucion-arquitectura-backend` ya estableció el modelo de instancia dedicada,
y T02 lo confirmó. Lo que sí queda como problema real es más acotado:

- el `README.md` raíz describe el producto como "SaaS B2B" sin aclarar que la
  unidad de despliegue es una instalación por comercio;
- `Subscription` cuelga de `Usuario` (`userId @unique`), no de una cuenta, lo
  que hace que la suscripción viaje con el usuario dueño.

Ambos se tratan en `M05` y `M09`. No se propone introducir tenants.

## Baseline de análisis

- Rama: `main`
- HEAD observado: `f29298eb20c54b0ca11368ce219bd70bb8e8e386`
  (`docs(loop): record the legacy handler retirement`)
- Árbol de trabajo: limpio
- Fecha de la revisión: 2026-11-04
- El SHA identifica el punto analizado; no reemplaza el fast-forward desde
  `origin/main` antes de implementar.

## Cifras de partida

| Métrica | Valor |
| --- | --- |
| TS/TSX en `src/` | 101.118 líneas |
| `src/app/` | 70.960 líneas (70 %), 355 archivos |
| `src/lib/` | 15.158 líneas |
| `src/modules/` | 5.412 líneas (5 %) |
| API routes | 114 |
| Páginas | 47 |
| Modelos Prisma | 50 (36 migraciones) |
| Archivos `"use client"` | 185 |
| Archivos `"use server"` | 1 |
| Páginas `"use client"` | 42 de 47 (89 %) |
| Routes con Prisma directo | 93 de 114 (82 %) |
| Routes que pasan por `modules/` | 15 de 114 (13 %) |
| Routes que referencian Zod | 25 de 114 (22 %) |
| Archivos de test | 74 (17 de integración) |
| Script `npm test` | no existía en el baseline; agregado en M01 (231 tests, 0 fallos) |
| `findMany` / `select` / `include` | 113 / 183 / 159 |
| Usos de `$queryRaw` | 157 (en 31 archivos) |
| `<img>` crudos / `next/image` | 0 / 16 |
| Archivos con `force-dynamic` | 16 |
| Storefront cacheado | `unstable_cache`, `revalidate: 120` |
| Web Vitals recolectados | sí (p50/p75/p95), sin presupuesto |

## Documentos

- [Tareas](./tasks.md): backlog accionable con evidencia, criterio de
  aceptación, verificación y secuencia propuesta.

## Restricciones de ejecución

- Ninguna tarea se implementa sin autorización explícita e individual.
- No se modifican contratos HTTP observables sin una tarea que lo declare.
- No se hacen commits, push ni despliegues dentro de este esfuerzo sin
  autorización separada.
- Toda tarea que toque datos persistidos requiere su propio plan de rollback.
- La verificación de cada tarea se declara antes de empezar, no después.
