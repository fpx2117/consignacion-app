# Exploración y diagnóstico

## Alcance

El análisis cubre autenticación y alcance por sucursal, stock, ventas,
consignaciones, liquidaciones, pagos, catálogo público, notificaciones,
Socket.IO, OCR, webhooks, tareas programadas y despliegue.

## Hechos confirmados

### Despliegue y autorización

- Cada comercio posee una instalación y base independientes.
- Dentro de una instalación, `ADMIN` puede operar sobre las sucursales activas y
  `EMPLEADO` queda limitado a su sucursal.
- No existe una necesidad funcional de agregar organización o tenant.
- El scoping reutilizable se concentra en `src/lib/security/sucursalScope.ts`,
  aunque no todas las rutas lo aplican de manera uniforme.

### Stock

- `StockSucursal` contiene el stock por sucursal.
- `Producto` conserva campos globales de stock por compatibilidad.
- La migración `20260322000000_trigger_sync_producto_stock` instala un trigger
  que recalcula los campos globales de `Producto` desde `StockSucursal`.
- Todavía existen flujos que escriben manualmente en ambas representaciones.

### Ventas y checkout

- La venta POS utiliza decremento condicional, transacción `Serializable`,
  reintentos y advisory lock para la numeración.
- Las ventas creadas desde liquidaciones calculan `numeroVenta` sin ese lock y
  el esquema no impone unicidad sobre `(sucursalId, numeroVenta)`.
- Las consignaciones calculan `numeroFolio` con lectura del último valor por
  cliente; el esquema sólo posee un índice no único sobre
  `(clienteId, numeroFolio)`.
- Después de crear la consignación, el movimiento de stock usa la variable local
  `nuevoFolio`, no el folio retornado por el insert. Un trigger que lo reemplace no
  es compatible con este binario sin un puente previo.
- La venta POS resuelve o crea el cliente por defecto y valida la sesión de caja
  antes de abrir la transacción reintentable.
- Un `clienteId` provisto por el request no se valida actualmente contra la
  sucursal activa.
- El checkout de Mercado Pago posee firma, lock por referencia, idempotencia y
  persistencia transaccional.
- Estos controles son activos arquitectónicos que deben preservarse, no
  reemplazarse durante la reorganización.

### Notificaciones y tiempo real

- Socket.IO verifica el JWT, pero no vuelve a validar una `UserSession` revocada.
- No existen salas por sucursal o usuario.
- El servidor utiliza emisión global, por lo que todos los sockets autenticados
  pueden recibir el mismo evento.
- `/api/notificaciones/create` permite un `fingerprint` provisto por el cliente y
  realiza un `upsert` sobre una clave global sin comprobar la sucursal del
  registro existente.

### Catálogo público

- Los endpoints legacy `/api/catalog` y `/api/catalog/categories` permiten
  consultar por sucursal sin aplicar todos los controles de publicación.
- `/api/public/lista-precios` sí valida las opciones de exposición pública.

### Migraciones y despliegue

- El script de arranque elimina una fila de `_prisma_migrations` antes de
  ejecutar `prisma migrate deploy`.
- Esa reparación automática oculta el estado real del historial y debe retirarse
  mediante una corrección separada y verificable.

### Verificación dinámica aislada de T08

El 2026-11-01 se creó una PostgreSQL 16 local y descartable. La `DATABASE_URL`
del repositorio apuntaba a Railway y no fue utilizada. Esta evidencia describe
la capacidad del historial versionado; **no confirma el estado de producción**.

- Las 29 migraciones se aplicaron desde cero con `prisma migrate deploy`; una
  consulta posterior de `prisma migrate status` informó esquema actualizado y
  `_prisma_migrations` quedó con 29 finalizadas, ninguna fallida ni revertida.
- `20260322000000_trigger_sync_producto_stock` creó el único trigger de aplicación
  de la base. `trg_sync_producto_stock` quedó habilitado (`tgenabled = O`) sobre
  `StockSucursal` para `INSERT`, `UPDATE` y `DELETE`.
- Un smoke test con dos sucursales confirmó las proyecciones globales esperadas:
  `10/2`, `17/5`, `11/4` y `4/1` para disponible/consignado después de insertar,
  insertar, actualizar y eliminar respectivamente.
- No existe todavía una tabla o capacidad persistida equivalente a
  `APP_DUAL_WRITE`/`DB_PROJECTION`; por lo tanto el esquema actual no puede
  gobernar writers mixtos.
- El borrado de la fila
  `20260523120000_add_storefront_content_to_branding` seguido de un nuevo deploy
  se reprodujo en una segunda base aislada. El deploy volvió a ejecutar la
  migración sin error porque su SQL es idempotente, pero reescribió el historial;
  esto confirma el comportamiento del workaround, no lo vuelve aceptable.

#### Matriz actual de writers de stock

