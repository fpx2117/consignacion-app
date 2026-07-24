# Diseno: Configuracion de zona horaria por sucursal

## Enfoque Tecnico

El cambio introduce `zonaHoraria` como dato de configuracion por sucursal en el modelo `Configuracion` de Prisma, y lo propaga a todas las capas del sistema que calculan o formatean fechas.

La implementacion se apoya en cuatro principios:

1. **Fuente de verdad unica**: `Configuracion.zonaHoraria` en DB es el valor canonico. Las funciones de `utils-date.ts` reciben `tz` como parametro en vez de tenerlo hardcodeado.
2. **Compatibilidad retroactiva total**: el campo tiene default `"America/Argentina/Buenos_Aires"`, lo que hace la migracion transparente para instalaciones existentes.
3. **Sin dependencias externas nuevas**: todo el manejo de timezone se hace via `Intl` nativo del runtime (Node 18+ / browsers modernos). No se agrega ningun paquete npm.
4. **Deteccion y correccion de datos historicos con offset incorrecto**: las fechas ya almacenadas en DB que fueron grabadas en UTC (por el bug donde `new Date()` del servidor en UTC se guardaba directamente) deben ser desplazadas +3 horas para reflejar la hora real de Argentina. Esto se hace con un script de migracion correctiva controlada, con deteccion previa y backup transaccional.

## Diagnostico de Datos Historicos (hallazgo critico)

Auditoria ejecutada el 2026-03-15 sobre la DB de produccion:

```
Servidor PostgreSQL: timezone = Etc/UTC
Tipo de columnas DateTime: TIMESTAMP WITHOUT TIME ZONE (todas las 56 columnas)
```

**Lo que significa**: PostgreSQL almacena los valores como numeros puros sin offset (ej: `2026-03-14 21:14:29`). Cuando Node.js enviaba `new Date()` con el proceso en UTC, ese timestamp UTC quedaba grabado textualmente sin conversion.

**Ejemplo real de la DB**:

```
Venta ID 51: fecha_en_db = 2026-03-14 21:14:29 UTC
             fecha_real_ar = 2026-03-14 18:14:29 AR  (3 horas menos)
```

**Impacto**: las fechas mostradas en tickets, reportes y KPIs aparecen 3 horas adelantadas respecto a la hora real en Argentina. Una venta hecha a las 18:14 AR figura como 21:14 en el ticket.

**Columnas a corregir** (tablas operativas con `fecha` de negocio):

| Tabla             | Columna                        | Registros | Rango                   |
| ----------------- | ------------------------------ | --------- | ----------------------- |
| `Venta`           | `fecha`, `fechaAnulacion`      | ~50       | 2026-03-02 a hoy        |
| `Pago`            | `fecha`                        | ~50       | 2026-03-02 a hoy        |
| `Consignacion`    | `fecha`                        | verificar | verificar               |
| `Liquidacion`     | `fecha`                        | verificar | verificar               |
| `Gasto`           | `fecha`                        | ~3        | 2026-03-03 a 2026-03-06 |
| `SesionCaja`      | `fechaApertura`, `fechaCierre` | verificar | verificar               |
| `MovimientoCaja`  | `fecha`                        | verificar | verificar               |
| `MovimientoStock` | `createdAt`                    | verificar | verificar               |

**Columnas que NO se corrigen** (fechas de sistema / autenticacion / expirations — son correctas en UTC):

- `UserSession.expiresAt`, `ResetPasswordToken.expiresAt`, `ShareLink.expiresAt` — son TTLs, no fechas de negocio
- `Subscription.trialEndsAt`, `currentPeriodEnd` — coordinadas con proveedores de pago en UTC
- `Usuario.createdAt`, `Cliente.createdAt` — timestamps de sistema, no de negocio visible
- `AuditLog.createdAt`, `Notification.*` — logs internos

## Decisiones de Arquitectura

### Decision: Campo `zonaHoraria` en modelo `Configuracion` (no en `Sucursal`)

