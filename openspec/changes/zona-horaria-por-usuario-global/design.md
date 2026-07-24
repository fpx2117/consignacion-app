# Diseno: Zona horaria por usuario global

## Enfoque Tecnico

El change `configuracion-zona-horaria` resolvio solo una parte del problema: agrego `Configuracion.zonaHoraria` por sucursal, pero dejo dos limitaciones que hoy rompen el objetivo nuevo.

1. La fuente primaria sigue siendo la sucursal, no el usuario.
2. Siguen existiendo escapes a `America/Argentina/Buenos_Aires` en utilidades, reportes, endpoints y UI.

Este diseno reemplaza esa decision como arquitectura efectiva para timezone. La configuracion por sucursal se conserva, pero pasa a ser fallback organizacional. La nueva fuente de verdad funcional sera una resolucion unica con precedencia `usuario > sucursal > fallback tecnico`.

La implementacion se apoya en cuatro lineamientos:

1. **Persistencia minima y cercana al contexto autenticado**: la preferencia por usuario vive en `Usuario`, no en una tabla nueva ni en el JWT.
2. **Resolucion unica compartida**: backend, reportes, utilidades y UI consumen un solo resolver server-side y un solo hook/helper client-side.
3. **Compatibilidad controlada**: `Configuracion.zonaHoraria` sigue vigente como segundo nivel; el fallback tecnico queda encapsulado en un solo modulo.
4. **Cierre de bypasss existentes**: se elimina el patron de leer DB directo por sucursal o de formatear con hardcodes/local timezone del navegador.

## Decisiones de Arquitectura

### Decision: Persistir la preferencia en `Usuario.zonaHoraria`

**Eleccion**: agregar `zonaHoraria String?` nullable al modelo `Usuario` en `prisma/schema.prisma`.

**Alternativas consideradas**:

- Guardarla en `Configuracion` y seguir derivando por sucursal.
- Crear una tabla nueva `UsuarioPreferencia` o `TimezonePreference`.
- Guardarla en el JWT o en localStorage.

**Justificacion**: la preferencia es personal, no organizacional. `Usuario` ya esta en el contexto autenticado, se lee en `/api/auth/me` y participa en permisos/horarios. Un campo nullable evita migraciones de datos complejas, permite distinguir "sin preferencia" de "preferencia explicita" y no introduce joins o sincronizacion extra. No se usa JWT porque quedaria stale hasta renovar sesion y abriria inconsistencias inmediatas al cambiar la timezone.

### Decision: Mantener `Configuracion.zonaHoraria` como segundo nivel, no eliminarla

**Eleccion**: conservar `Configuracion.zonaHoraria` y `timezoneMigrationDone` como configuracion de sucursal/fallback organizacional.

**Alternativas consideradas**:

- Mover todo a usuario y eliminar el campo de sucursal.
- Duplicar el valor de sucursal en todos los usuarios.

**Justificacion**: el repo ya usa `Configuracion` en `src/app/api/settings/general/route.ts`, `src/app/api/admin/timezone-migration/route.ts` y `src/lib/get-configured-tz.ts`. Ademas, la migracion historica existente esta ligada a la timezone operativa de sucursal, no a preferencias personales. Borrarla ahora agregaria riesgo innecesario y romperia compatibilidad con instalaciones que todavia no tengan preferencias por usuario cargadas.

### Decision: Resolver la timezone efectiva con un unico servicio y metadatos de origen

**Eleccion**: reconvertir `src/lib/get-configured-tz.ts` en el modulo central del dominio timezone, exportando un resolver rico y wrappers de compatibilidad minima.

**Alternativas consideradas**:

- Crear otro helper paralelo (`getEffectiveTz`) y dejar `getConfiguredTz` intacto.
- Seguir pasando `sucursalId` a todos lados y que cada caller combine logica propia.

**Justificacion**: el codigo actual ya tiene muchos consumidores de `getConfiguredTz`, pero el problema real es que el helper solo conoce sucursal y varios modulos ni siquiera lo usan. Reusar el archivo existente reduce churn de imports y deja un solo punto auditable para el fallback tecnico. El resolver debe devolver tambien `source` para detectar si el request quedo en `user`, `branch` o `fallback`.

### Decision: Precedencia estricta `usuario > sucursal > fallback tecnico`

**Eleccion**: la resolucion server-side consulta primero `Usuario.zonaHoraria`; si no existe, usa `Configuracion.zonaHoraria`; si tampoco existe o es invalida, usa una constante tecnica unica.

