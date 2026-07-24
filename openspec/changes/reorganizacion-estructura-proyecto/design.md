# Diseno: Reorganizacion de estructura de carpetas sin impacto funcional

## Enfoque tecnico

La base actual confirma tres focos de deuda estructural:

1. Raiz con artefactos operativos temporales (`build_output.txt`, `check_out.txt`, `checklist_output.txt`, `status.txt`, `prisma_error.log`).
2. `prisma/` con archivos copia/historicos (`schema copy.prisma`, `schema_v2.prisma`, `schema_v3.prisma`, `schema_hopper.prisma`, `seed copy.ts`) que compiten visualmente con el source of truth (`schema.prisma`, `seed.ts`).
3. `src/lib/` concentrando utilidades, dominio, integraciones y seguridad en un unico nivel, mas naming inconsistente (`notificationes`).

La estrategia es una migracion estructural en fases con compatibilidad temporal, sin tocar reglas de negocio. Se preserva App Router (`src/app/**`) y contratos publicos (`/api/**`), mientras se mueve la implementacion interna con adapters y aliases para evitar downtime.

## Validacion de factibilidad

**Resultado**: SI, factible con riesgo controlable.

Motivos:

- El proyecto ya usa alias `@/* -> src/*`, lo que permite redirigir imports gradualmente.
- Los scripts de calidad disponibles (`lint`, `build`) y typecheck via `tsc --noEmit` permiten validar roturas de resolucion.
- Prisma ya esta configurado explicitamente a `prisma/schema.prisma` y `prisma/seed.ts` (`prisma.config.ts`), habilitando limpieza de copias sin impacto de runtime.

## Arquitectura objetivo de carpetas

```text
.
├── docs/
│   ├── arquitectura/
│   └── operacion/
├── prisma/
│   ├── migrations/
│   ├── schema.prisma
│   ├── seed.ts
│   └── archive/                # historicos no runtime
├── scripts/
│   ├── checks/
│   └── maintenance/
├── tmp/                        # artefactos temporales locales (gitignored)
├── src/
│   ├── app/                    # App Router (se mantiene estable)
│   ├── components/
│   ├── features/               # logica por dominio
│   │   ├── dashboard/
│   │   ├── inventario/
│   │   ├── pagos/
│   │   ├── pedidos/
│   │   └── notificaciones/
│   ├── shared/                 # cross-cutting reutilizable
│   │   ├── auth/
│   │   ├── db/
│   │   ├── http/
│   │   ├── utils/
│   │   └── validators/
│   ├── providers/
│   ├── store/
│   └── types/
└── openspec/
```

Nota de compatibilidad: `src/lib/` no se elimina en fase inicial; queda como capa legacy de re-export hasta completar la migracion de imports.

## Decisiones de arquitectura

### Decision: Mantener `src/app` sin movimientos fisicos

**Eleccion**: conservar ubicaciones de rutas, layouts, route handlers y route groups actuales (`src/app/**`).
**Alternativas consideradas**: mover rutas a una nueva raiz o reestructurar route groups en paralelo.
**Justificacion**: minimizar riesgo operacional; en Next.js App Router la ubicacion de archivos es contrato de runtime.

### Decision: Migrar logica interna a `src/features` + `src/shared`

**Eleccion**: separar codigo de dominio (`features`) de servicios transversales (`shared`) y dejar `src/lib` como capa de compatibilidad temporal.
**Alternativas consideradas**: mantener `src/lib` y solo renombrar archivos puntuales.
**Justificacion**: reduce acoplamiento, mejora discoverability y permite reglas de import por capa.

### Decision: Renombrar `notificationes` a `notificaciones` con adapter temporal

**Eleccion**: crear nuevo path canonico (`src/features/notificaciones` o `src/shared/notificaciones`) y mantener wrapper en `src/lib/notificationes/*` durante transicion.
**Alternativas consideradas**: tolerar typo historico o corregirlo de una sola vez sin puente.
**Justificacion**: evita rotura masiva de imports en una sola release y habilita retiro ordenado.

### Decision: Prisma con source of truth fijo y archivo historico aislado

**Eleccion**: mantener `prisma/schema.prisma` y `prisma/seed.ts` como entradas unicas de runtime; mover copias a `prisma/archive/`.
**Alternativas consideradas**: dejar copias en raiz de `prisma/` con naming ambiguo.
**Justificacion**: reduce errores de operacion y confusiones en onboarding/CI.

### Decision: Compatibilidad por doble via (re-export + aliases)

**Eleccion**: durante migracion, preservar rutas viejas con archivos puente y ajustar aliases gradualmente en `tsconfig.json`.
**Alternativas consideradas**: migracion big-bang con reemplazo total de imports en un solo commit.
**Justificacion**: permite rollback fino por fase y evita downtime por errores de resolucion.

## Flujo de migracion por fases (sin downtime)

```text
Fase 0 (baseline)
  -> inventario de imports + snapshot de build/lint/typecheck

Fase 1 (higiene no runtime)
  -> mover artefactos temporales raiz a tmp/ (gitignored)
  -> mover copias Prisma a prisma/archive/

Fase 2 (estructura destino)
  -> crear src/features y src/shared
  -> mover modulos internos de bajo acoplamiento
  -> dejar wrappers en src/lib

Fase 3 (migracion de consumo)
  -> actualizar imports por lotes (dominio por dominio)
  -> endurecer lint para bloquear nuevos imports legacy

Fase 4 (cierre)
  -> retirar wrappers legacy sin referencias
  -> actualizar documentacion tecnica
```

