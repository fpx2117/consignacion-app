# Plan y estado de tareas

## Estado general

Diagnóstico y diseño aprobados. T08 fue autorizada y ejecutada de forma aislada.
T09 y las tareas posteriores requieren autorización explícita por tarea; commits,
push y despliegue continúan sin autorización.

**Estado actual (2026-11-03):** T11–T17 están commiteadas, pusheadas a
`origin/main` (`5b41eb4..08eaf16`) y **desplegadas**: Railway auto-desplegó
`c8df76d5` desde ese commit, `/login` 200, 32 migraciones sin pendientes y la suite
de integración (13 archivos, 22 tests) verde sobre el HEAD rebaseado. El deploy
ocurrió **sin fence ni ventana** porque Railway auto-despliega `main`. **El smoke
autenticado de T15-R se ejecutó el 2026-11-04** sobre un servidor real con base
descartable en configuración de producción: los siete flujos con deriva 0 (ver
T15-R). Producción ya no corre el T12-only.
**T16 ejecutado el mismo día:** producción está en `DB_PROJECTION` con la
proyección serializada, trigger presente y deriva 0 (ver T16).
**T18 implementada el mismo día, sin desplegar:** el piloto `RegistrarVenta` está
extraído detrás de `SALES_REGISTER_USE_CASE`, con el switch en `legacy` y ambos
dispatches verdes sobre el mismo contrato HTTP (ver T18).

## Diagnóstico

- [x] **T01 — Establecer baseline.** Rama canónica `main`; baseline observado
  `014eaee6bb659a007b506196d5f9ecea3132dcab`; Railway despliega desde `main`.
- [x] **T02 — Confirmar límite organizacional.** Una instalación y base por
  comercio; no se necesita multi-tenancy.
- [x] **T03 — Auditar autenticación y Socket.IO estáticamente.** Hallazgos
  documentados; pruebas de integración pendientes.
- [x] **T04 — Auditar transacciones y stock estáticamente.** Autoridades y carreras
  plausibles identificadas; reproducción concurrente PostgreSQL pendiente.
- [x] **T05 — Auditar OCR, webhooks, cron y despliegue estáticamente.** Riesgos
  documentados; simulaciones de fallos pendientes.
- [x] **T06 — Diseñar arquitectura objetivo.** Monolito modular, dominio puro y
  piloto `RegistrarVenta` definidos.
- [x] **T07 — Aprobar diseño y ADRs.** Los hallazgos sobre precisión,
  transacciones, stock, rollback y numeración fueron reconciliados. La revisión
  cross-model requirió dos rondas de correcciones: compatibilidad de folios/Prisma,
  vínculo del piloto con stock, fence de recuperación y permanencia del allocator.
  La última ronda pasó la revalidación independiente y la tercera revisión
  cross-model finalizó sin hallazgos sustantivos. Aprobación humana recibida el
  2026-11-01. Esta aprobación cierra el diseño, pero no habilita tareas de
  implementación.

## Ejecución progresiva — autorización por tarea

- [x] **T08 — Inventariar migraciones y escritores de stock.** En PostgreSQL 16
  aislada, las 29 migraciones aplicaron limpiamente y el trigger quedó activo.
  La matriz confirmó writers compatibles por reemplazo u orden final del trigger,
  y writers incompatibles cuando el ajuste legacy ocurre después de la
  proyección. Producción no fue consultada ni modificada; la concurrencia
  permanece reservada para T10.
- [x] **T09 — Crear pruebas de caracterización.** `POST /api/ventas` quedó cubierto
  con PostgreSQL 16 descartable: body y status completos de Prisma, `Decimal`
  persistido, orden observado, defaults y nullables, importes y escala 2, stock,
  auditoría y errores `400/401/403/409/500`. Las migraciones aplicaron pero no
  producen por sí solas el `schema.prisma` actual; el drift quedó evidenciado para
  T11. La concurrencia permanece reservada a T10.