| Grupo | Writers | Patrón con trigger activo | Estado |
| --- | --- | --- | --- |
| Creación inicial | `POST /api/productos`, creación desde factura | crea `Producto` y luego `StockSucursal` con el mismo valor | compatible en la prueba secuencial; redundante |
| Reconciliación | `POST /api/ventas`, `PUT /api/productos/:id`, confirmación OCR | escribe `StockSucursal` y luego reemplaza `Producto` por la suma | coincide secuencialmente; concurrencia pendiente |
| Incremental, trigger primero | anulación de venta, consignaciones, edición/cierre de consignación, Mercado Pago y confirmación de pedidos esperados | modifica `StockSucursal`; el trigger proyecta; después vuelve a incrementar o decrementar `Producto` | incompatible |
| Incremental, trigger último | creación y edición de liquidaciones | modifica primero `Producto` y después `StockSucursal`; el trigger reemplaza el global al final | coincide secuencialmente; redundante, concurrencia pendiente |
| Reparación global | `scripts/migrations/compensate-t14-stock-authority.mjs` | bloquea capacidad y tablas en orden fijo, reconcilia y exige deriva 0; la ruta `sync-stock` quedó como guarda `410` sin escrituras de stock y el script como rechazo con salida `2` | único reparador autorizado; fuerza `APP_DUAL_WRITE`, no usar con T16 activo |

La incompatibilidad incremental se reprodujo sin concurrencia: partiendo de 10
unidades, decrementar 2 en `StockSucursal` llevó la proyección a 8 y el segundo
decremento legacy dejó `Producto = 6` mientras la suma por sucursal permaneció en
8. El patrón que reemplaza el global por la suma terminó en `8 = 8`. Por lo tanto,
el riesgo estático de doble aplicación queda confirmado para los writers que
ejecutan el trigger antes del ajuste legacy. El orden inverso de liquidaciones
termina sincronizado en ejecución secuencial. Las carreras entre transacciones
siguen pendientes de T10.

### Caracterización de `POST /api/ventas` en T09

La prueba de integración ejecuta `handlePostVenta` con el cliente Prisma real
contra PostgreSQL 16 descartable. `TEST_DATABASE_URL` se acepta sólo si apunta a
loopback y el nombre de base contiene `test`; autenticación, timezone y efectos de
notificación permanecen controlados porque no son el límite bajo prueba.

La primera ejecución descubrió drift real: las 29 migraciones aplicaron sin error,
pero la base resultante no tenía `Cliente.email` y el cliente generado no podía
crear el fixture. `prisma migrate diff` mostró además tablas, columnas, enums,
índices y claves foráneas presentes en `schema.prisma` pero ausentes del historial.
Para aislar T09 de la reparación reservada a T11, sólo la base descartable se
sincronizó con `prisma db push`; ninguna migración ni base remota fue modificada.

Sobre ese esquema se verificó:

- respuesta `200` completa de Prisma, incluidos todos los escalares y nullables de
  `Venta`, `VentaDetalle`, `Cliente` y `Pago`;
- serialización y persistencia PostgreSQL de `Decimal(10,2)`: el cálculo vigente
  de tarjeta termina en `"42.99"`, los detalles en `"30.01"`/`"9.99"` y el cero
  default conserva la representación `"0"`;
- orden observado de detalles igual al de entrada con PostgreSQL real; como el
  `include` no declara `orderBy`, esta evidencia caracteriza el comportamiento
  actual pero no convierte el orden físico en garantía del motor;
- defaults `EFECTIVO`, caja nullable y numeración secuencial en una segunda venta;
- stock por sucursal, recomposición global y dos movimientos de auditoría leídos
  nuevamente desde la base después del commit;
- errores unitarios exactos para `401`, JSON malformado, `403`, `409`, stock
  post-update ausente, error inesperado y agotamiento de tres reintentos `P2034`.

Las carreras entre transacciones continúan reservadas a T10.

### Reparación del historial en T11

El diff entre una base creada con las 29 migraciones y `schema.prisma` produjo
256 líneas de SQL: dos enums, cuatro valores de `ShareLinkType`, seis tablas,
campos faltantes en trece modelos, índices y claves foráneas. La evidencia de Git
confirmó que `20260523120000_add_storefront_content_to_branding` fue editada dos
veces después de publicarse y que el workaround de arranque borraba su fila en
cada deploy.

Se agregó `20261101010000_reconcile_schema_history` sin reescribir migraciones
anteriores. Un preflight por fingerprint acepta únicamente una base vacía, el
esquema exacto de las 29 migraciones o el esquema actual exacto; los estados
parciales se rechazan. El preflight exige además las 29 aplicaciones exitosas,
rechaza nombres y checksums desconocidos y admite las tres versiones observadas
en Git de la migración histórica editada. También se retiraron el `DELETE` de
`package.json` y el script `clear-failed-migration.js`, y `npm start` dejó de
ejecutar migraciones. Una migración fallida debe tratarse con
`prisma migrate resolve`, no alterando directamente la tabla interna.

Verificación PostgreSQL 16 aislada:

- una base vacía pasó `migrate:t11:deploy`, aplicó las 30 migraciones y terminó
  con `migrate status` limpio y diff vacío;
- una base con las 29 migraciones y datos legacy multi-sucursal conservó los
  datos: la categoría sin fuente quedó en sucursal `1`, mientras que el pago se
  derivó de su sesión de caja en sucursal `2`; terminó con status y diff limpios;
- un esquema actual construido con 29 migraciones más `db push`, que contenía
  sólo la sucursal `2`, aceptó la reconciliación sin exigir sucursal `1` y
  preservó la categoría existente;
- otro esquema actual confirmó que un pago preexistente dejado por `db push` en
  la sucursal por defecto `1` se reasigna a la sucursal `2` de su sesión de caja;