**Eleccion**: agregar `zonaHoraria String @default("America/Argentina/Buenos_Aires")` al modelo `Configuracion`, que ya tiene relacion 1:1 con `Sucursal`.

**Alternativas consideradas**:

- Agregar campo directamente en modelo `Sucursal`.
- Crear tabla nueva `ZonaHorariaConfig`.

**Justificacion**: `Configuracion` ya es el repositorio de preferencias operativas por sucursal. Agregar ahi mantiene el patron existente, evita una join extra y reutiliza las rutas `/api/settings/general` ya existentes.

### Decision: Parametrizar `tz` en `utils-date.ts` en vez de leer DB en el modulo

**Eleccion**: las funciones `nowAR(tz?)`, `startOfDayAR(date?, tz?)`, etc. aceptan `tz` como parametro opcional con fallback a `"America/Argentina/Buenos_Aires"`. La lectura de la DB la hacen los callers (rutas API, kpi-logic).

**Alternativas consideradas**:

- Hacer que `utils-date.ts` importe directamente `prisma` y lea la config internamente.
- Usar una variable global/singleton para la timezone activa.

**Justificacion**: mantiene las funciones puras y testeables, evita acoplar la libreria de utilidades a Prisma, y permite que el frontend las use con la timezone del contexto de la sucursal sin importar la DB.

### Decision: `getConfiguredTz(sucursalId)` con cache de 60s

**Eleccion**: crear `src/lib/get-configured-tz.ts` que hace `prisma.configuracion.findUnique` y devuelve el string IANA. Envuelto en `unstable_cache` de Next.js con tag `"config"` y TTL 60s.

**Alternativas consideradas**:

- Leer la timezone en cada request sin cache.
- Pasar la timezone por header HTTP desde el cliente.

**Justificacion**: la timezone de una sucursal es practicamente inmutable en produccion. Un cache de 60s elimina el overhead de DB en rutas de alta frecuencia como `/api/ventas` y `/api/dashboard/kpis`.

### Decision: Lista curada estatica en `src/lib/timezone-list.ts`

**Eleccion**: lista estatica de ~80 timezones con `{ value, label, region, offset }`, con enfasis en Latinoamerica y coverage global.

**Alternativas consideradas**:

- Usar el paquete `Intl.supportedValuesOf("timeZone")` (da ~600 zonas).
- Usar el paquete `timezone-support` o `date-fns-tz`.

**Justificacion**: una lista curada de 80 zonas es mas usable que 600, no requiere nuevas dependencias y cubre el 99% de los casos reales del producto.

### Decision: Validacion IANA en la API con `Intl.DateTimeFormat` como guard

**Eleccion**: en `PUT /api/settings/general`, validar que el string recibido sea un IANA timezone valido via `Intl.DateTimeFormat(undefined, { timeZone: value })` y capturar el error si lanza `RangeError`.

**Alternativas consideradas**:

- Validar solo contra la lista curada del frontend.
- No validar en backend (confiar en el selector UI).

**Justificacion**: defensa en profundidad. La API puede ser llamada directamente; una timezone invalida en DB causaria errores en cascada en cada request.

### Decision: Migracion correctiva de datos historicos por UPDATE transaccional

**Eleccion**: corregir los timestamps incorrectos mediante `UPDATE tabla SET columna = columna + INTERVAL 'N hours'` ejecutado en una transaccion con BEGIN/COMMIT y posibilidad de ROLLBACK. El offset `N` se calcula automaticamente como la diferencia entre la TZ del servidor PostgreSQL (`Etc/UTC`) y la TZ de destino configurada (ej: `America/Argentina/Buenos_Aires` = +3 horas). El script de deteccion corre primero en modo DRY-RUN para mostrar cuantos registros afectaria.

**Alternativas consideradas**:

- Mantener los datos como estan y solo ajustar la presentacion (mostrar siempre con offset en la UI).
- Agregar una columna `fechaOriginalUTC` y calcular siempre en tiempo de lectura.
- Usar `AT TIME ZONE` en las queries Prisma en vez de corregir los datos.

