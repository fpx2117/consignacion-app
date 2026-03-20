# Diseño: Fix Discrepancias Dashboard UI vs PDF

## Enfoque Técnico

Corrección puntual en 2 archivos para que el PDF use la misma fuente de datos y el mismo período que el Dashboard UI. Sin cambios en la lógica de negocio (`kpi-logic.ts`), sin migraciones, sin dependencias nuevas.

La estrategia es: **el PDF debe comportarse como un "espejo" del Dashboard UI**, usando los mismos datos crudos de `getDashboardKpis()` y los mismos campos.

## Decisiones de Arquitectura

### Decisión 1: Eliminar la conversión `all → month`

**Elección**: Pasar `period` directamente a `getDashboardKpis()` sin transformar `"all"` en `"month"`

**Alternativas consideradas**:
- Mantener la conversión y agregar un `if` para manejar "all" con query separada → Rechazado: duplica lógica que ya existe en `kpi-logic.ts`
- Crear una función `getDashboardKpisForReport()` separada → Rechazado: crea dos fuentes de verdad

**Justificación**: `getDashboardKpis()` ya maneja correctamente `"all"` — cuando no recibe `start`, no aplica filtro de fecha (línea 64 de kpi-logic.ts). La conversión a "month" fue un error original que rompe el contrato.

### Decisión 2: Mantener la tabla de gastos con Prisma directo

**Elección**: Conservar las consultas separadas de gastos para la tabla de detalle, pero sincronizar el total con `kpis.gastos.total`

**Alternativas consideradas**:
- Eliminar la tabla de detalle y usar solo `kpis.gastos` → Rechazado: la tabla tiene el desglose por concepto/categoría que el usuario necesita
- Recalcular el total sumando la tabla → Rechazado: la tabla usa Prisma directo (sin cache) y puede divergir de `kpis.gastos.total`

**Justificación**: La tabla de detalle es necesaria para el reporte. El riesgo de desincronización (ventana de 60s por cache) es aceptable y se documenta.

### Decisión 3: Añadir KPIs faltantes sin romper el tipo existente

**Elección**: Añadir campos opcionales a `DashboardReportData` con valores por defecto para backward compatibility

**Alternativas consideradas**:
- Crear un nuevo tipo `DashboardReportDataV2` → Rechazado: innecesario para 2 campos nuevos
- Modificar el template sin cambiar el tipo (hardcodear) → Rechazado: los datos deben venir del server action

**Justificación**: Los campos nuevos son opcionales (`catalogoProductosVisibles?: number`, `saldoGlobal?: number`), el template los usa con fallback a 0.

## Flujo de Datos

```
                    ACTUAL (con bug)                    DESEADO (corregido)
                    ────────────────                    ──────────────────

  [User] → PDF     period="all"                        period="all"
              ↓          ↓                                  ↓
         kpiPeriod = "month" ✗                    kpiPeriod = "all" ✓
              ↓                                       ↓
     getDashboardKpis(kpiPeriod)             getDashboardKpis(period)
              ↓                                       ↓
     datos del MES ACTUAL                    datos HISTÓRICOS completos
              ↓                                       ↓
     reportData { ... }                      reportData { ... + nuevos KPIs }
              ↓                                       ↓
     buildDashboardReportHtml()              buildDashboardReportHtml()
              ↓                                       ↓
           PDF generado                        PDF generado
              ↓                                       ↓
     ≠ Dashboard UI ✓                       == Dashboard UI ✓
```

## Cambios en Archivos

### Archivo 1: `src/app/ver/dashboard/[period]/pdf/route.ts`

| Línea | Cambio | Detalle |
|-------|--------|---------|
| 93 | **Eliminar** | `const kpiPeriod = period === "all" ? "month" : period;` |
| 101 | **Modificar** | Cambiar `kpiPeriod` → `period` en la llamada a `getDashboardKpis` |
| 222-243 | **Añadir** | Nuevos campos en `reportData`: `catalogoProductosVisibles`, `saldoGlobal` |

Cambios específicos en el mapeo `reportData`:

```ts
// ANTES (línea 93-101)
const kpiPeriod = period === "all" ? "month" : period;
const kpis = await getDashboardKpis(scopedSucursalId, kpiPeriod, isGlobal, userId ?? undefined);

// DESPUÉS
const kpis = await getDashboardKpis(scopedSucursalId, period, isGlobal, userId ?? undefined);
```

