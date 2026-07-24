# Propuesta: Configuracion de zona horaria por sucursal

## Intencion

Permitir que cada sucursal del sistema configure su propia zona horaria desde el panel de Settings, de manera que todas las fechas y horas del sistema (registros en base de datos, reportes, tickets, filtros de KPIs, validacion de horarios de caja) se calculen y muestren segun el huso horario real del negocio, sin depender de la variable de entorno del servidor.

Esto habilita a operadores que tienen sucursales en distintas provincias o paises a operar correctamente sin ajustes manuales ni bugs de desfase horario.

## Alcance

### Dentro del alcance

- Agregar campo `zonaHoraria` (tipo `String`) al modelo `Configuracion` de Prisma con valor por defecto `"America/Argentina/Buenos_Aires"`.
- Crear una API de settings (`GET`/`PUT`) que exponga y persista `zonaHoraria` por sucursal.
- Exponer en `Settings > General` un selector visual de zona horaria con busqueda y deteccion automatica del huso horario del navegador del usuario.
- Adaptar `src/lib/utils-date.ts` para que `nowAR()` y todas las funciones de rango lean la zona horaria desde la configuracion de la sucursal activa, en vez de tenerla hardcodeada.
- Crear un hook `useTimezone()` en frontend que provea la zona horaria activa al cliente para formateo local.
- Asegurar que reportes, tickets, historial de ventas y KPIs del dashboard usen la zona horaria configurada al formatear fechas para el usuario.
- Proporcionar una lista curada de zonas horarias de Latinoamerica y otros paises relevantes, con soporte de busqueda por nombre.

### Dentro del alcance (agregado critico)

- **Deteccion y correccion de datos historicos**: diagnosticar automaticamente si las fechas existentes en DB fueron guardadas con offset incorrecto (UTC en vez de hora local) y ejecutar una migracion correctiva controlada para las tablas operativas clave (`Venta`, `Pago`, `Consignacion`, `Liquidacion`, `Gasto`, `SesionCaja`, `MovimientoCaja`, `MovimientoStock`).
- Crear un script de deteccion que consulte la DB, calcule el desfase real entre las fechas almacenadas y la hora del sistema al momento del registro, e informe al operador antes de ejecutar cualquier correccion.
- Proveer un endpoint de administracion `/api/admin/timezone-migration` que ejecute el UPDATE correctivo con backup transaccional y posibilidad de rollback.
- Mostrar en Settings un banner de alerta cuando se detecta que hay datos historicos con desfase horario, con accion explicita para el ADMIN.

### Fuera del alcance

- Soporte de multiples zonas horarias dentro de una misma sesion (una sucursal = una zona horaria).
- Cambio del `TZ` de proceso del servidor en caliente (eso requiere reinicio de instancia; la variable de entorno `TZ` del servidor sigue siendo el fallback para calculos server-side).
- Implementacion de DST (horario de verano) personalizado; se delega a la IANA timezone database via `Intl`.

## Enfoque

El enfoque propuesto es de **zona horaria como dato de configuracion por sucursal**, resuelto en dos planos:

1. **Backend (calculo)**: Las funciones de `utils-date.ts` (`nowAR`, `startOfDayAR`, `startOfMonthAR`, etc.) reciben opcionalmente un `tz` como parametro. Las rutas API y la logica de KPIs consultan la `zonaHoraria` guardada en `Configuracion` y la propagan a estas funciones. Se mantiene `"America/Argentina/Buenos_Aires"` como valor por defecto para no romper instalaciones existentes.

2. **Frontend (presentacion)**: Se crea un hook `useTimezone()` que lee la zona horaria de la configuracion activa (cacheada en el contexto de sucursal). Los componentes que muestran fechas usan este hook para hacer `Intl.DateTimeFormat` con el `timeZone` correcto. Los reportes y tickets generados server-side reciben la `zonaHoraria` como parametro en el payload de generacion.

La deteccion automatica del huso horario del navegador (`Intl.DateTimeFormat().resolvedOptions().timeZone`) se usa como sugerencia al usuario al abrir el selector por primera vez, pero el valor guardado en DB siempre es el definitivo.

## Areas afectadas