- un estado parcial desconocido fue rechazado por el preflight antes del deploy;
- un pago cuyo cliente y sesión de caja pertenecían a sucursales diferentes hizo
  abortar la migración; después del fallo se comprobó que PostgreSQL no conservó
  cambios parciales, el preflight rechazó la fila fallida, `migrate resolve
  --rolled-back` permitió corregir el dato y el reintento terminó limpio;
- una copia temporal de T11 con un error agregado después de todo el DDL confirmó
  rollback completo incluso ante un fallo en la última sentencia;
- el validador de historial rechazó casos sintéticos con una migración faltante,
  un nombre extra y un checksum no reconocido, y aceptó checksums LF/CRLF sin
  modificar la tabla interna;
- un checksum histórico alterado no fue detectado por `migrate status` ni
  `migrate deploy` de Prisma 7.8.0; por eso borrar filas no reparaba checksums y
  sólo ocultaba estados fallidos.

Railway no fue consultado ni modificado. El preflight y el procedimiento para un
ambiente real están en `migration-repair.md`.

### T12-A — Inventario de numeración y puente de folio

El inventario estático encontró un único alta de `Consignacion` y cinco altas de
`Venta`:

| Writer | Estrategia actual de `numeroVenta` | Riesgo observado |
| --- | --- | --- |
| `POST /api/ventas` | `MAX + 1` por sucursal bajo advisory lock `1000000 + sucursalId`, transacción serializable y reintentos | conserva exclusión sólo con writers que participan del mismo lock |
| webhook Mercado Pago | `MAX + 1` por sucursal bajo el mismo advisory lock | compatible con POS para numeración |
| `POST /api/liquidaciones/consignacion/:consignacionId` | `MAX + 1` por sucursal sin advisory lock | compite con POS, Mercado Pago y consigo mismo |
| `POST /api/consignaciones/:id` | omite `numeroVenta` al crear la venta de liquidación | persiste `NULL` porque Prisma declara el campo opcional |
| `PUT /api/liquidaciones/:id` | omite `numeroVenta` al recrear la venta corregida | persiste `NULL` porque Prisma declara el campo opcional |

`POST /api/consignaciones` sigue calculando y enviando el candidato local porque
`numeroFolio` es requerido por Prisma. El puente cambia sólo los efectos
posteriores: las observaciones de stock toman `consignacion.numeroFolio`, es
decir, el valor retornado por persistencia. Esto permite que una autoridad futura
de PostgreSQL reemplace el candidato sin dejar observaciones inconsistentes.

La auditoría reproducible está en
`scripts/migrations/audit-numbering.mjs`. Ejecuta cuatro consultas dentro de una
transacción `REPEATABLE READ READ ONLY` y siempre hace rollback. Reporta, por
sucursal para ventas y por cliente para consignaciones: cantidad total, nulos,
máximo, grupos duplicados e IDs afectados. El ejecutable se niega a usar hosts no
locales o bases que no terminen en `test`, y exige confirmación exacta mediante
`T12_CONFIRM_DATABASE`.

La verificación sobre PostgreSQL 16 descartable usó dos sucursales y dos
clientes. Detectó correctamente una venta nula, un duplicado de venta `7` sólo
en la primera sucursal, máximos `7` y `12`, un duplicado de folio `2` sólo en el
primer cliente y máximos `2` y `5`. La base hija fue eliminada al finalizar. Una
prueba del handler ejecutó el flujo con candidato local `4` y retorno simulado de
persistencia `9`: el insert conservó `4`, mientras que observación y respuesta
usaron `9`.

### T12-B — Autoridad de numeración verificada en PostgreSQL descartable

Dos revisiones adversariales locales y dos revisiones cross-model con Codex
rechazaron el diseño inicial de índices concurrentes separados: podía dejar
triggers/numeradores activos con sólo un índice válido y exigía reconciliar
estados cruzados de catálogo e historial Prisma. Se eligió una migración atómica
durante ventana de mantenimiento: lock `Consignacion -> Venta`, preflight bajo
lock, índices únicos, numeradores, funciones y triggers en una transacción.

La migración `20261101020000_establish_numbering_authority`:

- rechaza duplicados, nullability inesperada, agotamiento de `integer` y triggers
  `BEFORE` preexistentes sobre las tablas objetivo;
- inicializa `VentaNumerador` por sucursal y `ConsignacionNumerador` por cliente;
- reemplaza siempre candidatos de insert mediante UPSERT atómico;
- impide actualizar posteriormente número o ámbito;
- usa funciones `SECURITY DEFINER` con referencias calificadas, `search_path`
  restringido y `EXECUTE` revocado a `PUBLIC`;
- crea índices únicos representables por Prisma. El índice de ventas conserva
  múltiples nulos históricos porque PostgreSQL trata los nulos como distintos.

El harness PostgreSQL 16 creó y eliminó nueve bases hijas: fresh, legacy limpia,
duplicado de venta, duplicado de consignación, agotamiento `2147483647`, dato
nulo incompatible, columna nullable inesperada, trigger incompatible y fallo
inyectado al final de la transacción. Confirmó rollback total en todos los
rechazos y en el fallo tardío.
También verificó dos ámbitos, override de candidatos, writer que omite número,
rollback/reutilización del número, ocho inserts concurrentes para ventas y ocho
para consignaciones, guards de update, un rol sintético restringido y rollback
de schema sin cambios fila por fila y columna por columna en las tablas objetivo.
La prueba no caracteriza
la topología de roles de ningún ambiente real.