```ts
// ANTES (línea 222-243)
const reportData: DashboardReportData = {
    // ... campos existentes ...
};

// DESPUÉS
const reportData: DashboardReportData = {
    // ... campos existentes ...
    catalogoProductosVisibles: kpis.catalogo?.productosVisibles ?? 0,
    saldoGlobal: kpis.finanzas.saldoClientesTotal ?? 0,
};
```

### Archivo 2: `src/lib/reports/base/dashboard-report-template.ts`

| Cambio | Detalle |
|--------|---------|
| **Tipo** `DashboardReportData` | Añadir `catalogoProductosVisibles?: number` y `saldoGlobal?: number` |
| **HTML** Sección "Canal Digital" | Añadir tarjeta "En Catálogo" |
| **HTML** Nueva sección | Añadir sección "Finanzas Adicionales" con "Saldo Global" |
| **HTML** Título "Ingresos en Caja" | Renombrar a "Movimiento Total" para coincidir con UI |

Cambios al tipo:

```ts
export type DashboardReportData = {
    // ... campos existentes ...
    catalogoProductosVisibles?: number;  // NUEVO
    saldoGlobal?: number;                // NUEVO
};
```

Cambios al HTML (sección Canal Digital):

```html
<!-- ANTES -->
<div class="kpi-row">
    ${kpiBox("Visitas de Catalogo", ...)}
    ${kpiBox("Visitantes Unicos", ...)}
</div>

<!-- DESPUÉS -->
<div class="kpi-row">
    ${kpiBox("Visitas de Catalogo", ...)}
    ${kpiBox("Visitantes Unicos", ...)}
    ${kpiBox("En Catalogo", fmtN(data.catalogoProductosVisibles ?? 0) + " prod.", ...)}
</div>
```

Nueva sección después de "Consignaciones":

```html
${sectionTitle("Finanzas Adicionales", color)}
<div class="kpi-row">
    ${kpiBox("Saldo Global", fmt(data.saldoGlobal ?? 0), REPORT_COLORS.danger, "Deuda acumulada en clientes")}
</div>
```

## Interfaces / Contratos

### Tipo modificado: `DashboardReportData`

```ts
export type DashboardReportData = {
    period: string;
    periodLabel: string;
    fechaGeneracion: string;
    gananciaBruta: number;
    gananciaConsignacion: number;
    gananciaDirecta: number;
    gastos: number;
    utilidadNeta: number;
    ingresosCaja: number;
    cantidadVentas: number;
    cantidadPagos: number;
    catalogoVisitas: number;
    catalogoVisitantesUnicos: number;
    catalogoProductosVisibles?: number;  // ← NUEVO (opcional)
    saldoGlobal?: number;                // ← NUEVO (opcional)
    stockDisponible: number;
    stockConsignado: number;
    consignacionesAbiertas: number;
    consignacionesCerradas: number;
    unitsPendientes: number;
    tendencia: { date: string; ventasTotal: number; pagosTotal: number }[];
    gastosDetalle: { motivo: string; categoria: string; monto: number; fecha: string; esCompartido: boolean }[];
};
```

## Estrategia de Pruebas

| Capa | Qué Probar | Enfoque |
|------|------------|---------|
| **Manual** | Período "all" genera datos históricos correctos | Comparar PDF generado vs Dashboard UI para cada período |
| **Manual** | KPIs financieros coinciden (Bruta, Neta, Gastos, Pagos) | Comparar valores numéricos exactos |
| **Manual** | KPIs operativos coinciden (Stock, Consignaciones, Pendientes) | Comparar valores numéricos exactos |
| **Manual** | KPIs nuevos aparecen (En Catálogo, Saldo Global) | Verificar presencia en PDF |
| **Manual** | Tabla de gastos tiene detalle correcto | Comparar filas con base de datos |

**Nota:** No existe infraestructura de testing automatizado para PDFs. La verificación es manual comparando el Dashboard UI con el PDF generado.

## Migración / Despliegue

No requiere migración. Los cambios son backward-compatible:
- Los campos nuevos en `DashboardReportData` son opcionales
- El template usa fallback a 0 si no se proveen
- No hay cambios en base de datos
- No hay feature flags necesarios

## Preguntas Abiertas

- [x] ~~¿La conversión `all → month` tiene algún motivo legítimo?~~ → **No.** El comentario en el código dice "garantiza consistencia exacta con el Dashboard UI" pero la implementación hace lo contrario. Es un bug.
- [ ] ¿Queremos renombrar "Ingresos en Caja" a "Movimiento Total" en el PDF? (Diferencia cosmética, el valor es el mismo)
