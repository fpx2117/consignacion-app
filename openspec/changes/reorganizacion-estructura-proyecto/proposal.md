# Propuesta: Reorganizacion de estructura de carpetas del proyecto

## Intencion

Mejorar la mantenibilidad del repositorio Next.js/TypeScript separando responsabilidades por dominio, reduciendo deuda de organizacion en `src/lib`, normalizando nombres inconsistentes (ej. `notificationes`) y aislando artefactos temporales fuera de la raiz, sin alterar comportamiento funcional ni disponibilidad del sistema.

## Alcance

### Dentro del alcance
- Definir una arquitectura objetivo de carpetas para runtime y soporte (codigo, Prisma, scripts y artefactos operativos).
- Reorganizar modulos de `src/lib` por dominios y capas transversales.
- Corregir naming inconsistente de carpetas/modulos con estrategia de compatibilidad.
- Ordenar archivos temporales y duplicados tecnicos (`*.txt`, `*.log`, copias de schema/seed) sin romper build ni despliegue.
- Mantener compatibilidad de imports durante la transicion mediante aliases/re-exports.
- Incluir validaciones automatizadas para detectar imports rotos y regresiones estructurales.

### Fuera del alcance
- Cambios de logica de negocio.
- Refactors funcionales de endpoints o componentes UI.
- Cambios de modelo de datos productivo (migraciones Prisma funcionales).
- Reescritura completa de rutas App Router.

## Enfoque

Aplicar migracion incremental en fases con doble compatibilidad temporal: primero se crean destinos y capas de adaptacion, luego se migra consumo (imports) y por ultimo se retiran rutas legacy. La primera etapa prioriza cambios no riesgosos (limpieza de raiz y consolidacion de artefactos no runtime), y la ultima etapa elimina deuda residual con checks automaticos estrictos.

## Areas afectadas

| Area | Impacto | Descripcion |
|------|---------|-------------|
| `src/lib/**` | Modificado | Reubicacion por dominios y capa shared/core. |
| `src/types/**` | Modificado | Consolidacion de contratos tipados por dominio. |
| `src/app/**` | Referencial | Ajuste de imports sin mover rutas publicas/protegidas. |
| `tsconfig.json` | Modificado | Aliases de compatibilidad y rutas objetivo. |
| `eslint.config.mjs` o `eslint.json` | Modificado | Reglas para prevenir nuevos imports legacy. |
| `prisma/**` | Modificado | Aislar archivos historicos/copia fuera del source of truth. |
| raiz del repo | Modificado | Reubicar artefactos temporales a carpeta dedicada. |
| `docs/**` | Modificado | Documentar estructura final y reglas de ubicacion. |

## Riesgos

| Riesgo | Probabilidad | Mitigacion |
|--------|--------------|------------|
| Imports rotos por movimiento masivo | Alta | Fases con re-exports + aliases + `tsc --noEmit` y build en cada fase. |
| Ruptura de resolucion en App Router | Media | No mover `src/app` ni convenciones de `route.ts`, solo actualizar imports internos. |
| Confusion con Prisma en CI/CD | Media | Mantener `prisma/schema.prisma` y `prisma/seed.ts` como rutas canonicas durante toda la migracion. |
| Drift entre naming viejo y nuevo | Alta | Regla de lint `no-restricted-imports` para bloquear nuevas referencias legacy. |

## Plan de rollback

1. Mantener ramas de migracion por fase con despliegue secuencial.
2. Si falla una fase, revertir solo commits de esa fase sin tocar datos.
3. Conservar adapters/re-exports legacy hasta confirmar estabilidad en produccion.
4. Restaurar aliases previos en `tsconfig.json` en caso de error de resolucion.

## Dependencias

- Convencion final de naming (ingles tecnico consistente para carpetas compartidas).
- Pipeline CI con ejecucion de lint + typecheck + build.
- Acuerdo de equipo para ventana de limpieza final (retiro de compatibilidad legacy).

## Criterios de exito

- [ ] `npm run lint` y `npm run build` exitosos tras cada fase.
- [ ] `npx tsc --noEmit` sin errores de resolucion/import.
- [ ] No se rompen rutas de App Router ni handlers `/api/**`.
- [ ] `prisma/schema.prisma` sigue siendo el unico schema operativo para build/start.
- [ ] Carpeta raiz sin artefactos temporales no esenciales.