Una integración real de `POST /api/consignaciones` adelantó deliberadamente el
numerador: el handler calculó candidato `1`, PostgreSQL persistió `9`, y tanto la
respuesta como `MovimientoStock.observaciones` usaron `9`. La integración real de
`POST /api/ventas` continuó verde con la autoridad activa. Las 31 migraciones
aplicaron desde cero, `migrate status` quedó limpio y `migrate diff` no detectó
diferencias.

Esto no habilita producción. El rollout real queda bloqueado hasta demostrar que
el puente T12-A está desplegado en todas las instancias, separar rol migrador de
runtime, implementar un fence operativo verificable y aprobar el presupuesto de
la ventana de mantenimiento.

### T12-C — Writers migrados detrás de un límite fail-closed

Los cinco `venta.create` de producción quedaron centralizados en
`createVentaWithAuthority`; ningún caller envía `numeroVenta`. El límite adquiere
un advisory lock compartido con migración/rollback, bloquea `Venta`, valida la
identidad exacta de trigger, función, numerador e índice, y recién entonces crea.
La corrección de liquidaciones adquiere la autoridad antes de borrar su venta
anterior para preservar el orden de locks.

Se conservaron deliberadamente los cálculos `MAX + 1`, advisory locks y retries
legacy. Un test AST recorre todo `src` y exige exactamente cinco callers más un
único `venta.create` autorizado dentro del límite. PostgreSQL verificó un insert
real con rol runtime restringido y rechazo ante grants indebidos, configuración
de función alterada, índice con clave extra, modo replica, trigger deshabilitado,
objetos ausentes y DDL concurrente. POS mantuvo su contrato HTTP y devolvió el
número persistido.

Esto completa los artefactos locales T12-C, no el despliegue. El alta de
`Consumidor Final` previa al retry del POS continúa explícitamente diferida a T20.

### Evidencia histórica de Git

- `5422e18` agregó el trigger de stock y afirmó que eliminaba la necesidad de
  dual-write manual, pero no incluyó un cambio coordinado de writers ni pruebas
  concurrentes.
- `912c7ce`, dos días después, volvió a calcular y escribir manualmente el stock
  global desde ventas. El historial confirma que trigger y proyección de
  aplicación evolucionaron sin un cutover único.
- El alcance de `numeroFolio` por cliente y el cálculo `MAX + 1` existen desde
  `3b8ea10`, el primer commit. Preservar ese alcance es compatibilidad histórica,
  no una convención inferida recientemente.
- `e6ebb0f` acumuló cambios sobre cientos de archivos y reaplicó formato en estas
  rutas; su autoría de líneas no debe interpretarse por sí sola como una decisión
  arquitectónica.

### Cálculos dispersos

- Hay implementaciones reutilizables en
  `src/lib/storefront/catalog-cart-pricing.ts` y
  `src/lib/storefront/descuento-utils.ts`.
- El cálculo `unitsEntregadas - unitsVendidasAcum - unitsDevueltasAcum` se repite
  en consignaciones, liquidaciones, dashboard y reportes.
- Recargos de consignación, interés de tarjeta, totales, margen y rentabilidad se
  calculan en varios adaptadores HTTP y componentes.
- El momento del redondeo no es uniforme: catálogo, checkout y ventas no siguen
  exactamente la misma secuencia.

## Riesgos derivados del análisis estático

Estos puntos son plausibles por el código, pero no se consideran incidentes
confirmados:

1. Si el trigger está activo, los flujos que todavía escriben en
   `StockSucursal` y `Producto` pueden aplicar dos veces un ajuste global.
2. Dos cambios concurrentes de distintas sucursales sobre el mismo producto
   pueden calcular una proyección global con snapshots incompletos; el trigger
   actual debe reproducirse antes de considerarse seguro.
3. Dos consignaciones pueden validar el mismo stock antes de decrementarlo.
4. Dos liquidaciones pueden consumir simultáneamente las mismas unidades
   pendientes.
5. Dos anulaciones pueden superar la comprobación previa y restituir stock dos
   veces.
6. La numeración creada desde liquidaciones puede competir sin el lock utilizado
   por ventas POS.
7. Dos consignaciones del mismo cliente pueden seleccionar el mismo
   `numeroFolio`.
8. Un allocator de base activado sobre el binario actual puede persistir un folio
   diferente del escrito en la observación del movimiento de stock.
9. Una venta puede asociarse a un cliente de otra sucursal si se suministra su
   identificador.
10. La sesión de caja puede cerrarse después de su validación y antes del commit;
   la creación del cliente por defecto puede persistir aunque la venta falle.
11. Dos solicitudes OCR pueden pasar una factura a `PROCESANDO` sin una transición
   condicional.
12. PayPal puede repetir efectos y notificaciones porque no hay un registro
   uniforme del identificador del evento procesado.

## T10 — Reproducciones concurrentes confirmadas