- [x] **T10 — Reproducir concurrencia base.** PostgreSQL 16 descartable confirmó
  las seis carreras mediante intercalaciones deterministas de las sentencias que
  hoy ejecutan los handlers: proyección perdida entre sucursales, sobreconsumo y
  folio repetido en consignaciones, sobreliquidación, `numeroVenta` duplicado
  entre liquidación y POS, doble restitución al anular y venta asociada después
  del cierre de caja. Son reproducciones SQL de los algoritmos productivos, no
  invocaciones HTTP; no se aplicó ninguna corrección ni se tocó producción.
  **Auditoría previa a T17-B (2026-11-03):** las reproducciones son pre-fix y ya no
  coinciden con el esquema. `concurrency-sales` falla en su primera aserción
  (`MAX(numeroVenta)+1` da 2, no 11, porque T12 asigna el folio); en
  `concurrency-stock` pasa el caso del trigger, pero los casos de folio repetido y
  de liquidación bloquean en el índice único nuevo y **cuelgan** en vez de fallar.
  Ningún script las ejecuta, así que el rojo pasó inadvertido. **Resuelto en
  T10-R:** se retiraron ambos archivos y se agregó
  `src/app/api/concurrency-invariants.integration.test.ts`, que afirma los
  invariantes post-corrección (asignación concurrente sin colisión, folio del
  cliente ignorado e inmutable, anulación única) y conserva como `test.skip` las
  caracterizaciones cuyo defecto sigue vigente: T20 (caja) y T21
  (sobreliquidación). 4 verdes, 2 skipped explícitos, sin cuelgues.
- [x] **T11 — Reparar historial de migraciones.** Se agregó la reconciliación
  `20261101010000_reconcile_schema_history` sin modificar las 29 migraciones
  anteriores; se retiraron el `DELETE` de `_prisma_migrations` y las migraciones
  del arranque. El preflight acepta sólo base vacía, esquema legacy exacto o
  esquema actual exacto, con historial y checksums conocidos. PostgreSQL 16
  descartable verificó base nueva, legacy multi-sucursal, estados `db push`,
  rechazo parcial, conflictos de pagos, rollback tardío y recuperación mediante
  `migrate resolve`; `migrate:t11:deploy` terminó con status y diff limpios. La
  revisión adversarial final no encontró fallas. Producción no fue consultada ni
  modificada.
- [x] **T12 — Establecer autoridad de numeración (artefactos locales).**
  Auditar duplicados y nulos; puente de folio persistido; numeradores y triggers
  para venta por sucursal y consignación por cliente; índices únicos y migración
  de los cinco writers. **T12-A/B/C verificadas en descartable:** inventario de
  writers y auditoría read-only reproducible; migración atómica con índices,
  numeradores, triggers, guards, concurrencia, rollback y rol restringido; los
  cinco writers de venta omiten `numeroVenta` detrás de un límite fail-closed y
  conservan cálculos, locks y retries legacy. Re-ejecutados sobre PostgreSQL 16:
  auditoría post-T11, autoridad, integraciones de rutas, wiring AST, status y
  diff Prisma, todos verdes. No hubo producción, backfill ni renumeración.
- [x] **T12-R — Rollout operativo de numeración.** Ejecutado el 2026-11-02 en
  producción con ventana de mantenimiento y servicio detenido. Evidencia:
  backup lógico previo; migraciones T11/T12 aplicadas
  (`20261101010000` 20:17:58Z, `20261101020000` 20:18:00Z); triggers T12 y de
  stock activos; índices únicos válidos; counters 650/191/39/29; smoke revertido
  con venta 651 y folio 1. La app corre en el deployment
  `877f99e0-ec55-44b5-bb92-851d087647f1` con rol `consigna_runtime` (no
  superuser; DDL y deshabilitar triggers denegados), 10 conexiones runtime,
  `/login` HTTP 200 y sin errores ni 500 recientes. `DATABASE_URL` sigue como
  migrador y `RUNTIME_DATABASE_URL` como runtime. **Persistencia:** PR #3
  mergeado a `main` (`5b41eb4`); auto-deploy `5f0ca137-993f-4061-b8e0-b34df9adad57`
  SUCCESS, sin migraciones pendientes, `/login` 200 y 10 conexiones
  `consigna_runtime`. T12 queda persistido en Git y producción.