**Justificacion**: los datos con `TIMESTAMP WITHOUT TIME ZONE` no son interpretables sin saber en que TZ fueron insertados. La opcion mas limpia y auditable es corregirlos una sola vez en DB para que el valor almacenado sea el "wall clock" real de Argentina, y documentar el evento. Las alternativas implicarian complejidad permanente en cada query.

**Restriccion importante**: solo se corrigen columnas de fechas de negocio visible (ventas, pagos, tickets, caja). Las columnas de sistema (expiresAt, trialEndsAt, createdAt de usuarios/sesiones/auth) se dejan en UTC porque son correctas.

**Deteccion automatica del desfase**: el script consulta `SHOW timezone` en PostgreSQL y la `zonaHoraria` configurada para calcular el offset exacto. Si el desfase es 0, no hay nada que corregir.

### Decision: Hook `useTimezone()` en frontend

**Eleccion**: hook que lee `zonaHoraria` del objeto de configuracion de sucursal (ya cacheado en el store/context de la app) y expone funciones `formatDate(d)`, `formatDateTime(d)` y el string `tz`.

**Alternativas consideradas**:

- Detectar siempre del navegador con `Intl.DateTimeFormat().resolvedOptions().timeZone`.
- Pasar `tz` como prop a cada componente.

**Justificacion**: el navegador del empleado puede estar en otra timezone que la sucursal. La timezone del negocio debe ser la configurada en DB, no la del dispositivo del empleado.

## Flujo de Datos

```text
Admin en Settings > General
  -> Selector de zona horaria (TimezoneSelector)
      -> Detecta Intl.DateTimeFormat().resolvedOptions().timeZone como sugerencia inicial
      -> Usuario elige o confirma una zona horaria de la lista curada
  -> PUT /api/settings/general { zonaHoraria: "America/Santiago" }
      -> Validacion IANA en API
      -> prisma.configuracion.upsert({ zonaHoraria })
      -> revalidateTag("config")
      -> Responde { data: configActualizada }

Request de API (ej: GET /api/dashboard/kpis)
  -> getConfiguredTz(sucursalId) [cache 60s]
      -> retorna "America/Santiago"
  -> getDashboardKpis(sucursalId, "today", tz="America/Santiago")
      -> startOfDayAR(now, "America/Santiago")
      -> query Prisma con rango correcto
      -> retorna data

Request de ticket (ej: GET /ver/ticket/[id])
  -> Lee config de sucursal -> zonaHoraria
  -> formatDateAR(venta.fecha, true, zonaHoraria)
  -> HTML con hora en timezone correcto

Frontend (componente que muestra fechas)
  -> useTimezone() -> { tz: "America/Santiago", formatDateTime }
  -> formatDateTime(venta.fecha) -> "15/03/2026 11:30"
```

## Cambios en Archivos