Se ejecutaron las 29 migraciones sobre PostgreSQL 16 descartable y, debido al
drift ya registrado por T09, se sincronizó **sólo esa base temporal** con
`prisma db push`. La suite usa conexiones `pg` reales, espera locks observados en
`pg_stat_activity` y reproduce el orden de sentencias de los handlers. No invoca
los endpoints HTTP: la evidencia confirma el comportamiento de PostgreSQL y de
los algoritmos SQL actuales, no autenticación, serialización HTTP ni efectos
post-commit. Producción no fue consultada ni modificada.

Resultados reproducibles:

1. **Trigger entre sucursales:** dos updates sobre filas distintas del mismo
   producto terminaron con `SUM(StockSucursal)=17` y `Producto=18`. La segunda
   ejecución esperó el lock de `Producto`, pero conservó el snapshot incompleto
   de su sentencia; el trigger perdió la actualización de la otra sucursal.
2. **Consignación:** dos transacciones observaron stock `5` y `numeroFolio=1`.
   Ambas confirmaron; quedaron dos folios `1`, stock de sucursal `-3` y stock
   global `-7`. Además del check-then-act concurrente, el dual-write
   trigger-first volvió a descontar la proyección.
3. **Liquidación:** dos transacciones observaron `5` unidades pendientes y
   vendieron `4` cada una. El acumulado terminó en `8` y el consignado de
   sucursal y producto en `-3`.
4. **Numeración:** una venta POS tomó el advisory lock y calculó `11`; una
   liquidación, que no participa de ese lock, también calculó e insertó `11`.
   La ausencia de unicidad permitió dos ventas con el mismo `numeroVenta` en la
   sucursal.
5. **Anulación:** dos solicitudes leyeron `anulada=false` antes de sus
   transacciones. Ambas restituyeron dos unidades: la sucursal pasó de `8` a
   `12`, se grabaron dos movimientos y `Producto` terminó en `14` por el
   dual-write posterior al trigger.
6. **Caja:** POS validó una sesión abierta; el cierre registró esperado `100` y
   luego la venta confirmó `50` vinculada a esa sesión ya cerrada. El esperado
   real quedó en `150`, sin revalidación ni lock compartido.

La suite está en
`src/app/api/concurrency-{stock,sales}.integration.test.ts`, con soporte en
`concurrency-baseline.integration-fixture.ts`. Estos tests caracterizan los
defectos actuales deliberadamente; T10 no los corrige.

## Reproducciones pendientes fuera de T10

Antes de elevar esos riesgos a defectos confirmados se debe ejecutar en una copia
aislada de PostgreSQL:

1. ejecutar cada endpoint real de stock con fixtures representativos; T08 y T10
   confirmaron por SQL el trigger, el patrón incremental y su carrera;
2. intentar registrar una venta con un cliente de otra sucursal;
3. solicitar dos procesamientos simultáneos de una misma factura;
4. reenviar el mismo evento PayPal y observar persistencia y notificaciones.

## Prioridad derivada

La primera corrección no debe ser mover carpetas. El orden seguro es:

1. confirmar migraciones aplicadas y autoridad de stock;
2. reproducir las carreras en una base aislada;
3. caracterizar cálculos y contratos existentes;
4. extraer dominio y casos de uso;
5. retirar código legacy cuando ya no tenga consumidores.

### T13-A — Scoping de cliente en venta POS

La reproducción HTTP contra PostgreSQL 16 confirmó el defecto: un `clienteId` de
otra sucursal era aceptado y la venta respondía `200`. El writer ahora consulta
`Cliente` por `{ id, sucursalId }` dentro de cada intento `Serializable`, antes
de tocar stock. IDs inexistentes y clientes ajenos devuelven el mismo `409` para
no revelar existencia.

La integración compara ventas, pagos, movimientos, todas las filas de
`StockSucursal` y la proyección global de `Producto` antes y después de ambos
rechazos. El flujo válido, el cliente por defecto, la numeración PostgreSQL y el
contrato exitoso permanecen sin cambios. La anulación concurrente continúa
separada para T13-B.

### T13-B — Anulación atómica de ventas

La reproducción inicial con dos handlers solapados contra PostgreSQL 16 obtuvo
`[200, 200]`: ambas solicitudes habían observado `anulada=false` y restituían el
stock. La corrección mueve el claim al inicio de la transacción mediante
`updateMany({ id, sucursalId, anulada: false })`; bajo `READ COMMITTED`, el lock
de fila y la reevaluación del predicado permiten un único ganador.

La integración fuerza que ambas transacciones alcancen un barrier antes del
claim y verifica `[200, 400]`, una sola restitución, el contrato de venta ausente
o ya anulada y el comportamiento dual-stock legacy. Un segundo caso concurrente
prueba una sola `ROTURA`, `VentaDetalle.esRotura=true` y ninguna restitución. Un
trigger descartable fuerza un fallo después de mutar stock, producto y detalle;
la transacción revierte todos esos efectos y el `500` sólo expone el mensaje
genérico. El cleanup elimina defensivamente trigger y función.

### T14-A — Capacidad persistida de autoridad de stock

La migración `20261101030000_establish_stock_authority` agrega
`StockAutoridad` con una única fila `APP_DUAL_WRITE`, sin modificar tablas de
negocio ni desactivar `trg_sync_producto_stock`. En una instalación desde cero
la capacidad queda inicialmente junto al trigger activo; esa combinación sigue
siendo incompatible y exige la compensación bajo fence antes de que algún writer
lea la capacidad (T15).