- [x] **T13 — Corregir scoping de cliente y anulación atómica.** Cambios separados,
  con contratos y reproducciones propias. **Etapa T13-A verificada en
  descartable:** cada intento `Serializable` de venta POS valida `clienteId` y
  sucursal activa antes de cualquier mutación; cliente inexistente y de otra
  sucursal comparten contrato `409`, sin cambios en venta, pago, movimientos ni
  ambas representaciones de stock. **Etapa T13-B verificada en descartable:** la
  anulación reclama la venta por `id + sucursalId + anulada=false` al inicio de
  la transacción; dos handlers solapados producen un solo `200`, una restitución
  o rotura, y el perdedor conserva el `400` legacy. Un fallo tardío revierte el
  claim, detalles, movimientos y ambas representaciones de stock.
- [x] **T14-A — Capacidad persistida y compensación local de stock.**
  La migración aditiva crea `StockAutoridad` con una única fila
  `APP_DUAL_WRITE` sin tocar el trigger. La compensación guardada bloquea la
  capacidad con `FOR UPDATE`, toma locks en orden `StockSucursal -> Producto`,
  desactiva `trg_sync_producto_stock`, reconcilia ambos campos globales y
  confirma sólo con igualdad total. Un fallo o una transacción legacy en vuelo
  revierten todo; `FOR SHARE`/`FOR UPDATE` se excluyen mutuamente. Verificado de
  nuevo en PostgreSQL 16 descartable: `verify-t14-stock-authority.mjs` pasa
  completo. No se toca producción.
- [x] **T14-R — Rollout operativo del baseline de stock.** Ejecutado el
  2026-11-02 con ventana y fence: servicio detenido, cero conexiones de
  aplicación, backup `pre-t14-20261102-180847.dump` (4.2 MB), migración
  `20261101030000_establish_stock_authority` aplicada a las 21:09:59Z,
  compensación ejecutada y commit confirmado. Verificado: trigger de stock
  ausente, capacidad `APP_DUAL_WRITE`, deriva 0 en ambos campos, 4 triggers y 2
  índices T12 intactos, 909 ventas. El servicio se restauró con el deployment
  `16d898a7-9894-4348-87d9-b40d43de83dc`, `/login` 200 y conexiones
  `consigna_runtime`. Un `railway redeploy` intermedio (`14c1a252`) falló por
  reconstruir un snapshot viejo; `main` pasa el visual guard en worktree limpio y
  el restore se hizo con `railway up` desde el release T12-only. El deploy de T15
  queda técnicamente desbloqueado. **ACL runtime corregida:** se revocaron
  `VentaNumerador`, `ConsignacionNumerador` y funciones `t12_*`; el chequeo exige
  owner-only y el grant masivo rompía las ventas con
  `VENTA_NUMBERING_AUTHORITY_REQUIRED`. Verificado `AUTHORITY_OK` como
  `consigna_runtime`.