## Criterios de compatibilidad

### Imports y aliases

- Mantener `@/*` operativo en toda la migracion.
- Introducir aliases de transicion solo si son necesarios y con fecha de retiro documentada.
- Prohibir nuevos imports a rutas legacy una vez migrado cada dominio.

### App Router

- No mover ni renombrar rutas en `src/app/**` durante reorganizacion estructural.
- Cualquier cambio en imports internos de pages/layouts/route handlers debe ser transparente para URL final.

### APIs

- Mantener rutas y metodos HTTP existentes en `src/app/api/**/route.ts`.
- Reorganizacion solo interna (mover helpers/servicios), sin cambiar payloads ni codigos de estado.

### Prisma

- Mantener `prisma.config.ts` apuntando a `prisma/schema.prisma` y seed canonico.
- No cambiar ruta de migraciones (`prisma/migrations/**`).
- Archivar copias historicas fuera del path principal para evitar uso accidental.

## Cambios en archivos

| Archivo                                                           | Accion                          | Descripcion                                          |
| ----------------------------------------------------------------- | ------------------------------- | ---------------------------------------------------- |
| `openspec/changes/reorganizacion-estructura-proyecto/proposal.md` | Crear                           | Propuesta base del cambio y alcance.                 |
| `openspec/changes/reorganizacion-estructura-proyecto/design.md`   | Crear                           | Diseno tecnico con fases, compatibilidad y rollback. |
| `tsconfig.json`                                                   | Modificar (fase implementacion) | Ajuste de aliases y rutas de transicion.             |
| `eslint.config.mjs`                                               | Modificar (fase implementacion) | Reglas para evitar imports legacy y ciclos de capa.  |
| `prisma/`                                                         | Modificar (fase implementacion) | Reubicar archivos historicos a `prisma/archive/`.    |
| `src/lib/**`                                                      | Modificar (fase implementacion) | Wrappers de compatibilidad y deprecacion progresiva. |
| `src/features/**`                                                 | Crear (fase implementacion)     | Nueva capa de dominio por vertical.                  |
| `src/shared/**`                                                   | Crear (fase implementacion)     | Capas transversales reutilizables.                   |
| `docs/GUIA_TECNICA_PROYECTO.md`                                   | Modificar (fase implementacion) | Actualizar source of truth de estructura final.      |

## Interfaces / contratos

No se introducen contratos funcionales nuevos de API o DB en este cambio; se mantienen interfaces existentes.

Se define contrato de compatibilidad de imports durante migracion:

```ts
// Ejemplo de wrapper temporal
// src/lib/notificationes/notificaciones-types.ts
export * from "@/features/notificaciones/notificaciones-types";

// Regla: wrapper con ventana de retiro definida
// TODO (fase 4): eliminar cuando no haya referencias legacy.
```

## Estrategia de validaciones automaticas

| Capa       | Que validar                                      | Comando sugerido                                   |
| ---------- | ------------------------------------------------ | -------------------------------------------------- |
| Lint       | Convenciones, imports legacy y errores estaticos | `npm run lint`                                     |
| Tipado     | Imports rotos y resolucion TS                    | `npx tsc --noEmit`                                 |
| Build Next | Rutas App Router, handlers y bundling            | `npm run build`                                    |
| Prisma     | Integridad de source of truth                    | `npx prisma validate`                              |
| Smoke API  | Endpoints criticos siguen respondiendo           | script de checks sobre `/api/health` + rutas clave |

Si no existe suite de tests automatizados en `package.json`, se recomienda incluir en fase de implementacion un script minimo de smoke estructural en `scripts/checks/`.

## Migracion / despliegue

1. Desplegar Fase 1 (higiene no runtime) sin impacto de servicio.
2. Desplegar Fase 2 con wrappers activos (compatibilidad total).
3. Desplegar Fase 3 por lotes pequenos de imports + validaciones completas por lote.
4. Monitorear errores de modulo no encontrado y tiempos de build.
5. Ejecutar Fase 4 solo cuando `grep`/typecheck confirme cero referencias legacy.

Rollback:

- Revertir ultimo lote desplegado (fase acotada).
- Mantener wrappers y aliases previos hasta recuperar estabilidad.
- No requiere rollback de datos (sin cambios de esquema productivo).

## Riesgos y mitigaciones

| Riesgo                               | Impacto | Mitigacion                                                                |
| ------------------------------------ | ------- | ------------------------------------------------------------------------- |
| Error de import en runtime           | Alto    | Migracion por lotes + wrappers + typecheck previo a merge.                |
| Cambio accidental de path App Router | Alto    | Politica: `src/app` inmovil durante este cambio.                          |
| Confusion en comandos Prisma         | Medio   | Documentar explicitamente schema/seed canonicos y validar en CI.          |
| Deuda legacy permanente              | Medio   | Fecha de retiro obligatoria para cada wrapper + regla de lint bloqueante. |

## Plan de rollback

1. Revertir commit de la fase actual.
2. Restaurar aliases/wrappers del lote previo estable.
3. Re-ejecutar `npm run lint`, `npx tsc --noEmit` y `npm run build` antes de redeploy.
4. Abrir incidente tecnico con lista de imports afectados y ajuste de lote.

## Preguntas abiertas

- [ ] Confirmar convencion final de nombres (espanol vs ingles) para carpetas de dominio en `src/features`.
- [ ] Definir ventana maxima de convivencia de wrappers legacy (ej. 2 releases).
- [ ] Definir si `src/types` migra completo a `src/shared/types` o se mantiene como carpeta raiz de tipos.