**Alternativas consideradas**:

- Priorizar sucursal por encima del usuario.
- Mezclar con timezone del navegador como cuarto nivel.
- Fallar la request si falta configuracion.

**Justificacion**: el objetivo del cambio pide que la timezone la decida el usuario. La timezone del navegador no es una fuente confiable de negocio y hoy puede diferir del contexto operativo real. Fallar requests productivas por datos faltantes no es aceptable durante la transicion, por eso se mantiene un fallback tecnico temporal pero encapsulado y observable.

### Decision: Los remitos de consignacion no deben inventar un usuario dueno si el modelo no lo persiste

**Eleccion**: en `src/app/ver/remito/[id]/route.ts`, el remito de `Consignacion` intentaria usar usuario del recurso solo si existiera una referencia durable y semantica en el modelo. Como hoy `Consignacion` no persiste `userId`/`usuarioId` ni otra relacion equivalente de autoria, la resolucion queda explicitamente en `sucursal > fallback tecnico`.

**Alternativas consideradas**:

- Inferir el usuario desde `Liquidacion -> Venta -> SesionCaja.usuarioId`.
- Reutilizar el usuario autenticado que genero el share link del remito.
- Agregar en este ajuste fino un nuevo campo de autoria a `Consignacion`.

**Justificacion**: las relaciones de liquidacion o del share link son operativas y posteriores al alta del remito, por lo que podrian cambiar la timezone del PDF segun eventos no relacionados con la creacion del recurso. Agregar persistencia nueva en este ajuste fino abriria migracion y churn innecesarios antes de pruebas. La opcion mas consistente con la arquitectura `usuario > sucursal > fallback tecnico` es: usar usuario cuando el recurso lo persiste de forma estable; si no, degradar limpiamente a sucursal sin heuristicas ad hoc.

### Decision: Resolver la vista global (`activeSucursalId=0`) sin volver a hardcodear sucursal `1`

**Eleccion**: cuando el contexto venga con vista global, el resolver usa primero el usuario y, si necesita fallback de sucursal, busca la sucursal principal (`Sucursal.esPrincipal = true`) o, en ultima instancia, la primera sucursal activa.

**Alternativas consideradas**:

- Seguir usando `0 ? 1 : sucursalId` como hoy en KPIs/reportes.
- Ignorar el nivel sucursal en vista global.

**Justificacion**: hoy hay varios atajos `isGlobal ? 1 : sucursalId` en `src/lib/kpi-logic.ts` y reportes PDF. Eso perpetua el supuesto de Argentina y de una sucursal principal fija con id 1. El resolver debe absorber esa complejidad para que el resto del codigo no vuelva a repetirla.

### Decision: La preferencia por usuario no dispara migracion historica de datos

**Eleccion**: el endpoint de preferencia por usuario actualiza solo `Usuario.zonaHoraria`. La correccion historica de timestamps sigue siendo una operacion exclusiva de la configuracion de sucursal en `src/app/api/admin/timezone-migration/route.ts`.

**Alternativas consideradas**:

- Ejecutar la migracion historica cada vez que un usuario cambia su timezone.
- Mover `timezoneMigrationDone` al usuario.

**Justificacion**: los datos compartidos (`Venta.fecha`, `Gasto.fecha`, `SesionCaja.fechaCierre`, etc.) pertenecen a la operacion de la sucursal, no a un usuario individual. Cambiar la preferencia personal no debe reescribir datos comunes ni competir con otros usuarios.

### Decision: Propagar la timezone resuelta a UI via endpoint de sesion/perfil y hook dedicado

**Eleccion**: extender `/api/auth/me` para exponer `zonaHoraria`, `zonaHorariaSucursal` y `zonaHorariaResuelta`, y hacer que `src/hooks/useTimezone.ts` lea esa respuesta en lugar de `/api/settings/general`.

**Alternativas consideradas**:

- Seguir leyendo `/api/settings/general` desde el hook.
- Resolver siempre desde el navegador con `Intl.DateTimeFormat().resolvedOptions().timeZone`.
- Pasar `tz` por props manualmente en todas las pantallas.

**Justificacion**: hoy `useTimezone()` consulta configuracion de sucursal, por lo que nunca podria reflejar una preferencia personal. `/api/auth/me` ya representa el contexto autenticado y es el lugar correcto para exponer el estado efectivo del usuario. Esto evita doble fetch semantico y alinea backend/UI sobre la misma fuente.

## Flujo de Datos