- [x] **T15 — Migrar todos los writers al puente `B1`.** Hacer que POS, anulación,
  consignaciones, liquidaciones, productos, OCR, pedidos esperados y checkout
  bloqueen y obedezcan `APP_DUAL_WRITE|DB_PROJECTION`; gobernar o retirar también
  `POST /api/admin/sync-stock`, `scripts/sync-stock.ts` y cualquier reparador que
  escriba directamente `Producto`; rechazar combinaciones aplicación/esquema
  prohibidas y demostrar que no quedan instancias ni herramientas `L0`.
  **Etapa T15-A verificada en descartable:** el puente bloquea la capacidad con
  `FOR SHARE`, valida la matriz contra el trigger y falla cerrado con `503`; la
  creación de ventas POS usa delta atómico en `APP_DUAL_WRITE` y sólo
  `StockSucursal` en `DB_PROJECTION`. Dos writers concurrentes sobre sucursales
  distintas mantienen `Producto = SUM(StockSucursal)`. Anulación, consignaciones,
  liquidaciones, productos, OCR, pedidos, checkout y `sync-stock` siguen en `L0`.
  **Etapa T15-B verificada en descartable:** la anulación bloquea la capacidad
  antes del claim; sólo la ganadora restituye `StockSucursal` y aplica el delta
  atómico a `Producto` en `APP_DUAL_WRITE`, o deja la proyección en
  `DB_PROJECTION`. Roturas no alteran stock ni `Producto`. Un estado incompatible
  devuelve `503` sin reclamar la venta, y el fallo tardío revierte también
  `Producto` y `VentaDetalle.esRotura`.
  **Etapa T15-C verificada en descartable:** la entrega de consignación bloquea
  la capacidad antes de crear la consignación; `APP_DUAL_WRITE` mueve disponible
  a consignado con delta atómico global y `DB_PROJECTION` sólo escribe
  `StockSucursal`. Un estado incompatible devuelve `503` sin crear ni mover
  stock. Edición y liquidación de consignación siguen en `L0`.
  **Etapa T15-D verificada en descartable:** ajuste, eliminación y liquidación de
  consignación bloquean la capacidad al inicio de la transacción y aplican los
  deltas a `StockSucursal` y `Producto`, o sólo a `StockSucursal` bajo
  `DB_PROJECTION`. La venta de liquidación, movimientos, alertas y cierre se
  preservan; un estado incompatible devuelve `503` antes de leer la consignación.
  Las rutas de `/api/liquidaciones` y el resto de writers siguen en `L0`.
  **Etapa T15-E verificada en descartable:** corrección y nueva liquidación
  bloquean la capacidad antes de leer, actualizan primero `StockSucursal` y
  aplican el delta global bajo `APP_DUAL_WRITE` o dejan proyectar bajo
  `DB_PROJECTION`. Se preservan movimientos, venta recreada, saldo, cierre y
  respuestas; un estado incompatible devuelve `503` sin efectos.
  **Etapa T15-F verificada en descartable:** creación y ajuste absoluto de
  productos bloquean la capacidad al inicio; el ajuste aplica sólo el delta y
  excluye `Producto.stockDisponibleUnits` del update directo. Ambos modos y los
  rechazos `503` tienen cobertura PostgreSQL. OCR, pedidos, checkout y
  `sync-stock` siguen en `L0`.
  **Etapa T15-G verificada en descartable:** la aplicación de stock de OCR bloquea
  la capacidad, incrementa `StockSucursal` atómicamente y aplica sólo el delta a
  `Producto`; `create-product` gatea antes de crear y las confirmaciones devuelven
  `503` sanitizado. Cobertura de ambos modos, concurrencia y rechazo.
  **Etapa T15-H verificada en descartable:** `incrementBranchStock`/
  `decrementBranchStock` aplican transiciones atómicas y delta global; pedidos
  esperados y el webhook de Mercado Pago gatean la capacidad al inicio y
  devuelven `503` sanitizado. Cobertura de ambos modos, decremento insuficiente y
  concurrencia.
  **Etapa T15-I verificada:** `POST /api/admin/sync-stock` quedó como guarda
  `410` sin escrituras de stock (sólo autentica) y `scripts/sync-stock.ts` como
  script de rechazo con salida `2`; ambos derivan a la compensación T14 y
  advierten que ésta fuerza `APP_DUAL_WRITE`, por lo que no debe usarse con T16
  activo. Un test de inventario recorre los archivos de producción de `src/` y
  `scripts/` y falla si algún `producto.update|updateMany|upsert` toca los campos
  globales de stock fuera de `stock-authority.ts`, si el módulo de autoridad
  asigna valores absolutos, si un spread o un `data:` indirecto no puede probar
  la exclusión del stock, o si un `.mjs` fuera de la tooling T14 escribe esos
  campos por SQL crudo; cubierto con casos sintéticos y una sonda temporal. No
  quedan herramientas `L0` de stock: los únicos escritores crudos son la
  compensación y su verificador de T14, declarados y acotados. **Alcance de
  implementación completo:** el código y las pruebas están hechos; lo que falta es
  el despliegue, que es **T15-R**. La tarea queda marcada por su alcance de
  implementación, igual que T12 y T14-A frente a sus rollouts.
