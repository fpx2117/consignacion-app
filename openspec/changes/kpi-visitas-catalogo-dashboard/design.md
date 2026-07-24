# Diseno: KPI visitas de catalogo en dashboard y reporte PDF

## Enfoque tecnico

La app ya tiene un punto unico de entrada de datos del catalogo publico: `GET /api/public/lista-precios`. Ese endpoint es el mejor lugar para contabilizar visitas porque:

1. Se ejecuta al abrir `/lista`.
2. Tiene contexto de sucursal (`sucursalId`) y request headers.
3. Evita agregar requests extras desde el cliente.

Se implementa un modelo de eventos de visita deduplicados por ventana temporal para obtener dos metricas de negocio:

- `visitas`: total deduplicado de entradas al catalogo en el periodo.
- `visitantesUnicos`: total de visitantes aproximados en el periodo.

Estas metricas se integran al pipeline existente:

`kpi-logic -> /api/dashboard/kpi -> dashboard/page.tsx` y `ver/dashboard/[period]/pdf -> dashboard-report-template`.

## Validacion de factibilidad

**Resultado**: SI, es factible con bajo riesgo.

Motivos:

- Existe endpoint publico estable donde registrar la visita sin cambiar UX.
- El dashboard ya centraliza calculos en `src/lib/kpi-logic.ts`, por lo que agregar una nueva dimension es directo.
- El reporte PDF de dashboard ya recibe `DashboardReportData` tipado y renderiza bloques KPI; se puede extender con un bloque adicional sin romper layout actual.

## Decisiones de arquitectura

### Decision: tracking server-side en `lista-precios`

**Eleccion**: contar visita dentro de `src/app/api/public/lista-precios/route.ts`.

**Alternativas consideradas**:

- Endpoint dedicado llamado desde frontend (`/api/public/catalog-visits`).
- Tracking externo (GA4).

**Justificacion**: menor acoplamiento, menos requests, y persistencia propia de datos para KPIs internos.

### Decision: deduplicacion por ventana de 30 minutos

**Eleccion**: generar `visitorHash` (ip + user-agent normalizado + sucursal + bucket temporal) y guardar un solo evento por bucket.

**Alternativas consideradas**:

- Contar cada request sin dedupe.
- Dedupe diaria estricta.

**Justificacion**: reduce inflacion por refresh sin perder sensibilidad de trafico real en periodos cortos.

### Decision: mantener enfoque catalogo-only (sin conversion)

**Eleccion**: exponer solo `visitas` y `visitantesUnicos` en esta fase.

**Alternativas consideradas**:

- Calcular conversion a venta/cobro en esta etapa.

**Justificacion**: el canal publico hoy se usa como catalogo y no como checkout activo; mostrar conversion podria inducir interpretaciones incorrectas.

### Decision: KPI en `Estado Operativo`

**Eleccion**: mostrar `Visitas Catalogo` como tarjeta operativa, no financiera.

**Alternativas consideradas**:

- Colocarlo en `Rentabilidad`.
- Colocarlo en un modulo separado.

**Justificacion**: es una metrica de actividad del canal, previa a ventas; encaja mejor con operacion que con resultado economico.

### Decision: OKR PDF en nueva subseccion `Canal Digital`

**Eleccion**: agregar bloque debajo de `Rentabilidad` en `dashboard-report-template`.

**Alternativas consideradas**:

- Insertar dentro de `Stock`.
- Mezclarlo en la fila actual de rentabilidad.

**Justificacion**: mantiene lectura ejecutiva: resultado economico arriba, actividad digital del catalogo inmediatamente despues.

## Flujo de datos