```text
Usuario autenticado
  -> /api/auth/me
      -> requireAuth()
      -> resolveTimezoneForAuth(auth)
          -> Usuario.zonaHoraria ?
          -> Configuracion.zonaHoraria ?
          -> FALLBACK_TZ
      -> devuelve { zonaHoraria, zonaHorariaSucursal, zonaHorariaResuelta, timezoneSource }

Pantalla UI / Hook client
  -> useTimezone()
      -> lee zonaHorariaResuelta
      -> formatDate()/formatDateTime()

Request API / PDF / job
  -> resolveTimezone(...)
      -> obtiene { tz, source }
      -> utils-date / utils-format / report helpers
      -> Prisma queries con rangos en esa tz
```

Secuencia principal para un request autenticado:

```text
Route Handler
  -> requireAuth()
  -> resolveTimezoneForAuth(auth)
      -> parse userId desde auth.user.sub
      -> leer Usuario.zonaHoraria
      -> leer Configuracion.zonaHoraria de sucursal efectiva
      -> validar IANA y decidir source
  -> usar tz en nowAR/startOfDayAR/monthRangeAR/formatDate...
  -> responder payload con timezone resuelta cuando haga falta
```

Secuencia para reportes y vistas sin sesion de UI pero con recurso persistido:

```text
PDF route
  -> cargar recurso (venta/gasto/consignacion)
  -> resolveTimezone({ userId: recurso.userId?, sucursalId: recurso.sucursalId })
  -> template helper recibe tz explicita
  -> HTML/PDF con fechas consistentes
```

## Cambios en Archivos