| Archivo                                                        | Accion    | Descripcion                                                                                                    |
| -------------------------------------------------------------- | --------- | -------------------------------------------------------------------------------------------------------------- |
| `prisma/schema.prisma`                                         | Modificar | Agregar `zonaHoraria String @default("America/Argentina/Buenos_Aires")` en modelo `Configuracion`.             |
| `prisma/migrations/*_configuracion_zona_horaria/migration.sql` | Crear     | `ALTER TABLE "Configuracion" ADD COLUMN "zonaHoraria" TEXT NOT NULL DEFAULT 'America/Argentina/Buenos_Aires'`. |
| `src/lib/utils-date.ts`                                        | Modificar | Parametrizar `tz` en todas las funciones `*AR()`. Mantener `"America/Argentina/Buenos_Aires"` como default.    |
| `src/lib/get-configured-tz.ts`                                 | Crear     | Helper server-side con `unstable_cache` que lee `Configuracion.zonaHoraria` por `sucursalId`.                  |
| `src/lib/timezone-list.ts`                                     | Crear     | Lista curada `TIMEZONE_LIST: TimezoneOption[]` con ~80 entradas (`value`, `label`, `region`, `offsetLabel`).   |
| `src/app/api/settings/general/route.ts`                        | Modificar | Agregar `zonaHoraria` a `GeneralSettingsBody`, validacion IANA y `upsert`.                                     |
| `src/lib/apiService.ts`                                        | Modificar | Exponer `zonaHoraria` en el tipo de respuesta de `getConfiguracionGeneral()`.                                  |
| `src/hooks/useTimezone.ts`                                     | Crear     | Hook `useTimezone()` que retorna `{ tz, formatDate, formatDateTime, formatDateOnly }`.                         |
| `src/components/timezone-selector.tsx`                         | Crear     | Combobox con busqueda, grupo por region, offset dinamico y preview "Hora actual: 14:32".                       |
| `src/app/(system-guard)/(protected)/settings/general/page.tsx` | Modificar | Nueva seccion "Zona Horaria" con `TimezoneSelector`, sugerencia automatica del navegador y estado de guardado. |
| `src/lib/kpi-logic.ts`                                         | Modificar | `getDashboardKpis`, `getDashboardTendencia`, `getDashboardTopProductos` consumen `tz` via `getConfiguredTz`.   |
| `src/lib/reports/template-helpers.ts`                          | Modificar | `formatDateAR(date, withTime, tz?)` — `tz` opcional con fallback.                                              |
| `src/lib/reports/base/venta-report-template.ts`                | Modificar | Recibir `zonaHoraria` en el payload del template y pasarla a `formatDateAR`.                                   |
| `src/lib/reports/base/gasto-report-template.ts`                | Modificar | Idem para comprobantes de gastos.                                                                              |
| `src/lib/reports/base/remito-template.ts`                      | Modificar | Idem para remitos de consignacion.                                                                             |
| `src/lib/reports/base/inventory-report-template.ts`            | Modificar | Idem para reportes de inventario.                                                                              |
| `src/app/api/settings/pos/cajas/turno/route.ts`                | Modificar | `validarHorarioLaboral` lee `zonaHoraria` de config via `getConfiguredTz`.                                     |
| `src/app/api/historial/route.ts`                               | Modificar | `monthRangeAR` recibe `tz` de `getConfiguredTz`.                                                               |
| `src/app/api/ventas/route.ts`                                  | Modificar | `fecha: nowAR(tz)` donde `tz` viene de `getConfiguredTz(auth.activeSucursalId)`.                               |

## Interfaces / Contratos

```ts
// src/lib/timezone-list.ts
export type TimezoneOption = {
  value: string; // IANA key, ej: "America/Santiago"
  label: string; // Nombre legible, ej: "Santiago (Chile)"
  region: string; // Grupo, ej: "Sudamerica"
  offsetLabel: string; // Calculado dinamicamente, ej: "UTC-3"
};

export const TIMEZONE_LIST: TimezoneOption[] = [
  {
    value: "America/Argentina/Buenos_Aires",
    label: "Buenos Aires (Argentina)",
    region: "Sudamerica",
    offsetLabel: "UTC-3",
  },
  {
    value: "America/Santiago",
    label: "Santiago (Chile)",
    region: "Sudamerica",
    offsetLabel: "UTC-3",
  },
  {
    value: "America/Bogota",
    label: "Bogota (Colombia)",
    region: "Sudamerica",
    offsetLabel: "UTC-5",
  },
  {
    value: "America/Lima",
    label: "Lima (Peru)",
    region: "Sudamerica",
    offsetLabel: "UTC-5",
  },
  {
    value: "America/Caracas",
    label: "Caracas (Venezuela)",
    region: "Sudamerica",
    offsetLabel: "UTC-4",
  },
  {
    value: "America/La_Paz",
    label: "La Paz (Bolivia)",
    region: "Sudamerica",
    offsetLabel: "UTC-4",
  },
  {
    value: "America/Asuncion",
    label: "Asuncion (Paraguay)",
    region: "Sudamerica",
    offsetLabel: "UTC-4",
  },
  {
    value: "America/Montevideo",
    label: "Montevideo (Uruguay)",
    region: "Sudamerica",
    offsetLabel: "UTC-3",
  },
  {
    value: "America/Sao_Paulo",
    label: "Sao Paulo (Brasil)",
    region: "Sudamerica",
    offsetLabel: "UTC-3",
  },
  {
    value: "America/Guayaquil",
    label: "Guayaquil (Ecuador)",
    region: "Sudamerica",
    offsetLabel: "UTC-5",
  },
  {
    value: "America/Mexico_City",
    label: "Ciudad de Mexico",
    region: "Centroamerica",
    offsetLabel: "UTC-6",
  },
  {
    value: "America/New_York",
    label: "Nueva York (EEUU Este)",
    region: "Norteamerica",
    offsetLabel: "UTC-5",
  },
  {
    value: "America/Chicago",
    label: "Chicago (EEUU Central)",
    region: "Norteamerica",
    offsetLabel: "UTC-6",
  },
  {
    value: "America/Los_Angeles",
    label: "Los Angeles (EEUU Oeste)",
    region: "Norteamerica",
    offsetLabel: "UTC-8",
  },
  {
    value: "Europe/Madrid",
    label: "Madrid (Espana)",
    region: "Europa",
    offsetLabel: "UTC+1",
  },
  {
    value: "UTC",
    label: "UTC (Universal)",
    region: "Universal",
    offsetLabel: "UTC+0",
  },
  // ... (~80 entradas total)
];
```