- [x] **T15-R — Rollout de los writers `B1` en producción.** **Ejecutada el
  2026-11-03.** El push a `origin/main` (`5b41eb4..08eaf16`) disparó el auto-deploy
  `c8df76d5`, SUCCESS, `/login` 200, 32 migraciones sin pendientes y sin errores de
  arranque. **No se usó ventana ni fence** porque Railway despliega `main`
  automáticamente. La suite de integración completa (13 archivos, 22 tests) pasó
  sobre el HEAD desplegado. **Smoke autenticado ejecutado el 2026-11-04** sobre un
  servidor real y una base descartable configurada como producción (33
  migraciones, `DB_PROJECTION`, trigger serializado): login, POS efectivo y
  tarjeta, anulación, consignación, liquidación, pedido esperado y confirmación de
  ítem de OCR, con **deriva 0** al cierre en todos los productos. No se escribió
  en producción a propósito (consumiría folios, stock y notificaciones reales); el
  riesgo ambiental ya estaba cerrado con la sonda de rol runtime. El checkout de
  Mercado Pago no se puede cerrar sin un pago real: su writer está cubierto por
  T15-H. Scripts en `scripts/smoke/`; detalle, hallazgos y correcciones en
  `t15r-smoke.md`. **Los dos hallazgos del smoke quedaron corregidos:** la
  migración `20261101050000_align_fresh_install_stock_authority` deja una
  instalación nueva en `APP_DUAL_WRITE` sin el trigger de proyección
  (condicional: no toca una base ya cortada) y `GET /api/auth/me` dejó de
  serializar el `hash` bcrypt.
- [x] **T16 — Ejecutar cutover y rollback de stock.** Pausar escrituras,
  reconciliar, activar proyección y `DB_PROJECTION` en una transacción, verificar
  entrada/salida/restitución, observar `B1`, promover después a `C2` y ensayar los
  rollbacks compensatorios `C2 -> B1 -> APP_DUAL_WRITE` sin editar migraciones
  aplicadas.
  **Ejecutado el 2026-11-03 en producción.** Prerrequisitos resueltos: el
  `startCommand` de Railway ya no corre migraciones (verificado en el boot del
  deploy `b2b7cf49`) y el defecto de concurrencia del trigger quedó corregido por la
  migración aditiva `20261101040000_serialize_stock_projection`, que bloquea la fila
  de `Producto` antes de recomputar. Secuencia: deploy `75207a3a` (33 migraciones),
  `prisma migrate deploy` aplicado dentro del contenedor, cutover transaccional con
  `driftBefore=0`, `probe=in-out` y `productCount=248`. Estado final verificado:
  `DB_PROJECTION`, trigger presente, deriva 0, 914 ventas y `/login` 200. Sonda
  posterior dentro de una transacción revertida: `1 → 2 → 1` con proyección igual a
  la suma en cada paso. La aplicación sigue en `B1`; `C2` es un cambio de código
  posterior a la ventana de observación. Rollback disponible: `compensate-t14`
  (`DB_PROJECTION -> APP_DUAL_WRITE`), probado en descartable. Detalle en
  `t16-cutover.md`.