| Archivo                                                                | Accion    | Descripcion                                                                                                                                     |
| ---------------------------------------------------------------------- | --------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `prisma/schema.prisma`                                                 | Modificar | Agregar `Usuario.zonaHoraria String?` y mantener `Configuracion.zonaHoraria` como fallback de sucursal.                                         |
| `prisma/migrations/*_usuario_zona_horaria_global/migration.sql`        | Crear     | `ALTER TABLE "Usuario" ADD COLUMN "zonaHoraria" TEXT NULL`. Sin backfill obligatorio.                                                           |
| `src/lib/get-configured-tz.ts`                                         | Modificar | Convertirlo en resolver central con precedencia `user > branch > fallback`, validacion IANA, soporte vista global y metadatos `source`.         |
| `src/lib/utils-date.ts`                                                | Modificar | Mantener funciones puras, pero prohibir defaults distribuidos: el fallback tecnico solo puede venir del resolver central.                       |
| `src/lib/utils-format.ts`                                              | Modificar | Aceptar `tz` explicita o consumir helper comun; eliminar hardcodes actuales de Buenos Aires.                                                    |
| `src/lib/reports/template-helpers.ts`                                  | Modificar | Reemplazar default hardcodeado por constante importada desde el resolver y exigir `tz` explicita en templates nuevos.                           |
| `src/lib/pedidos-esperados.ts`                                         | Modificar | Resolver timezone efectiva por sucursal/usuario y quitar `toLocaleDateString` hardcodeado.                                                      |
| `src/lib/kpi-logic.ts`                                                 | Modificar | Reemplazar atajos `isGlobal ? 1 : sucursalId` por el resolver unico.                                                                            |
| `src/app/api/auth/me/route.ts`                                         | Modificar | Exponer timezone personal, timezone de sucursal fallback y timezone resuelta para UI.                                                           |
| `src/app/api/settings/general/route.ts`                                | Modificar | Limitar semantica a configuracion de sucursal, conservar migracion historica y dejar explicito que ya no define la timezone global del usuario. |
| `src/app/api/settings/profile/timezone/route.ts`                       | Crear     | GET/PUT para leer/guardar `Usuario.zonaHoraria` del usuario autenticado.                                                                        |
| `src/lib/apiService.ts`                                                | Modificar | Agregar metodos `getProfileTimezone()` / `updateProfileTimezone()` y tipar nuevos campos de `/api/auth/me`.                                     |
| `src/lib/types.ts`                                                     | Modificar | Extender `Usuario` y `Configuracion` con campos de timezone necesarios para UI.                                                                 |
| `src/hooks/useTimezone.ts`                                             | Modificar | Leer timezone resuelta del usuario autenticado, no de settings general por sucursal.                                                            |
| `src/app/(system-guard)/(protected)/settings/general/page.tsx`         | Modificar | Separar visualmente `Mi zona horaria` (usuario) de `Zona horaria de sucursal` (fallback admin).                                                 |
| `src/app/api/settings/pos/cajas/turno/route.ts`                        | Modificar | Validar horarios y tags de extension/cierre con la timezone resuelta del usuario logueado.                                                      |
| `src/app/api/settings/pos/cajas/cerrar/route.ts`                       | Modificar | Cerrar caja usando timezone resuelta, no solo la de sucursal.                                                                                   |
| `src/app/api/ventas/route.ts`                                          | Modificar | Crear ventas con `nowAR(tz)` obtenido del resolver, no de `getConfiguredTz(auth.activeSucursalId)` directo.                                     |
| `src/app/api/ventas/[id]/route.ts`                                     | Modificar | Anular ventas con `fechaAnulacion` en timezone resuelta y dejar de depender del default de `nowAR()`.                                           |
| `src/app/api/historial/route.ts`                                       | Modificar | Calcular rangos mensuales con timezone resuelta.                                                                                                |
| `src/app/api/historial/anios/route.ts`                                 | Modificar | Determinar el año visible via helper en timezone, no con `Date#getFullYear()` directo.                                                          |
| `src/app/api/gastos/route.ts`                                          | Modificar | Crear gastos y recurrencias con timezone resuelta del usuario.                                                                                  |
| `src/app/api/gastos/[id]/route.ts`                                     | Modificar | Editar gastos con timezone resuelta del usuario.                                                                                                |
| `src/app/ver/ticket/[id]/route.ts`                                     | Modificar | Resolver timezone efectiva sin asumir solo sucursal; propagarla al template.                                                                    |
| `src/app/ver/gasto/[id]/route.ts`                                      | Modificar | Idem comprobante de gasto.                                                                                                                      |
| `src/app/ver/remito/[id]/route.ts`                                     | Modificar | Idem remitos.                                                                                                                                   |
| `src/app/ver/inventario/[id]/pdf/route.ts`                             | Modificar | Quitar dependencia a sucursal 1 / branch-only resolver.                                                                                         |
| `src/app/ver/dashboard/[period]/pdf/route.ts`                          | Modificar | Resolver timezone para vista global sin hardcode de sucursal principal.                                                                         |
| `src/app/ver/pos/[period]/pdf/route.ts`                                | Modificar | Idem POS PDF.                                                                                                                                   |
| `src/app/ver/consig/[period]/pdf/route.ts`                             | Modificar | Idem reporte de consignaciones.                                                                                                                 |
| `src/app/(system-guard)/(protected)/gastos/components/gastos-list.tsx` | Modificar | Dejar de usar `formatDateTime()` hardcodeado y consumir `useTimezone()`.                                                                        |
| `src/app/(system-guard)/(protected)/dashboard/page.tsx`                | Modificar | Fechas de vencimiento de KPI con timezone resuelta.                                                                                             |
| `src/app/(system-guard)/(protected)/clientes/details/history-tabs.tsx` | Modificar | Fechas historicas con hook/helper comun.                                                                                                        |
| `src/app/(system-guard)/(protected)/ventas/[id]/page.tsx`              | Modificar | Eliminar helper local `formatDate()` basado en timezone del navegador.                                                                          |
| `src/app/(system-guard)/(protected)/consignaciones/[id]/page.tsx`      | Modificar | Eliminar formatter local sin timezone explicita.                                                                                                |
| `src/app/(system-guard)/(protected)/caja/historial/page.tsx`           | Modificar | Formatear aperturas/cierres con timezone resuelta.                                                                                              |

## Interfaces / Contratos

```ts
// prisma/schema.prisma
model Usuario {
  id          Int      @id @default(autoincrement())
  nombre      String
  email       String   @unique
  hash        String
  rol         RolUsuario @default(EMPLEADO)
  activo      Boolean  @default(true)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  sucursalId  Int?
  zonaHoraria String?
  // ...
}
```

```ts
// src/lib/get-configured-tz.ts
export const TECHNICAL_FALLBACK_TZ = "America/Argentina/Buenos_Aires";

export type TimezoneSource = "user" | "branch" | "fallback";

export type ResolveTimezoneInput = {
  userId?: number | null;
  sucursalId?: number | null;
};

export type ResolvedTimezone = {
  tz: string;
  source: TimezoneSource;
  userId: number | null;
  sucursalId: number | null;
};

export async function resolveTimezone(
  input: ResolveTimezoneInput,
): Promise<ResolvedTimezone>;
export async function resolveTimezoneForAuth(auth: {
  user: { sub: string };
  activeSucursalId: number;
}): Promise<ResolvedTimezone>;

// Wrapper transicional solo para compatibilidad con callers viejos.
export async function getConfiguredTz(sucursalId: number): Promise<string>;
```