```ts
// src/lib/get-configured-tz.ts
import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";

export const getConfiguredTz = unstable_cache(
  async (sucursalId: number): Promise<string> => {
    const config = await prisma.configuracion.findUnique({
      where: { sucursalId },
      select: { zonaHoraria: true },
    });
    return config?.zonaHoraria ?? "America/Argentina/Buenos_Aires";
  },
  ["configured-tz"],
  { revalidate: 60, tags: ["config"] },
);
```

```ts
// src/lib/utils-date.ts (firma actualizada — sin cambiar implementacion interna)
export const TZ_AR = "America/Argentina/Buenos_Aires";

export function nowAR(tz = TZ_AR): Date { ... }
export function startOfDayAR(date?: Date, tz = TZ_AR): Date { ... }
export function endOfDayAR(date?: Date, tz = TZ_AR): Date { ... }
export function startOfWeekAR(date?: Date, tz = TZ_AR): Date { ... }
export function startOfMonthAR(date?: Date, tz = TZ_AR): Date { ... }
export function monthRangeAR(year: number, month: number, tz = TZ_AR): { start: Date; end: Date } { ... }
export function getDayOfWeekAR(date?: Date, tz = TZ_AR): number { ... }
export function getTimeStringAR(date?: Date, tz = TZ_AR): string { ... }
export function formatDateSafe(dateStr, opts?, tz = TZ_AR): string { ... }
export function formatDateTimeAR(dateStr, includeTime?, tz = TZ_AR): string { ... }
```

```ts
// src/hooks/useTimezone.ts
import { useConfiguracion } from "@/hooks/useConfiguracion"; // hook existente

export function useTimezone() {
  const config = useConfiguracion();
  const tz = config?.zonaHoraria ?? "America/Argentina/Buenos_Aires";

  const formatDate = (d: string | Date | null | undefined) =>
    d
      ? new Intl.DateTimeFormat("es-AR", {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
          timeZone: tz,
        }).format(new Date(d))
      : "—";

  const formatDateTime = (d: string | Date | null | undefined) =>
    d
      ? new Intl.DateTimeFormat("es-AR", {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
          timeZone: tz,
        }).format(new Date(d))
      : "—";

  const formatDateOnly = (d: string | Date | null | undefined) =>
    d
      ? new Intl.DateTimeFormat("es-AR", {
          day: "2-digit",
          month: "long",
          year: "numeric",
          timeZone: tz,
        }).format(new Date(d))
      : "—";

  return { tz, formatDate, formatDateTime, formatDateOnly };
}
```

### Contrato API (cambio aditivo)

`PUT /api/settings/general` — body aceptado (nuevo campo):