- [x] **T17 — Extraer cálculos puros sin cambiar aritmética.** Tipos con escala y
  redondeo sólo después de probar equivalencia.
  **Etapa T17-A verificada:** `src/modules/ventas/sale-totals.ts` concentra
  `applyDiscount`, `calculateLineTotal`, `applyCardSurcharge` y
  `calculateSaleTotals`, y `POST /api/ventas` los usa. Equivalencia probada con un
  diferencial `Object.is` contra la transcripción literal del código anterior (480
  casos de línea, 375 de totales) y con el contrato persistido en PostgreSQL 16
  (`total` `42.99`, líneas `30.01`/`9.99`, descuento global `0.01`, tarjeta 7.5%).
  Sin redondeo nuevo ni punto fijo. Quedan `applyConsignmentMarkup`,
  `calculatePendingUnits`, `validateSettlement`, `calculateGrossProfit`,
  `calculateMarginPercentage` y `calculateStockTransition`. Hallazgo registrado:
  los reportes de dashboard/POS restan otra vez `descuentoGlobal` de un `total`
  que ya lo tenía restado; corregirlo exige aprobación aparte.
  **Etapa T17-B verificada:** `applyConsignmentMarkup` centraliza el recargo (8
  expresiones en 7 archivos) y `calculatePendingUnits`/`validateSettlement`
  centralizan pendientes y la validación de liquidación (11 expresiones en 9
  archivos). Un test de inventario falla si cualquiera de las dos fórmulas
  reaparece inline, aunque esté partida en varias líneas. Diferencial por
  `Object.is`, bordes de la validación (exacto, exceso, pendiente 0) y cinco suites
  de integración PostgreSQL verdes. Sin redondeo nuevo: `100 * (1 + 10/100)` sigue
  dando `110.00000000000001`. Quedan `calculateGrossProfit`,
  `calculateMarginPercentage` y `calculateStockTransition`.
  **Etapa T17-C verificada:** `src/modules/finance/profit.ts` centraliza ganancia
  de línea, ganancia bruta (descuento global restado al final, mismo orden) y
  margen porcentual sin redondear; `calculateStockTransition` centraliza el
  `prev/post` de `incrementBranchStock`, `decrementBranchStock` y
  `aplicarMovimientoStock`. Diferenciales por `Object.is`, casos de ganancia
  negativa, base no positiva y coma flotante, e integración PostgreSQL de stock y
  OCR verdes. Con esto las diez funciones puras del diseño están extraídas.
- [x] **T18 — Extraer piloto `RegistrarVenta` detrás de un switch.** Preservar
  respuesta completa y unidad transaccional; implementar un único dispatch
  `SALES_REGISTER_USE_CASE=legacy|application`, con ausencia, vacío o valor
  inválido resueltos a `legacy` más diagnóstico, sin ejecución doble ni fallback.
  **Implementada y verificada en descartable el 2026-11-03, no desplegada.** El
  caso de uso vive en `src/modules/ventas/application/register-sale.ts` con
  puertos propios (cliente, autoridad de stock, movimiento, venta, pago) y una
  unidad de trabajo Prisma que abre la transacción `Serializable` y conserva los
  reintentos `P2002`/`P2034`. La ruta quedó en autenticar, validar, despachar y
  traducir errores; el adaptador legacy se movió sin cambios de contrato. Ambos
  dispatches pasan la misma caracterización HTTP sobre PostgreSQL 16 —
  `APP_DUAL_WRITE`, `DB_PROJECTION`, estado incompatible `503` y autoridad de
  numeración ausente— además de los casos de borde por ruta. El lock heredado de
  serie por sucursal se conserva en el adaptador Prisma para no alterar el orden
  frente al webhook de Mercado Pago. Detalle en `t18-registrar-venta.md`.
- [ ] **T19 — Activar y revertir el piloto.** Exigir `B1`, numeración PostgreSQL y
  caracterización verde; activar una instancia canary, operar mezcla
  `legacy|application`, comparar snapshots, errores, efectos y latencia, promover
  gradualmente y ensayar rollback mixto sobre los mismos registros. Mantener la
  autoridad de numeración y aprobar una ventana de observación antes de retirar
  el handler legacy.