```ts
// src/app/api/settings/profile/timezone/route.ts
type ProfileTimezoneResponse = {
  data: {
    zonaHoraria: string | null;
    zonaHorariaSucursal: string | null;
    zonaHorariaResuelta: string;
    timezoneSource: "user" | "branch" | "fallback";
  };
};

type UpdateProfileTimezoneBody = {
  zonaHoraria: string | null; // null = volver a heredar sucursal
};
```

```ts
// src/app/api/auth/me/route.ts
type MeResponse = {
  data: {
    id: number;
    nombre: string;
    email: string;
    rol: "ADMIN" | "EMPLEADO";
    sucursalId: number | null;
    zonaHoraria: string | null;
    zonaHorariaSucursal: string | null;
    zonaHorariaResuelta: string;
    timezoneSource: "user" | "branch" | "fallback";
    sucursalesPermitidas: Array<{
      id: number;
      nombre: string;
      esPrincipal: boolean;
      activa: boolean;
    }>;
  };
};
```

```ts
// src/hooks/useTimezone.ts
export function useTimezone() {
  return {
    tz: string;
    source: "user" | "branch" | "fallback";
    formatDate: (d: string | Date | null | undefined) => string;
    formatDateTime: (d: string | Date | null | undefined) => string;
    formatDateOnly: (d: string | Date | null | undefined) => string;
  };
}
```

Reglas operativas del contrato:

- `zonaHoraria = null` en usuario significa "heredar sucursal".
- `timezoneSource = "fallback"` solo debe aparecer cuando faltan o son invalidos ambos niveles persistidos.
- Ningun caller nuevo puede usar `America/Argentina/Buenos_Aires` inline; debe importar `TECHNICAL_FALLBACK_TZ` o, idealmente, consumir `resolveTimezone()`.

## Modulos criticos a cerrar si o si

1. **Ventas y caja**: `src/app/api/ventas/route.ts`, `src/app/api/ventas/[id]/route.ts`, `src/app/api/settings/pos/cajas/turno/route.ts`, `src/app/api/settings/pos/cajas/cerrar/route.ts`.
2. **Historial, dashboard y KPIs**: `src/app/api/historial/route.ts`, `src/app/api/historial/anios/route.ts`, `src/lib/kpi-logic.ts`, `src/app/(system-guard)/(protected)/dashboard/page.tsx`.
3. **Gastos y vencimientos**: `src/app/api/gastos/route.ts`, `src/app/api/gastos/[id]/route.ts`, `src/app/(system-guard)/(protected)/gastos/page.tsx`, `src/lib/pedidos-esperados.ts`.
4. **Reportes y comprobantes**: `src/app/ver/ticket/[id]/route.ts`, `src/app/ver/gasto/[id]/route.ts`, `src/app/ver/remito/[id]/route.ts`, `src/app/ver/inventario/[id]/pdf/route.ts`, `src/app/ver/dashboard/[period]/pdf/route.ts`, `src/app/ver/pos/[period]/pdf/route.ts`, `src/app/ver/consig/[period]/pdf/route.ts`, `src/lib/reports/template-helpers.ts`.
5. **UI con formatters locales o hardcodeados**: `src/lib/utils-format.ts`, `src/hooks/useTimezone.ts`, `src/app/(system-guard)/(protected)/ventas/[id]/page.tsx`, `src/app/(system-guard)/(protected)/consignaciones/[id]/page.tsx`, `src/app/(system-guard)/(protected)/clientes/details/history-tabs.tsx`, `src/app/(system-guard)/(protected)/caja/historial/page.tsx`, `src/app/(system-guard)/(protected)/gastos/components/gastos-list.tsx`.

Si alguno de esos modulos queda afuera, el cambio seguiria teniendo comportamientos inconsistentes aunque el schema y el endpoint nuevo esten correctos.

## Estrategia de Pruebas