```json
{
  "zonaHoraria": "America/Santiago"
}
```

Error si IANA invalido:

```json
{ "error": "Zona horaria invalida: 'Foo/Bar' no es una timezone IANA valida." }
```

`GET /api/settings/general` — respuesta (nuevo campo):

```json
{
  "data": {
    "zonaHoraria": "America/Santiago",
    ...
  }
}
```

## Contrato: Endpoint de deteccion y correccion de datos historicos

### `GET /api/admin/timezone-migration`

Detecta el desfase entre las fechas almacenadas y la TZ configurada. Solo lectura, no modifica nada.

Respuesta:

```json
{
  "data": {
    "serverTz": "Etc/UTC",
    "configuredTz": "America/Argentina/Buenos_Aires",
    "offsetHours": 3,
    "needsMigration": true,
    "tablas": [
      {
        "tabla": "Venta",
        "columna": "fecha",
        "registros": 50,
        "sample": "2026-03-14 21:14 -> 2026-03-14 18:14"
      },
      {
        "tabla": "Pago",
        "columna": "fecha",
        "registros": 50,
        "sample": "2026-03-14 21:14 -> 2026-03-14 18:14"
      },
      {
        "tabla": "Gasto",
        "columna": "fecha",
        "registros": 3,
        "sample": "2026-03-03 00:00 -> 2026-03-02 21:00"
      },
      {
        "tabla": "SesionCaja",
        "columna": "fechaApertura",
        "registros": 5,
        "sample": "..."
      }
    ]
  }
}
```

### `POST /api/admin/timezone-migration`

Ejecuta la correccion. Requiere rol ADMIN. Acepta `dryRun: true` para simular sin commitear.

Request:

```json
{
  "dryRun": false,
  "confirmar": true,
  "offsetHours": 3
}
```

Respuesta exitosa:

```json
{
  "data": {
    "ejecutado": true,
    "dryRun": false,
    "tablas": [
      { "tabla": "Venta", "columna": "fecha", "registrosActualizados": 50 },
      { "tabla": "Pago", "columna": "fecha", "registrosActualizados": 50 }
    ],
    "totalRegistros": 163,
    "offsetHours": 3,
    "ejecutadoEn": "2026-03-15T04:30:00.000Z"
  }
}
```

### Logica de correccion (pseudoSQL)

```sql
BEGIN;

-- Venta.fecha
UPDATE "Venta" SET "fecha" = "fecha" + INTERVAL '3 hours';
-- Venta.fechaAnulacion (solo donde no es NULL)
UPDATE "Venta" SET "fechaAnulacion" = "fechaAnulacion" + INTERVAL '3 hours'
  WHERE "fechaAnulacion" IS NOT NULL;

-- Pago.fecha
UPDATE "Pago" SET "fecha" = "fecha" + INTERVAL '3 hours';

-- Consignacion.fecha
UPDATE "Consignacion" SET "fecha" = "fecha" + INTERVAL '3 hours';

-- Liquidacion.fecha
UPDATE "Liquidacion" SET "fecha" = "fecha" + INTERVAL '3 hours';

-- Gasto.fecha
UPDATE "Gasto" SET "fecha" = "fecha" + INTERVAL '3 hours';

-- SesionCaja.fechaApertura y fechaCierre
UPDATE "SesionCaja" SET "fechaApertura" = "fechaApertura" + INTERVAL '3 hours';
UPDATE "SesionCaja" SET "fechaCierre" = "fechaCierre" + INTERVAL '3 hours'
  WHERE "fechaCierre" IS NOT NULL;

-- MovimientoCaja.fecha
UPDATE "MovimientoCaja" SET "fecha" = "fecha" + INTERVAL '3 hours';

-- MovimientoStock.createdAt (historial de inventario)
UPDATE "MovimientoStock" SET "createdAt" = "createdAt" + INTERVAL '3 hours';

COMMIT;
```

> El endpoint calcula el `INTERVAL` dinamicamente a partir de `offsetHours` recibido en el body (validado contra el valor detectado en `GET`). No usa el string hardcodeado en el SQL.

