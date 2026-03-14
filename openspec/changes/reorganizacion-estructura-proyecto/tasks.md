# Tareas: Reorganizacion de estructura de carpetas del proyecto

## Alcance operativo

Este plan cubre solo reorganizacion estructural, compatibilidad temporal y validaciones. No incluye cambios de logica de negocio.

## Fase 0: Baseline e inventario de migracion

**Dependencias**: ninguna.

### Checklist atomico

- [ ] 0.1 Ejecutar baseline de calidad y registrar resultados iniciales de `npm run lint`, `npx tsc --noEmit`, `npm run build` y `npx prisma validate` en `tmp/checks/fase-0-baseline.md`.
- [ ] 0.2 Generar inventario de imports legacy bajo `src/lib/**` y clasificar por dominio en `tmp/checks/fase-0-imports-legacy.csv`.
- [ ] 0.3 Identificar modulos con naming inconsistente (incluyendo `notificationes`) y documentar mapeo viejo->nuevo en `tmp/checks/fase-0-mapeo-dominios.md`.
- [ ] 0.4 Congelar lista de rutas de App Router (`src/app/**`) a proteger durante la migracion en `tmp/checks/fase-0-app-router-manifiesto.txt`.
- [ ] 0.5 Definir lotes de migracion por dominio y orden de ejecucion en `tmp/checks/fase-0-plan-lotes.md`.

### Criterios de salida

- Baseline tecnico registrado y versionado para comparacion fase a fase.
- Inventario de imports legacy completo por dominio, sin entradas ambiguas.
- Manifiesto de `src/app/**` generado para verificar inmutabilidad.

### Validaciones

- `npm run lint`
- `npx tsc --noEmit`
- `npm run build`
- `npx prisma validate`

## Fase 1: Higiene de raiz y normalizacion de Prisma

**Dependencias**: Fase 0 completada.

### Checklist atomico

- [ ] 1.1 Crear carpeta `tmp/` (gitignored) para artefactos temporales y mover archivos operativos de raiz (`*.txt`, `*.log`) segun inventario aprobado.
- [ ] 1.2 Crear carpeta `prisma/archive/` y mover copias historicas (`schema copy.prisma`, `schema_v2.prisma`, `schema_v3.prisma`, `schema_hopper.prisma`, `seed copy.ts`) fuera de la raiz de `prisma/`.
- [ ] 1.3 Verificar que `prisma/schema.prisma` y `prisma/seed.ts` permanezcan como unicas rutas canonicas de runtime/CI en `prisma.config.ts`.
- [ ] 1.4 Agregar nota operativa en `docs/operacion/prisma-source-of-truth.md` con politica de uso de `prisma/archive/`.
- [ ] 1.5 Registrar evidencia de cambios de higiene en `tmp/checks/fase-1-higiene.md`.

### Criterios de salida

- Raiz del repositorio sin artefactos temporales no esenciales.
- Copias Prisma aisladas en `prisma/archive/` sin impacto en comandos canonicos.
- Configuracion Prisma validada contra rutas oficiales.

### Validaciones

- `npx prisma validate`
- `npm run lint`
- `npx tsc --noEmit`
- `npm run build`

## Fase 2: Creacion de estructura destino y capa de compatibilidad

**Dependencias**: Fase 1 completada.

### Checklist atomico

- [ ] 2.1 Crear estructura base `src/features/` por dominios objetivo (`dashboard`, `inventario`, `pagos`, `pedidos`, `notificaciones`).
- [ ] 2.2 Crear estructura base `src/shared/` por capacidades transversales (`auth`, `db`, `http`, `utils`, `validators`).
- [ ] 2.3 Mover modulos de bajo acoplamiento desde `src/lib/**` hacia `src/features/**` y `src/shared/**` sin cambiar logica funcional.
- [ ] 2.4 Implementar wrappers de re-export en `src/lib/**` para cada modulo migrado con marca explicita de retiro en Fase 4.
- [ ] 2.5 Corregir naming inconsistente migrando `notificationes` a `notificaciones` con wrapper temporal en la ruta legacy.
- [ ] 2.6 Ajustar aliases de transicion en `tsconfig.json` para asegurar resolucion estable durante convivencia.
- [ ] 2.7 Registrar matriz modulo->destino->wrapper en `tmp/checks/fase-2-matriz-compatibilidad.md`.