`scripts/migrations/compensate-t14-stock-authority.mjs` exige una base local
confirmada, toma `pg_advisory_xact_lock`, bloquea primero la fila de capacidad
con `FOR UPDATE` —el mismo orden que usará `B1`— y luego `StockSucursal` y
`Producto` en ese orden con `ACCESS EXCLUSIVE`, elimina el trigger, recalcula
ambas proyecciones globales desde `SUM(StockSucursal)` y confirma sólo si la
deriva es cero. Un fallo inyectado revierte trigger, capacidad y datos. Una
transacción legacy en vuelo hace fallar el lock sin cambios parciales; tras el
rollback legacy la compensación converge.

La verificación también demuestra exclusión mutua `FOR SHARE`/`FOR UPDATE` y
rechaza el estado ambiguo `DB_PROJECTION` sin trigger. `prisma migrate status`,
`migrate diff --exit-code` y el resto de la suite local permanecen limpios.

### T15-A — Puente B1 y creación de ventas

El writer POS recalculaba `Producto = SUM(StockSucursal)` dentro de su
transacción. Bajo dos ventas concurrentes en sucursales distintas del mismo
producto, cada transacción puede leer el stock de la otra como no confirmado y
escribir una suma incompleta: es un lost update, no una mera redundancia. El
puente `B1` reemplaza ese cálculo por un delta atómico cuando la capacidad es
`APP_DUAL_WRITE`.

`lockStockAuthority` bloquea la fila de capacidad con `FOR SHARE` y verifica en
la misma consulta si `trg_sync_producto_stock` está habilitado. `APP_DUAL_WRITE`
exige trigger ausente y `DB_PROJECTION` exige trigger activo; cualquier otra
combinación lanza `StockAuthorityError` antes de cualquier mutación. El handler
POS responde `503` sanitizado y no crea venta, pago, movimiento ni cambio de
stock.

La integración cubre la matriz completa, la venta bajo ambos modos, el rechazo
sin efectos y dos writers concurrentes sobre sucursales distintas con
`Producto = SUM(StockSucursal)`. La concurrencia del trigger bajo
`DB_PROJECTION` sigue fuera de alcance hasta T16. Anulación y el resto de los
writers permanecen en `L0` para etapas T15 posteriores.

PostgreSQL 16 exige privilegio `UPDATE` para adquirir cualquier row-lock,
incluido `FOR SHARE`; el rol de runtime necesita `SELECT, UPDATE` sobre
`StockAutoridad` aunque la aplicación nunca escriba esa fila. La creación del
cliente por defecto antes de la transacción sigue en T20 y no forma parte de este
gate.

### T15-B — Anulación de ventas sobre B1

La anulación ahora bloquea la capacidad antes del claim atómico. Sólo la
solicitud ganadora restituye: en `APP_DUAL_WRITE` incrementa `StockSucursal` y
aplica el mismo delta atómico a `Producto`; en `DB_PROJECTION` sólo escribe
`StockSucursal` y la proyección actualiza `Producto` una vez. Los detalles
marcados como rotura no restituyen ni modifican `Producto`.

La integración fuerza dos anulaciones concurrentes y obtiene `[200, 400]` con una
sola restitución, cubre la proyección única y un estado incompatible que devuelve
`503` sin reclamar la venta. El rollback forzado revierte claim, movimientos,
stock, `Producto` y `VentaDetalle.esRotura`; el contrato unitario verifica que el
gate precede a `venta.updateMany`.

### T15-C — Entrega de consignación sobre B1

`POST /api/consignaciones` bloquea la capacidad al inicio de la transacción y
mueve disponible a consignado en `StockSucursal`. En `APP_DUAL_WRITE` aplica el
mismo delta atómico a `Producto`; en `DB_PROJECTION` sólo escribe la
representación local y deja proyectar el trigger. El estado incompatible devuelve
`503` antes de crear la consignación.

La integración cubre ambos modos y el rechazo sin efectos. La validación previa y
la actualización no condicional de stock se preservan deliberadamente: su
endurecimiento pertenece a T21. Edición y liquidación de consignación continúan
en `L0` para T15-D.

### T15-D — Edición y liquidación de consignación sobre B1

`PUT` y `POST /api/consignaciones/[id]` bloquean la capacidad antes de leer la
consignación. El ajuste aplica el delta de entregadas a disponible/consignado; la
eliminación restituye el producto; la liquidación resta vendidas y devueltas del
consignado y suma las devueltas al disponible. En `APP_DUAL_WRITE` esos deltas se
aplican atómicamente a `Producto`; en `DB_PROJECTION` sólo se escribe
`StockSucursal`.

La integración verifica ajuste, eliminación, liquidación con creación de venta,
y rechazos `503` sin cambios ni efectos. El seam unitario confirma que el gate
precede a `consignacion.findFirst`. Las rutas de `/api/liquidaciones` siguen en
`L0`; T21 conserva las actualizaciones condicionales.

### T15-E — Rutas de liquidaciones sobre B1

