# Propuesta: KPI de visitas de catalogo en dashboard y PDF

## Intencion

Necesitamos medir el trafico del catalogo publico (`/lista`) para tener un OKR operativo visible en el dashboard y en su reporte PDF. Hoy la experiencia publica funciona principalmente como catalogo (sin uso activo de checkout), por lo que el foco debe estar en actividad del canal y no en conversion a venta/cobro.

## Alcance

### Dentro del alcance

- Registrar visitas del catalogo publico por sucursal y fecha.
- Exponer metricas de visitas en `/api/dashboard/kpi` con filtro por periodo (`today`, `week`, `month`, `all`).
- Mostrar KPI en `dashboard/page.tsx` en la seccion `Estado Operativo`.
- Incorporar el OKR en el PDF de dashboard (`/ver/dashboard/[period]/pdf`) con ubicacion definida y consistente.
- Definir criterio de deduplicacion para evitar inflar visitas por refresh.

### Fuera del alcance

- Integracion con herramientas externas (GA4, Meta Pixel, etc.).
- Embudo completo de marketing (fuente, campana, UTM avanzada).
- Dashboards nuevos fuera del dashboard actual.

## Enfoque

Implementar tracking server-side en `GET /api/public/lista-precios` para contar visitas sin depender de scripts externos. Guardar eventos deduplicados por ventana temporal de 30 minutos por visitante en una tabla dedicada y consumirlos desde la logica de KPI y reporte PDF.

Ubicacion recomendada del KPI:

- Dashboard UI: `Estado Operativo`, junto a indicadores de actividad.
- PDF Dashboard: nueva subseccion `Canal Digital` inmediatamente despues de `Rentabilidad`, mostrando `Visitas de Catalogo` y `Visitantes Unicos`.

## Areas afectadas

| Area                                                    | Impacto    | Descripcion                                                      |
| ------------------------------------------------------- | ---------- | ---------------------------------------------------------------- |
| `prisma/schema.prisma`                                  | Modificado | Nuevo modelo para visitas de catalogo y relacion con `Sucursal`. |
| `src/app/api/public/lista-precios/route.ts`             | Modificado | Registro de visitas deduplicadas al cargar el catalogo publico.  |
| `src/lib/kpi-logic.ts`                                  | Modificado | Agregado de metricas de visitas por periodo para dashboard.      |
| `src/app/api/dashboard/kpi/route.ts`                    | Modificado | Exponer bloque `catalogo` en payload de KPIs.                    |
| `src/lib/types.ts`                                      | Modificado | Tipado de nuevas metricas de visitas catalogo-only.              |
| `src/app/(system-guard)/(protected)/dashboard/page.tsx` | Modificado | Render del KPI en `Estado Operativo`.                            |
| `src/app/ver/dashboard/[period]/pdf/route.ts`           | Modificado | Incluir visitas catalogo-only en `DashboardReportData`.          |
| `src/lib/reports/base/dashboard-report-template.ts`     | Modificado | Ubicacion visual del OKR en PDF.                                 |

## Riesgos

| Riesgo                                             | Probabilidad | Mitigacion                                                                                |
| -------------------------------------------------- | ------------ | ----------------------------------------------------------------------------------------- |
| Sobreconteo por recargas o bots                    | Media        | Deduplicacion por visitante+ventana temporal y exclusion basica de user-agent sospechoso. |
| Costo de consultas por periodo en tabla de eventos | Media        | Indices por `sucursalId` y `visitedAt`; opcion de agregado diario en fase futura.         |
| Diferencia entre visitas y usuarios reales         | Alta         | Declarar metrica como aproximada y complementar con `visitantesUnicos` estimados.         |

## Plan de rollback

1. Ocultar KPI en UI y PDF con feature flag temporal o condicion defensiva.
2. Dejar de registrar visitas en `lista-precios`.
3. Revertir migracion del modelo de visitas si se requiere rollback total.

## Dependencias

- Migracion Prisma para nuevo modelo.
- Acceso a headers de request (`user-agent`, `x-forwarded-for`) en entorno deploy.

## Criterios de exito

- [ ] El endpoint publico registra visitas sin degradar el tiempo de respuesta de catalogo.
- [ ] Dashboard muestra `Visitas de Catalogo` filtradas por periodo de forma consistente.
- [ ] El PDF de dashboard incluye el OKR en una ubicacion estable y legible.
- [ ] Las metricas `Visitas de Catalogo` y `Visitantes Unicos` son visibles y coherentes con los datos del periodo.
- [ ] Validacion tecnica completada: implementacion viable sin cambios estructurales mayores.