### Criterios de salida

- Estructura `src/features` y `src/shared` creada y utilizable.
- Modulos migrados con compatibilidad temporal operativa via wrappers/aliases.
- Cero cambios fisicos en `src/app/**`.

### Validaciones

- `npm run lint`
- `npx tsc --noEmit`
- `npm run build`
- Verificacion de manifiesto App Router contra `tmp/checks/fase-0-app-router-manifiesto.txt`

## Fase 3: Migracion progresiva de imports y endurecimiento de politicas

**Dependencias**: Fase 2 completada.

### Checklist atomico

- [ ] 3.1 Migrar imports del dominio `dashboard` desde rutas legacy (`src/lib/**`) a rutas destino (`src/features/**`/`src/shared/**`).
- [ ] 3.2 Migrar imports del dominio `inventario` con el mismo criterio y ejecutar validaciones del lote.
- [ ] 3.3 Migrar imports del dominio `pagos` con validaciones completas al cierre del lote.
- [ ] 3.4 Migrar imports del dominio `pedidos` con validaciones completas al cierre del lote.
- [ ] 3.5 Migrar imports del dominio `notificaciones` eliminando nuevas referencias a `notificationes`.
- [ ] 3.6 Configurar `eslint.config.mjs` con `no-restricted-imports` para bloquear nuevos imports a rutas legacy por dominio migrado.
- [ ] 3.7 Incorporar a CI la verificacion bloqueante de lint, typecheck, build y Prisma para cada PR de migracion.
- [ ] 3.8 Agregar chequeo de cero movimientos en `src/app/**` dentro de `scripts/checks/` y conectarlo al pipeline.
- [ ] 3.9 Publicar tablero de avance por dominio en `docs/arquitectura/migracion-imports-por-dominio.md`.

### Criterios de salida

- Imports activos migrados por dominio con evidencia de lote aprobado.
- Regla de lint/CI bloqueando regresion hacia rutas legacy.
- Politica de App Router inmutable validada automaticamente.

### Validaciones

- `npm run lint`
- `npx tsc --noEmit`
- `npm run build`
- `npx prisma validate`
- Ejecucion de `scripts/checks/` para politicas estructurales

## Fase 4: Retiro controlado de legacy wrappers y cierre documental

**Dependencias**: Fase 3 completada y cero referencias legacy por dominio.

### Checklist atomico

- [ ] 4.1 Ejecutar busqueda de referencias legacy en `src/**` y generar reporte de cero referencias por dominio en `tmp/checks/fase-4-cero-legacy.md`.
- [ ] 4.2 Eliminar wrappers de `src/lib/**` exclusivamente para dominios con cero referencias verificadas.
- [ ] 4.3 Retirar aliases de transicion ya obsoletos en `tsconfig.json`.
- [ ] 4.4 Endurecer reglas finales de lint para prohibir cualquier import a `src/lib/**` salvo excepciones explicitamente aprobadas.
- [ ] 4.5 Actualizar documentacion tecnica final en `docs/GUIA_TECNICA_PROYECTO.md` con estructura objetivo y politicas de ubicacion.
- [ ] 4.6 Publicar acta de cierre del cambio en `openspec/changes/reorganizacion-estructura-proyecto/closure-report.md` con evidencias de validacion.

### Criterios de salida

- Wrappers y aliases legacy retirados sin referencias residuales.
- Politicas de lint/CI en modo estricto contra rutas legacy.
- Documentacion final alineada con estructura real del repositorio.

### Validaciones

- `npm run lint`
- `npx tsc --noEmit`
- `npm run build`
- `npx prisma validate`
- Smoke de endpoints criticos (`/api/health` y rutas clave definidas por el equipo)

## Criterios de aceptacion global

- [ ] No hay movimientos fisicos en `src/app/**` durante todo el cambio.
- [ ] `prisma/schema.prisma` y `prisma/seed.ts` se mantienen como source of truth unico.
- [ ] No existen imports activos hacia rutas legacy al finalizar Fase 4.
- [ ] Todas las fases cierran con lint, typecheck, build y Prisma en verde.
- [ ] La estructura final y reglas de mantenimiento quedan documentadas en `docs/**`.