| Capa        | Que Probar                                           | Enfoque                                                                                                                                       |
| ----------- | ---------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Unitaria    | `resolveTimezone()` con usuario, sucursal y fallback | Mock de Prisma: usuario con timezone propia, usuario sin timezone, config sucursal invalida, vista global.                                    |
| Unitaria    | Validacion IANA de endpoints nuevos                  | `PUT /api/settings/profile/timezone` acepta IANA valida, rechaza invalida y acepta `null`.                                                    |
| Unitaria    | `utils-date.ts` y `utils-format.ts` con tz explicita | Casos `America/Bogota`, `America/Santiago`, `Europe/Madrid` y cambio de dia/mes.                                                              |
| Unitaria    | `useTimezone()`                                      | Resuelve `zonaHorariaResuelta` desde `/api/auth/me` y deja de depender de `/api/settings/general`.                                            |
| Integracion | `/api/auth/me`                                       | Devuelve `zonaHoraria`, `zonaHorariaSucursal`, `zonaHorariaResuelta`, `timezoneSource` consistentes con DB.                                   |
| Integracion | `/api/settings/general`                              | Sigue guardando timezone de sucursal y no pisa `Usuario.zonaHoraria`.                                                                         |
| Integracion | `/api/settings/profile/timezone`                     | Actualizar a una tz propia cambia `source` a `user`; limpiar a `null` vuelve a `branch`.                                                      |
| Integracion | Ventas/gastos/caja                                   | `nowAR()` y `parseDateTimeInputAR()` reciben la timezone resuelta del usuario.                                                                |
| Integracion | Historial/KPI                                        | Rangos mensuales/anuales respetan la timezone efectiva sin usar `id=1` en vista global.                                                       |
| Integracion | Reportes PDF                                         | Ticket, gasto, remito, inventario y dashboard renderizan con la misma tz resuelta.                                                            |
| UI          | `settings/general/page.tsx`                          | Usuario comun puede editar `Mi zona horaria`; admin ademas ve fallback de sucursal y estado de migracion.                                     |
| UI          | Pantallas criticas                                   | Dashboard, gastos, detalle de venta, detalle de consignacion y historial de cliente muestran fechas coherentes tras cambiar la preferencia.   |
| E2E smoke   | Cambio de timezone personal -> navegar modulos       | Un usuario cambia a `America/Bogota` y ve el mismo desplazamiento en dashboard, gastos, ticket y caja sin tocar la configuracion de sucursal. |

## Migracion / Despliegue

### Fase 1 - Schema

1. Agregar `Usuario.zonaHoraria` nullable.
2. Regenerar cliente Prisma.
3. No hacer backfill masivo: `null` significa heredar sucursal.

### Fase 2 - Resolver y contratos

1. Desplegar el resolver unico en `src/lib/get-configured-tz.ts`.
2. Extender `/api/auth/me` y crear `/api/settings/profile/timezone`.
3. Mantener `/api/settings/general` para timezone de sucursal y migracion historica, pero dejar clara su semantica secundaria.

### Fase 3 - Consumo obligatorio

1. Migrar APIs, reportes y utilidades a `resolveTimezone()` / `resolveTimezoneForAuth()`.
2. Migrar UI a `useTimezone()` basado en la timezone resuelta del usuario.
3. Reemplazar formatter locales y hardcodes en modulos criticos.

### Fase 4 - Observabilidad del fallback tecnico

1. Loggear cuando `source === "fallback"` con `userId` y `sucursalId`.
2. Medir cuantos usuarios siguen heredando sucursal y cuantos requests aun caen al fallback tecnico.
3. Cuando el uso del fallback tecnico sea residual y no existan datos invalidos, planificar un change posterior para retirarlo.

### Consideraciones de despliegue

- No requiere downtime.
- No requiere reescribir datos historicos por usuario.
- La migracion historica existente (`timezoneMigrationDone`) se mantiene asociada a sucursal.
- El cambio es backward compatible mientras sobreviva el wrapper `getConfiguredTz(sucursalId)`.

## Fallback tecnico temporal

El fallback tecnico se mantiene solo como red de seguridad de transicion.

- Valor: `America/Argentina/Buenos_Aires`.
- Ubicacion permitida: una sola constante exportada por `src/lib/get-configured-tz.ts`.
- Uso permitido: solo cuando faltan o son invalidos `Usuario.zonaHoraria` y `Configuracion.zonaHoraria`.
- Uso prohibido: literals inline en rutas, utilidades, templates o componentes.
- Plan de salida: agregar observabilidad ahora y removerlo en un change posterior cuando la cobertura de configuracion por usuario/sucursal sea suficiente.

## Preguntas Abiertas

- [ ] Ninguna bloqueante para este diseno. La principal decision de producto ya queda fijada: la timezone efectiva la decide el usuario y la sucursal pasa a ser fallback.