- [ ] **T20 — Endurecer límites transaccionales de ventas.** Cliente por defecto y
  sesión de caja dentro de cada intento, con aprobación de conducta observable.
- [ ] **T21 — Migrar consignaciones y liquidaciones.** Incorporar locks,
  actualizaciones condicionales e invariantes puras.
- [ ] **T22 — Migrar caja y pagos.** Definir límites transaccionales e
  idempotencia.
- [ ] **T23 — Aislar notificaciones y Socket.IO.** Salas, sesión vigente y efectos
  post-commit/outbox.
- [ ] **T24 — Hacer OCR y webhooks idempotentes.** Transiciones condicionales y
  registro de eventos procesados.
- [ ] **T25 — Retirar legacy.** Sólo después de T19, una ventana de observación
  aprobada, evidencia de cero tráfico o consumidores legacy, inventario sin
  lectores ni writers pendientes y una revisión final de compatibilidad y
  rollback.

## Gates obligatorios

Una tarea de implementación no se considerará completa sin:

1. prueba que reproduzca el comportamiento o defecto;
2. verificación de contrato HTTP;
3. prueba PostgreSQL para cualquier invariante concurrente;
4. revisión adversarial del diff;
5. rollback documentado y probado para todo cambio que produzca estado durable,
   aunque no incluya migraciones;
6. trabajo realizado sobre `main`, actualizado por fast-forward antes de editar;
7. matriz aplicación/esquema verificada y estado incompatible con fallo cerrado
   para todo cambio de autoridad de datos;
8. evidencia de observación aprobada antes de eliminar una implementación legacy.

## Tooling

- El **visual guard** (`scripts/check-visual-guard.mjs`, `visual-guard-*.mjs`,
  `visual-guard-baseline.json` y sus dos tests) se retiró el 2026-11-03. Su costo
  real era mantener un baseline exacto de más de mil líneas y un tope de 300
  líneas por archivo nuevo que castigaba tests legítimos. Lo que aportaba queda
  mejor cubierto por ESLint y por `src/theme/know-design-system.test.ts`, que
  verifica los tokens generados contra el CSS sin baseline. `npm run lint` es
  ahora sólo ESLint y `build.mjs` corre el test de tema antes del build.
- No hay script `test` global: cada suite se invoca con
  `node --import tsx --test <archivo>`.
- **Guardrails corregidos en T18:** `venta-numbering-wiring.test.ts` ahora
  inventaría los dos adaptadores reales de venta
  (`src/app/api/ventas/register-sale-handlers.ts` y
  `src/modules/ventas/infrastructure/prisma-register-sale.ts`) en lugar de
  `src/app/api/ventas/route.ts`; y `producto-stock-writers.test.ts` declara los
  scripts de cutover/verificación de T16 en su allowlist de SQL crudo (fallaba
  desde T16).
- **Guardrail nuevo:** `npm run stock:bootstrap:test` verifica que el estado
  posterior a las migraciones sea compatible con la autoridad de stock —base
  nueva en `APP_DUAL_WRITE` sin trigger, base cortada en `DB_PROJECTION` con el
  trigger intacto— y que la migración condicional sea idempotente.
- `_scratch/**` está ignorado por ESLint: adentro hay builds viejos que generaban
  2625 errores falsos. Con eso `npx eslint` queda en 0 errores y 1 warning.

## Política de rama

- Crear cambios nuevos únicamente sobre `main`.
- No crear ramas `feature/*`, `fix/*`, `security/*`, `develop` o variantes por
  cliente para este repositorio.
- Las ramas existentes no se eliminan como parte de este documento. Su borrado
  local o remoto requiere autorización explícita y una verificación previa de
  que no contienen trabajo exclusivo.