```text
Usuario abre /lista?sucursalId=...
  -> GET /api/public/lista-precios
      -> calcula visitorHash con bucket de 30m
      -> create visit (si no existe hash en bucket)
      -> responde productos/config

Dashboard protegido
  -> GET /api/dashboard/kpi?period=...
      -> getDashboardKpis(...)
      -> agrega catalogo.visitas + catalogo.visitantesUnicos
      -> UI muestra KPI en Estado Operativo

Reporte PDF
  -> GET /ver/dashboard/[period]/pdf
      -> consulta visitas del periodo
      -> buildDashboardReportHtml(...) con seccion Canal Digital
      -> PDF con OKR visible
```

## Cambios en archivos

| Archivo                                                 | Accion    | Descripcion                                                  |
| ------------------------------------------------------- | --------- | ------------------------------------------------------------ |
| `prisma/schema.prisma`                                  | Modificar | Nuevo modelo `CatalogVisit` y relacion en `Sucursal`.        |
| `prisma/migrations/*_catalog_visits/migration.sql`      | Crear     | Migracion no destructiva para tabla e indices.               |
| `src/lib/analytics/catalog-visit.ts`                    | Crear     | Utilidades: fingerprint, bucket, registro deduplicado.       |
| `src/app/api/public/lista-precios/route.ts`             | Modificar | Invocar registro de visita sin bloquear respuesta principal. |
| `src/lib/kpi-logic.ts`                                  | Modificar | Consultas de visitas por periodo y visitantes unicos.        |
| `src/app/api/dashboard/kpi/route.ts`                    | Modificar | Exponer bloque `catalogo` en payload.                        |
| `src/lib/types.ts`                                      | Modificar | Definir tipo `DashboardKpis.catalogo`.                       |
| `src/app/(system-guard)/(protected)/dashboard/page.tsx` | Modificar | Agregar tarjeta `Visitas Catalogo` en `operativeKpis`.       |
| `src/app/ver/dashboard/[period]/pdf/route.ts`           | Modificar | Incluir metricas de visitas en `DashboardReportData`.        |
| `src/lib/reports/base/dashboard-report-template.ts`     | Modificar | Render de subseccion `Canal Digital` y KPI de OKR.           |

## Interfaces / contratos

```ts
// prisma/schema.prisma
model CatalogVisit {
  id          Int      @id @default(autoincrement())
  sucursalId  Int
  visitorHash String
  bucketStart DateTime
  visitedAt   DateTime @default(now())
  source      String   @default("public_lista")
  sucursal    Sucursal @relation(fields: [sucursalId], references: [id], onDelete: Cascade)

  @@unique([sucursalId, visitorHash, bucketStart])
  @@index([sucursalId, visitedAt])
}

// src/lib/types.ts
type DashboardKpis = {
  // ...campos existentes
  catalogo: {
    visitas: number;
    visitantesUnicos: number;
  };
};
```

## Estrategia de pruebas

| Capa         | Que probar                                                  | Enfoque                                                              |
| ------------ | ----------------------------------------------------------- | -------------------------------------------------------------------- |
| API publica  | `lista-precios` registra visita deduplicada por bucket      | Integracion con DB de test, doble request misma ventana = 1 registro |
| KPI logic    | Conteo por periodo `today/week/month/all`                   | Unit/integracion de `getDashboardKpis`                               |
| Dashboard UI | Render de tarjeta `Visitas Catalogo` y valor correcto       | Testing Library con mock de API                                      |
| PDF          | Seccion `Canal Digital` visible con metricas y sin overflow | Test snapshot HTML + smoke de ruta PDF                               |

## Migracion y despliegue

1. Agregar modelo `CatalogVisit` en schema Prisma.
2. Generar migracion no destructiva.
3. Deploy backend (registro y KPI).
4. Deploy frontend (tarjeta dashboard + template PDF).
5. Verificar que KPI aparezca en UI y PDF para `today` y `month`.

Rollback seguro: desactivar render de KPI y detener registro en endpoint publico; la tabla nueva puede quedar sin impacto funcional.

## Preguntas abiertas

- [x] Dedupe confirmado en ventana de 30 minutos.
- [x] Alcance confirmado como catalogo-only para esta fase.