`PUT /api/liquidaciones/[id]` y `POST /api/liquidaciones/consignacion/[consignacionId]`
bloquean la capacidad antes de leer. La corrección revierte los ítems anteriores
y aplica los nuevos; la nueva liquidación descuenta consignado y suma devueltas
al disponible. En ambos casos se actualiza primero `StockSucursal` y luego el
delta global mediante `applyProductoGlobalDelta`, preservando los valores
globales usados por los movimientos.

La integración cubre corrección en ambos modos (incluido reverso + aplicación),
nueva liquidación bajo proyección y rechazos `503` sin efectos. Los seams
unitarios prueban que el gate precede a la lectura. Productos, OCR, pedidos,
checkout y `sync-stock` permanecen en `L0`.

### T15-F — Productos sobre B1

`POST /api/productos` bloquea la capacidad antes de crear el producto y su stock.
`PUT /api/productos/[id]` actualiza primero `StockSucursal` y aplica únicamente el
delta entre el stock nuevo y el previo a `Producto`; además excluye
`stockDisponibleUnits` del update directo para evitar doble aplicación. En
`DB_PROJECTION` no escribe `Producto` y deja proyectar el trigger.

La integración cubre creación y ajuste en ambos modos, movimientos con
`stockPrevio`/`stockPosterior` y rechazos `503` sin cambios. Los seams unitarios
confirman que el gate precede a `producto.create` y a la lectura de stock.
Creación desde factura/OCR, pedidos, checkout y `sync-stock` siguen en `L0`.

### T15-G — OCR/facturas sobre B1

`aplicarMovimientoStock` bloquea la capacidad, incrementa `StockSucursal`
atómicamente y aplica el delta de la cantidad a `Producto`; en `DB_PROJECTION`
deja proyectar el trigger. `create-product` gatea antes de crear producto/stock,
y `confirm`/`confirm-all` mapean `StockAuthorityError` a `503`.

La integración cubre ambos modos, dos aplicaciones concurrentes y el rechazo sin
mutaciones; el test estático verifica que el gate precede a `producto.create` en
`create-product`. Pedidos, checkout y `sync-stock` permanecen en `L0`.

### T15-H — Pedidos esperados y checkout sobre B1

`incrementBranchStock` y `decrementBranchStock` encapsulan las transiciones
atómicas de `StockSucursal` y el delta global. La confirmación de pedidos gatea la
capacidad al inicio de la transacción y usa el incremento; el webhook de Mercado
Pago gatea al inicio, decrementa condicionalmente y devuelve `503` reintentable.

La integración cubre ambos modos, decremento insuficiente y concurrencia; los
tests de wiring confirman el orden de los gates y el mapeo `503`.

El webhook dejó de exigir `Producto >= units` porque bajo `DB_PROJECTION` el
trigger ya aplicó el delta y un segundo ajuste duplicaría. `StockSucursal` es
canónico y la deriva de `Producto` pertenece a T14. La doble confirmación
concurrente de un pedido es preexistente y queda fuera de T15-H.

### T15-I — Retiro de `sync-stock`

`POST /api/admin/sync-stock` y `scripts/sync-stock.ts` recalculaban
`Producto = SUM(StockSucursal)` sin transacción, sin locks y sin leer la
capacidad; podían pisar un delta en vuelo y, bajo `DB_PROJECTION`, competir con
el trigger. Ninguno tenía caller en la aplicación.

La ruta conserva autenticación y `ADMIN`, no importa Prisma y responde `410` con
el comando de compensación; el script no abre conexión y sale con `2`. La
reparación autorizada es `compensate-t14-stock-authority.mjs`, que bloquea
capacidad y tablas en orden fijo, reconcilia y exige deriva 0. Esa compensación
fuerza `APP_DUAL_WRITE` y retira el trigger: no debe correrse con T16 activo.

Un test de inventario recorre los archivos de producción de `src/` y `scripts/`,
y falla si un `producto.update|updateMany|upsert` escribe los campos globales de
stock fuera de `stock-authority.ts`, si el módulo de autoridad asigna valores
absolutos en lugar de deltas, si un spread o un `data:` indirecto no permite
probar la exclusión del stock, o si un `.mjs` fuera de la tooling T14 escribe
esos campos por SQL crudo. Con esto no quedan herramientas `L0` de stock: los
únicos escritores crudos son la compensación y su verificador de T14, declarados
y acotados.

### T17-A — Núcleo aritmético de ventas

Antes de extraer, la aritmética de `POST /api/ventas` era: descuento manual si
existe, si no el de catálogo por unidad por unidades; `subtotal = precio *
unidades - descuento`; `totalVenta` acumulado en orden; descuento global restado
del acumulado; recargo de tarjeta sobre el neto sólo con `TARJETA` y tasa
positiva; `total = acumulado - global + recargo`. Nada se redondeaba.

`src/modules/ventas/sale-totals.ts` reproduce exactamente esa secuencia en cuatro
funciones puras y la ruta las usa. La equivalencia no se afirma: se compara contra
la transcripción literal del código anterior con `Object.is` en 480 casos de línea
y 375 de totales, se fijan escenarios con valores exactamente representables y se
verifica el `Decimal` persistido en PostgreSQL 16 con el carrito de integración.

El adaptador sigue resolviendo el descuento de catálogo con
`calcularDescuentoEfectivo` (que depende de `new Date()`), por lo que el dominio
recibe el monto ya resuelto y se mantiene puro.