## Estrategia de Pruebas

| Capa        | Que Probar                                              | Enfoque                                                                                                      |
| ----------- | ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Unitaria    | `utils-date.ts` con `tz` parametrizado                  | Verificar que `startOfDayAR(d, "America/Santiago")` retorna medianoche correcta en Santiago vs Buenos Aires. |
| Unitaria    | Validacion IANA en `PUT /api/settings/general`          | String invalido -> 400; string valido -> 200.                                                                |
| Unitaria    | `getConfiguredTz(sucursalId)`                           | Retorna default cuando no hay config; retorna valor guardado cuando existe.                                  |
| Integracion | KPIs del dashboard con timezone distinta de AR          | `startOfMonth` en "America/Mexico_City" filtra correctamente ventas del mes en esa TZ.                       |
| Integracion | `GET /api/admin/timezone-migration`                     | Detecta offset correcto y cuenta registros afectados.                                                        |
| Integracion | `POST /api/admin/timezone-migration` dryRun             | No modifica DB, retorna registros que se afectarian.                                                         |
| Integracion | `POST /api/admin/timezone-migration` real               | Modifica DB y verifica que las fechas quedaron +3h.                                                          |
| UI          | `TimezoneSelector`                                      | Muestra sugerencia del navegador; permite buscar y seleccionar; preview de hora actual se actualiza.         |
| UI          | Banner de alerta de desfase en Settings                 | Aparece cuando `needsMigration=true`; desaparece tras ejecutar correccion.                                   |
| E2E smoke   | Cambio de TZ en settings -> registro de venta -> ticket | La hora del ticket refleja la TZ configurada, no UTC.                                                        |

## Migracion / Despliegue

### Fase 0 - Migracion de schema

1. Generar y aplicar migracion Prisma con `ALTER TABLE "Configuracion" ADD COLUMN "zonaHoraria" TEXT NOT NULL DEFAULT 'America/Argentina/Buenos_Aires'`.
2. Todas las filas existentes quedan con `"America/Argentina/Buenos_Aires"` — comportamiento sin cambios visibles.

### Fase 1 - Despliegue de codigo

1. Desplegar `utils-date.ts` actualizado (backward compatible, el parametro es opcional).
2. Desplegar `getConfiguredTz`, `timezone-list.ts` y `TimezoneSelector`.
3. Desplegar UI de settings con el nuevo selector y el banner de alerta de desfase.
4. Desplegar el endpoint `/api/admin/timezone-migration`.
5. Desplegar cambios en rutas API y kpi-logic.

### Fase 2 - Correccion de datos historicos (accion manual del ADMIN)

1. El ADMIN va a Settings > General y ve el banner de alerta si hay desfase detectado.
2. Hace click en "Revisar detalle" — llama a `GET /api/admin/timezone-migration` y ve cuantos registros se corregiran con ejemplos.
3. Confirma la correccion — llama a `POST /api/admin/timezone-migration` con `dryRun: false`.
4. El sistema ejecuta el UPDATE transaccional y muestra resumen de registros corregidos.
5. El banner desaparece y los tickets/reportes ahora muestran las horas correctas.

### Fase 3 - Configuracion opcional por sucursal

1. Los admins con sucursales fuera de Argentina pueden ahora actualizar su zona horaria desde Settings.
2. No se requiere accion para sucursales que ya estan en Argentina (default).

### Observabilidad

- Log de auditoria al cambiar `zonaHoraria` con timestamp, usuario y valor anterior/nuevo.
- Si se detecta un IANA string invalido en `getConfiguredTz` (por migracion manual), loguear error y usar fallback `"America/Argentina/Buenos_Aires"`.

## Preguntas Abiertas

- [ ] Se requiere que la zona horaria sea configurable por usuario o solo por sucursal?
- [ ] Se debe notificar a otros empleados de la sucursal cuando el ADMIN cambia la zona horaria?
- [ ] Los reportes historicos deben tener la zona horaria como metadata visible en el PDF (ej: "Generado en UTC-5")?