| Area                                                           | Impacto    | Descripcion                                                                                                                              |
| -------------------------------------------------------------- | ---------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `prisma/schema.prisma`                                         | Modificado | Nuevo campo `zonaHoraria String @default("America/Argentina/Buenos_Aires")` en modelo `Configuracion`.                                   |
| `prisma/migrations/`                                           | Nuevo      | Migracion forward-compatible con `ALTER TABLE` y valor por defecto para filas existentes.                                                |
| `src/lib/utils-date.ts`                                        | Modificado | Todas las funciones `*AR()` aceptan `tz?: string` para reemplazar el hardcode. Nuevo helper `getConfiguredTz(sucursalId)` que lee la DB. |
| `src/app/api/settings/general/route.ts`                        | Modificado | Incluir `zonaHoraria` en `GET` y `PUT` con validacion de IANA string.                                                                    |
| `src/lib/apiService.ts`                                        | Modificado | Exponer `zonaHoraria` en el contrato del cliente para que el frontend pueda leerla.                                                      |
| `src/hooks/useTimezone.ts`                                     | Nuevo      | Hook React que retorna la zona horaria activa de la sucursal y funciones de formateo locale-aware.                                       |
| `src/app/(system-guard)/(protected)/settings/general/page.tsx` | Modificado | Agregar sección "Zona Horaria" con selector, sugerencia automatica y preview de hora actual.                                             |
| `src/components/timezone-selector.tsx`                         | Nuevo      | Combobox con busqueda sobre lista curada de timezones IANA, muestra offset y hora actual como preview.                                   |
| `src/lib/timezone-list.ts`                                     | Nuevo      | Lista curada y tipada de zonas horarias Latinoamerica + internacionales mas usadas con label, offset y region.                           |
| `src/lib/kpi-logic.ts`                                         | Modificado | `getDashboardKpis`, `getDashboardTendencia` y `getDashboardTopProductos` consumen `zonaHoraria` desde config de sucursal.                |
| `src/lib/reports/template-helpers.ts`                          | Modificado | `formatDateAR()` usa `tz` dinamico pasado como parametro en vez de hardcode.                                                             |
| `src/lib/reports/base/*.ts`                                    | Modificado | Templates de tickets, remitos e inventario reciben `zonaHoraria` del payload y la pasan a `formatDateAR`.                                |
| `src/app/api/settings/pos/cajas/turno/route.ts`                | Modificado | `validarHorarioLaboral` lee `zonaHoraria` de config para comparar horas en TZ correcto.                                                  |
| `src/app/api/historial/route.ts`                               | Modificado | `monthRangeAR` recibe `tz` de la config de la sucursal del request.                                                                      |

## Riesgos

| Riesgo                                                                                              | Probabilidad | Mitigacion                                                                                                                          |
| --------------------------------------------------------------------------------------------------- | ------------ | ----------------------------------------------------------------------------------------------------------------------------------- |
| Quiebre de instalaciones existentes sin `zonaHoraria` configurada                                   | Baja         | Campo con default `"America/Argentina/Buenos_Aires"` en schema y fallback en codigo.                                                |
| IANA timezone string invalido ingresado por el usuario                                              | Baja         | Validacion contra lista curada en el selector UI + validacion en API con `Intl.DateTimeFormat` como guard.                          |
| Inconsistencia entre TZ del servidor (`.env TZ=...`) y TZ configurada en DB                         | Media        | Documentar que la config DB es la fuente de verdad para logica de negocio; el `TZ` del servidor queda como fallback para bootstrap. |
| Desfase en reportes generados si la zona horaria cambia entre una venta y la generacion del reporte | Baja         | Los reportes siempre usan la `zonaHoraria` actual de la configuracion; se recomienda no cambiarla en produccion sin aviso.          |
| Performance: query extra a `Configuracion` en cada request para leer `zonaHoraria`                  | Baja         | Cache en `getConfiguredTz()` con `unstable_cache` de Next.js (TTL 60s, tag `config`).                                               |

## Plan de Reversion (Rollback)

1. Revertir migracion de DB (`ALTER TABLE` es backward-compatible; la columna puede quedar en NULL sin afectar el sistema si se restaura el default en codigo).
2. Restaurar `utils-date.ts` a version anterior con TZ hardcodeado `"America/Argentina/Buenos_Aires"`.
3. El selector de UI puede desactivarse con un feature flag en `GeneralSettingsBody` sin impacto funcional.
4. No hay cambios destructivos en rutas criticas; el campo nuevo es aditivo.

## Dependencias

- `Intl.DateTimeFormat` nativo del runtime (Node 18+ y browsers modernos) — sin dependencias externas nuevas.
- Lista de zonas horarias IANA curada (generada estaticamente, sin paquete adicional).
- Migracion de Prisma aplicada antes del despliegue del codigo.

## Criterios de exito

- [ ] Un ADMIN puede ir a Settings > General y seleccionar cualquier zona horaria de la lista curada.
- [ ] El sistema detecta automaticamente el huso horario del navegador y lo propone como sugerencia.
- [ ] Las ventas nuevas se registran con la hora correcta segun la zona horaria configurada.
- [ ] Los KPIs del dashboard filtran "hoy" / "esta semana" / "este mes" segun la medianoche real de la sucursal.
- [ ] Los tickets y reportes muestran la hora con el offset correcto para la zona horaria de la sucursal.
- [ ] Cambiar la zona horaria de una sucursal no afecta las fechas historicas almacenadas (solo cambia la presentacion).
- [ ] El valor por defecto `"America/Argentina/Buenos_Aires"` mantiene el comportamiento existente sin cambios visibles.