**Hallazgo registrado, no corregido:** `Venta.total` en POS ya tiene restado
`descuentoGlobal`, pero `kpi-logic.ts:542`, `dashboard/[period]/pdf/route.ts:214`
y `pos/[period]/pdf/route.ts:381` se lo restan de nuevo. Subestima el neto en
exactamente el descuento global. Cambiarlo altera cifras visibles y necesita
aprobación separada.

### T17-B — Consignaciones y recargo

`applyConsignmentMarkup` (carrito, alta y edición de consignación, precio
sugerido de la liquidación, totales al editar) y
`calculatePendingUnits`/`validateSettlement` (validación de liquidación, cierre
automático, dashboard, PDF y UI) reemplazan once expresiones repetidas en nueve
archivos, más ocho del recargo en siete. La validación ahora devuelve un
resultado explícito en lugar de una resta con un `if` en cada ruta; el contrato
observable no cambia (`EXCEDE_PENDIENTE:<detalleId>` → `409`).

La prueba del recargo es un diferencial real contra la expresión anterior; la de
pendientes fija la definición, incluidos los negativos, pero no puede ser un
oráculo independiente porque la resta es la definición. El respaldo fuerte son
las cinco suites de integración y un test de inventario que falla si cualquiera
de las fórmulas reaparece inline (multilínea incluida).

### T17-C — Ganancia, margen y transición de stock

`calculateLineProfit`, `calculateGrossProfit` y `calculateMarginPercentage` viven
en `src/modules/finance/profit.ts`. La ganancia bruta mantiene el orden histórico:
acumula diferencias por línea y resta el descuento global al final, que en coma
flotante no es equivalente a restarlo por línea. El margen no redondea; el
`Math.round` queda en la plantilla del reporte, donde es una decisión de
presentación.

`calculateStockTransition(post, delta)` documenta y centraliza la relación entre
el post-image persistido y el `stockPrevio` del movimiento: la usan las dos
transiciones de sucursal y la aplicación de stock de OCR. Un estado inconsistente
sigue mostrándose, no se recorta.

Diferenciales por `Object.is` (24 combinaciones de línea, 24 de carrito, bordes de
base 0/negativa y de coma flotante) y las suites de integración de stock y OCR
verdes. Con esto quedan extraídas las diez funciones puras del diseño.

## Auditoría de cierre previa a T17-B

Se re-ejecutó todo lo ejecutable sin producción sobre PostgreSQL 16 descartable
(`audit17_test`, 32 migraciones aplicadas).

| Bloque | Resultado |
| --- | --- |
| Unidades `src/modules/**` (8 archivos, 22 tests) | verde |
| Rutas sin base (11 archivos) | verde |
| Integración T11–T15 (12 de 14 archivos) | verde |
| `concurrency-sales.integration.test.ts` | **falla** en la primera aserción |
| `concurrency-stock.integration.test.ts` | 1 caso verde, 2 **cuelgan** |
| `tsc --noEmit` | verde |

Interpretación: los dos archivos de concurrencia son **reproducciones pre-fix**
de T10. T12 agregó el índice único de folio y el asignador, así que el escenario
"dos consignaciones con el mismo folio" ya no puede completarse: el segundo
`INSERT` espera al primero dentro de su transacción y el test nunca termina. No es
un defecto del producto, es un artefacto de verificación vencido que nadie
ejecuta porque no hay script `test`.

No se re-ejecutaron los verificadores `.mjs` de T11/T12/T14
(`verify-t11-repair.mjs`, `verify-t12-numbering-authority.mjs`,
`verify-t14-stock-authority.mjs`): provisionan sus propias bases y ya corrieron en
sus unidades; su equivalente de integración sí quedó verde acá.

Pendiente real antes de T17-B: T16 (cutover productivo, sin autorización), el
deploy de los writers T15 y el commit del cuerpo T11–T17, que hoy sigue sin
persistir en Git.

**Cierre de los artefactos (T10-R y tooling).** Los dos archivos de concurrencia
se retiraron y se reemplazaron por `concurrency-invariants.integration.test.ts`:
asignación concurrente de folios sin colisión, folio del cliente ignorado por la
autoridad e inmutable una vez asignado, y anulación única con reclamo
condicional. Las dos caracterizaciones cuyo defecto sigue vivo quedan como
`test.skip` con su unidad responsable (T20 caja, T21 liquidaciones), así que la
suite ya no cuelga ni miente. Además se retiró el visual guard: su baseline exacto
y el tope de 300 líneas costaban más de lo que aportaban, y los tokens de diseño
siguen verificados por `src/theme/know-design-system.test.ts`.

**Lint, causa raíz.** Los "2630 errores" no eran del código: 2625 estaban en
`_scratch/.next-broken-fresh-build/`, un build viejo que ESLint recorría porque
`_scratch` no estaba ignorado. Se agregó `_scratch/**` a `globalIgnores` y quedaron
5 errores reales, todos corregidos: en `ventas/nueva/page.tsx` dos `useMemo` se
leían antes de declararse (`subcategoryQtyMap`, `montoDescuentoGlobal`) y el
React Compiler por eso tampoco podía preservar la memoización; se movió el bloque
de derivados antes de `handleCobrar`. En `store-footer.tsx` se cambió el `<a>` a
`<Link>`. `npx eslint` termina en **0 errores y 1 warning**.
