# Plan y estado de tareas

Baseline de análisis: `main` en `f29298eb20c54b0ca11368ce219bd70bb8e8e386`,
árbol limpio, 2026-11-04. Estado de ejecución al cierre de esa fecha: ver
[Estado consolidado](#estado-consolidado).

## Estado general

Diagnóstico cerrado y **primer bloque ejecutado y desplegado** el 2026-11-04
(deployment `1aa80f82`, commit desplegado
`345d11159e00569593ed4681ffb6f51dc110001d`, estado `SUCCESS`).
Detalle en [deploy-2026-11-04.md](./deploy-2026-11-04.md).

Las tareas que quedan siguen requiriendo autorización explícita e individual antes
de empezar, y su verificación se declara antes de escribir código, no después.

### Estado consolidado

Tres ejes que **no son lo mismo** y que conviene no mezclar:

- **Cerrada**: el trabajo está hecho, verificado y commiteado.
- **Desplegada**: el cambio corre en el servidor real que usan los clientes.
- **Verificada en producción**: se usó ahí y funcionó. Un cambio puede estar
  desplegado y estar mal; desplegar no es verificar.

| Tarea | Cerrada | Desplegada | Verificada en producción |
| --- | --- | --- | --- |
| M01 — runner de tests | ✅ | ✅ | N/A (no corre en el servidor) |
| M02 — auditoría cableada | ✅ | ✅ | ✅ `LOGIN`/`CREATE`/`UPDATE`/`DELETE` registrados |
| M03 — alias OCR por sucursal | ✅ | ✅ | Pendiente |
| M04 — suscripción reasignada | ✅ | ✅ | Pendiente: el usuario de prueba no tenía suscripción |
| Fix P0 — advisory locks | ✅ | ✅ | ✅ Alta, edición y baja de usuario funcionan |
| M05 — README alineado | ✅ | ✅ | N/A (documento) |
| M06 — ADR modelo de render | ✅ | ✅ | N/A (documento) |
| M13 — índices compuestos | ✅ | ✅ | ✅ `EXPLAIN` usa `Venta_sucursalId_fecha_idx` |
| M14 — agregación en SQL | ✅ | ✅ | Pendiente: dashboard abierto en el navegador |
| M07 — RSC parcial | Cancelada por M06 | — | — |
| M19 — secuencias atrasadas | Diagnosticada | No | — |
| M20 — preflight de migraciones | Diagnosticada | No | — |
| M08, M09, M10, M11, M12, M15, M16, M17, M18 | Pendientes | — | — |

**Qué falta para cerrar el nivel 3:** abrir el dashboard en el navegador y confirmar
que los números se ven igual que antes del despliegue (M14).

### Verificación end-to-end en producción (2026-11-04)

Ejecutada con una sesión real contra `importvps.com`:

| Paso | Resultado |
| --- | --- |
| `POST /api/auth/login` | 200 |
| `POST /api/settings/users` (alta) | 200, usuario id 6 |
| `PUT /api/settings/users` (edición) | 200 |
| `DELETE /api/settings/users?id=6` (baja) | 200, "Usuario eliminado" |
| Usuario de prueba remanente | 0 |
| `AuditLog` | `LOGIN/AUTH`, `CREATE/USERS`, `UPDATE/USERS`, `DELETE/USERS`, todos con actor y `targetUserId` |

Esto cierra el P0 de advisory locks de punta a punta y confirma M02 en producción.
La credencial usada se leyó desde un archivo local ignorado por git, nunca se
imprimió, y se borró al terminar.

## Convención

- **Prioridad**: `P0` corrige una afirmación falsa o una brecha de protección;
  `P1` habilita trabajo futuro; `P2` mejora mantenibilidad sin urgencia.
- **Esfuerzo**: `S` < 1 día · `M` 1–3 días · `L` 1–2 semanas · `XL` > 2 semanas.
- **Dependencias**: la tarea no puede empezar antes de que la anterior esté
  cerrada y verificada.
- La evidencia se cita como `archivo:línea` sobre el baseline. Si el archivo
  cambia, la evidencia se revalida antes de ejecutar.

---

## Diagnóstico por eje

### Eje 1 — Testabilidad

Hay 74 archivos de test (17 de integración) y **no existe un script `test`** en
`package.json`. Los tests se corren con 8 scripts temáticos sueltos
(`security:test`, `design:test`, `numbering:authority:test`,
`stock:authority:test`, `stock:bootstrap:test`, `stock:cutover:test`,
`migrate:t11:test`, `numbering:audit:test`). No hay comando que corra la suite
completa, así que en la práctica no se corre.

Un test que no se ejecuta no protege nada.

### Eje 2 — Trazabilidad

`recordAuditLog` (`src/lib/security/audit.ts:34`) tiene **dos llamadas** en todo
el repositorio: `src/app/api/auth/logout/route.ts` y
`src/app/api/security/sessions/route.ts`. El tipo `AuditModule`
(`src/lib/security/audit.ts:13`) declara `INVENTORY`, `SALES`, `CONSIGNMENTS`,
`CLIENTS` y `SETTINGS`, pero ninguno de esos módulos registra eventos.

El `README.md` raíz promete "auditoría central de acciones por usuario y módulo".
Hoy la infraestructura existe y no está cableada.

### Eje 3 — Aislamiento por sucursal

De 127 archivos que importan `@/lib/prisma`, 84 no pasan por
`src/lib/security/sucursalScope.ts`. Filtrando a los que operan sobre modelos con
`sucursalId`, quedan 22 archivos:

```text
src/lib/ocr/matching-engine.ts
src/lib/storefront/public-catalog.ts
src/lib/subscriptions/require-subscription.ts
src/app/api/catalog/route.ts
src/app/api/public/checkout/route.ts
src/app/api/consignaciones/[id]/remito-link/route.ts
src/app/api/cron/check-vencimientos/route.ts
src/app/api/cron/consignaciones/route.ts
src/app/api/dashboard/consignaciones/route.ts
src/app/api/facturas-proveedor/items/[id]/confirm/route.ts
src/app/api/gastos/[id]/comprobante-link/route.ts
src/app/api/gastos/categorias/[id]/route.ts
src/app/api/productos/barcode/[code]/route.ts
src/app/api/settings/pos/cajas/route.ts
src/app/api/settings/pos/cajas/turno/route.ts
src/app/api/ventas/[id]/ticket-link/route.ts
src/app/ver/consig/[period]/pdf/route.ts
src/app/ver/dashboard/[period]/pdf/route.ts
src/app/ver/gasto/[id]/route.ts
src/app/ver/pos/[period]/pdf/route.ts
src/app/ver/remito/[id]/route.ts
src/app/ver/ticket/[id]/route.ts
```

Varios son públicos por diseño (catálogo, `ver/*` con token firmado, cron). El
problema no era la lista: era que **nadie la había clasificado**. Sin ese
veredicto por archivo no se puede afirmar que el aislamiento es correcto, y es
exactamente lo que se rompe al operar con la segunda sucursal.

> Clasificada en M03: ver [Matriz de aislamiento por sucursal](#matriz-de-aislamiento-por-sucursal-m03).
> Resultado: 21 correctos, 1 corregido.

### Eje 4 — Cohesión de archivos

| Archivo | Líneas |
| --- | --- |
| `src/app/(system-guard)/(protected)/productos/components/factura-proveedor-dialog.tsx` | 1.964 |
| `src/app/(system-guard)/(protected)/productos/components/productos-view.tsx` | 1.829 |
| `src/app/(system-guard)/(protected)/productos/components/producto-wizard-dialog.tsx` | 1.355 |
| `src/app/(system-guard)/(protected)/pedidos-esperados/components/pedidos-esperados-view.tsx` | 1.260 |

### Eje 5 — Modelo de render no declarado

42 de 47 páginas son `"use client"`; hay **un solo** archivo `"use server"`.
Todo el acceso a datos pasa por `src/lib/apiService.ts` (1.225 líneas, ~205
métodos) hacia route handlers. El App Router se usa como router de una SPA.

Esto no es un defecto: es una decisión válida para un dashboard operativo. El
defecto es que está **implícita**. Nadie escribió "usamos SPA", así que cada
desarrollador nuevo asume RSC y se equivoca.

Excepción correcta: el storefront público (`src/app/[slug]/page.tsx`,
`src/app/lista/page.tsx`) sí es server component con metadata por slug, que es lo
que SEO necesita.

### Eje 6 — Coherencia documental

El `README.md` afirma cosas que el código no sostiene: "auditoría central",
"SaaS" sin aclarar la unidad de despliegue, "Server Actions" en la tabla de
stack cuando hay una sola.

### Eje 7 — Performance

**Lo que ya está bien resuelto** (verificado, no supuesto):

- Cero `<img>` crudos; 16 usos de `next/image`.
- `optimizePackageImports` para `lucide-react`, `recharts`, `@dnd-kit/*`,
  `motion/react` y `date-fns` (`next.config.ts`).
- `serverExternalPackages` para `tesseract.js` y `sharp`.
- `Cache-Control: immutable` para `/_next/static` y `/api/files`; `no-store`
  para todo `/api` (`next.config.ts`).
- El storefront público usa `unstable_cache` con `revalidate: 120`
  (`src/lib/storefront/public-catalog.ts:231-235`), así que el `force-dynamic`
  de la página no golpea la base en cada visita.
- Puppeteer acotado por `withChromiumSlot`: N PDFs simultáneos no saturan el
  proceso.
- `/api/productos` pagina con `take` y `count` en paralelo
  (`src/app/api/productos/route.ts:216-224`).
- `/api/ventas` acota a 200 (`src/app/api/ventas/route.ts:68`).
- Proyecciones usadas en serio: 183 `select` contra 159 `include` sobre 113
  `findMany`.
- Web Vitals ya se recolectan con p50/p75/p95
  (`src/lib/performance-vitals-store.ts`, `src/components/performance-vitals.tsx`).

**Los problemas:**

1. **El dashboard agrega en JavaScript, no en SQL.** `getDashboardTendencia`
   (`src/lib/dashboard/kpi-logic.ts:499-570`) trae **todas** las ventas del
   período con `detalles` anidados y las acumula en un `for`.
   `getDashboardTopProductos` (`kpi-logic.ts:597+`) trae todos los
   `liquidacionItem` y `ventaDetalle` del período y ordena en memoria para
   quedarse con 10. El costo crece con el histórico, no con el resultado.

2. **Faltan índices compuestos para las consultas reales.** La consulta caliente
   del dashboard es `(sucursalId, fecha, anulada)`. El schema tiene
   `@@index([sucursalId])` y `@@index([clienteId, fecha])` en `Venta`, pero **no**
   el compuesto. Igual en `Pago`. `MovimientoStock` tiene `(sucursalId)` y
   `(createdAt)` por separado, no combinados.

3. **Listados sin cota.** `/api/clientes` devuelve todos los clientes sin `take`;
   `/api/historial` devuelve todos los movimientos. Ya cubierto por M10, se
   menciona acá porque también es un problema de performance, no solo de
   contrato.

4. **El bundle nunca se midió.** 42 de 47 páginas son cliente, `apiService`
   (1.225 líneas) lo importan 50 archivos y hay 46 usos de `motion/react` en
   componentes cliente. Puede estar bien, pero nadie lo sabe: sin medición, esa
   afirmación no existe.

5. **`force-dynamic` sin justificar en 16 archivos**, incluido
   `src/app/(system-guard)/layout.tsx`. En un layout con auth suele ser
   necesario, pero "suele" no es una razón escrita.

6. **Se mide y no se acciona.** Hay recolección de Web Vitals con percentiles y
   no existe umbral, alarma ni gate. Un tablero que nadie mira no es
   observabilidad.

---

## Backlog

### M01 — Agregar `npm test` y correr la suite completa

- **Prioridad** P1 · **Esfuerzo** S · **Dependencias** ninguna
- **Estado**: **cerrada** (2026-11-04), commit `test: add unified test runner`.
- **Evidencia**: 74 archivos `*.test.ts*`; `package.json` sin script `test`;
  patrón de ejecución ya usado en `security:test` (`node --import tsx --test`).
- **Alcance**: agregar un script `test` que descubra los 74 archivos y un
  `test:integration` separado para los 17 de integración, que requieren base.
- **Aceptación**: `npm test` corre todos los tests no-integration y termina con
  código 0 sobre el baseline, sin tocar ningún test existente.
- **Verificación**: ejecutar `npm test` y reportar el conteo de tests y el
  resultado. Si algún test ya falla en el baseline, se documenta la lista exacta
  en lugar de arreglarlo dentro de esta tarea.
- **Riesgo**: bajo. No modifica código de producción.
- **Resultado**: `npm test` descubre **59 archivos unitarios y 17 de
  integración**; corre **231 tests en 1,58 s, 231 pasan, 0 fallan**. Se agregó
  `scripts/test.mjs` (descubre, separa unitarios de integración, inyecta
  `DATABASE_URL`/`JWT_SECRET` dummy sólo si faltan) y los scripts `test`,
  `test:integration` y `test:all`.
- **Hallazgo del baseline**: un test ya fallaba: `venta-numbering-wiring.test.ts`
  esperaba que `src/app/api/ventas/register-sale-handlers.ts` llamara a
  `createVentaWithAuthority`, expectativa que quedó vieja tras T25 (`9af282c`
  retiró el handler legacy y movió la creación a `prisma-register-sale.ts`, que
  ya estaba en la lista). Se corrigió la expectativa en un cambio propio con
  justificación; la invariante crítica —`directCreates` debe ser únicamente
  `venta-numbering-authority.ts`— sigue verificándose y pasa.
- **Nota operativa**: `test:integration` **falla cerrado** si no existe
  `TEST_DATABASE_URL`. No la completa desde `.env` a propósito: esos tests hacen
  `TRUNCATE` sobre tablas reales y no deben poder apuntar a la base de
  desarrollo por accidente.

### M02 — Cablear la auditoría en las mutaciones

- **Prioridad** P0 · **Esfuerzo** M · **Dependencias** M01
- **Estado**: **cerrada** (2026-11-04) para el alcance declarado. Los módulos
  restantes quedan en M18.
- **Evidencia**: `recordAuditLog` en `src/lib/security/audit.ts:34` con dos
  llamadas; `AuditModule` declara módulos sin uso (`audit.ts:13`).
- **Alcance**: registrar `CREATE`/`UPDATE`/`DELETE` en las mutaciones que ya
  exigen `requireRole`, empezando por usuarios, productos, ventas (anulación),
  consignaciones y configuración. No registrar en lecturas.
- **Aceptación**: cada mutación cubierta escribe una fila en `AuditLog` con
  `userId`, `action`, `module` e IP/UA; un test por mutación lo prueba; los
  secretos siguen filtrándose (`audit.ts:63-67`).
- **Verificación**: `npm run security:test` + los tests nuevos + una consulta
  manual a `/api/security/activity` mostrando los eventos.
- **Fuera de alcance**: auditar lecturas, construir UI nueva de auditoría.
- **Resultado**: se agregó `src/lib/security/audit-events.ts` con constructores
  puros por evento, y se cableó en **9 mutaciones** de 6 handlers:

  | Handler | Acciones auditadas |
  | --- | --- |
  | `settings/users/handlers.ts` | alta, modificación y baja de usuario |
  | `productos/route.ts` | alta de producto |
  | `productos/[id]/route.ts` | modificación y baja lógica |
  | `ventas/[id]/route.ts` | anulación de venta (con motivo y roturas) |
  | `consignaciones/route.ts` | alta de consignación |
  | `settings/general/route.ts` | cambio de configuración |

  Los cuatro handlers con dependencias inyectables recibieron `recordAuditLog`
  en su objeto `deps`, así los tests pueden interceptarlo sin tocar la base.
- **Diseño de seguridad**: `userUpdated` registra `passwordChanged: boolean`,
  nunca el valor ni el hash. `settingsUpdated` aplica **lista blanca** de campos,
  así `mpAccessTokenTienda`, `mpPublicKeyTienda` y `andreaniPassword` no pueden
  llegar al log aunque vengan en el body.
- **Tests**: `audit-events.test.ts` (10 casos sobre payload y filtrado de
  secretos) y `audit-wiring.test.ts` (falla si alguien borra la llamada de un
  handler cubierto). Suite: **243 tests, 243 pasan**; `tsc --noEmit` y `eslint`
  sin errores.
- **Efecto colateral**: `consignacion-numbering-wiring.test.ts` necesitó el stub
  de `recordAuditLog` en sus deps falsas, porque el handler ganó esa dependencia.

### M18 — Auditar los módulos que quedaron afuera de M02

- **Prioridad** P2 · **Esfuerzo** M · **Dependencias** M02
- **Evidencia**: fuera del alcance declarado de M02 quedan mutaciones sin
  auditar: gastos, proveedores, pedidos esperados, facturas de proveedor,
  liquidaciones, apertura/cierre de caja, pagos, clientes, categorías y
  subcategorías, sucursales y códigos promocionales.
- **Alcance**: reutilizar el patrón de M02 (`audit-events.ts` + `deps`
  inyectable) sin inventar uno nuevo.
- **Aceptación**: cada módulo listado registra sus altas, modificaciones y bajas;
  el test de wiring se amplía con los archivos nuevos.
- **Verificación**: suite verde + revisión de que ningún evento incluya
  credenciales.
- **Nota**: no es urgente para operar, sí para responder "quién cambió esto" en
  cualquier módulo del sistema.

### M03 — Clasificar el aislamiento por sucursal de los 22 archivos

- **Prioridad** P0 · **Esfuerzo** M · **Dependencias** M01
- **Estado**: **cerrada** (2026-11-04). Matriz completa más abajo; 1 archivo
  corregido.
- **Evidencia**: ver Eje 3.
- **Alcance**: producir una matriz `archivo → modelo → filtro aplicado →
  veredicto (correcto | corregir | público por diseño)`. Corregir solo los que
  mutan datos o leen datos privados sin filtro de sucursal.
- **Aceptación**: los 22 archivos tienen veredicto escrito; los marcados
  "corregir" usan `buildSucursalWhere` o `canAccessSucursalResource`; los
  "público por diseño" tienen una línea de justificación.
- **Verificación**: la matriz en este mismo archivo + tests de alcance para los
  casos corregidos (usuario de sucursal A no ve datos de sucursal B).
- **Riesgo**: medio. Toca autorización; cualquier cambio requiere revisión
  independiente antes de mergear.
- **Resultado**: 21 de 22 archivos ya estaban correctos; **uno tenía un hueco
  real** (`matching-engine.ts`, ver matriz). Se corrigió en el origen y se
  agregó `matching-scope.test.ts` con 3 casos, incluido el que verifica que los
  alias de proveedor se filtren por la sucursal del producto.
- **Criterio usado**: un filtro inline `{ sucursalId: auth.activeSucursalId }` es
  equivalente a `buildSucursalWhere` **sólo** cuando la ruta no admite vista
  global. Si admite `sucursalId === 0`, tiene que usar el helper o replicar su
  lógica explícitamente.
- **Hallazgo de método**: `Select-String -Path` interpreta `[id]` de las rutas
  como comodines y produce falsos negativos. Los conteos de este documento se
  rehicieron con `-LiteralPath` y `git grep`.

### M04 — Corregir la suscripción atada al usuario

- **Prioridad** P1 · **Esfuerzo** M · **Dependencias** M03
- **Estado**: **cerrada** (2026-11-04). ADR
  [`adrs/002-suscripcion-de-la-instalacion.md`](./adrs/002-suscripcion-de-la-instalacion.md).
- **Evidencia**: `Subscription.userId @unique` en `prisma/schema.prisma`; la FK
  es `ON DELETE RESTRICT` (migración `20260225061121_new`).
  `src/lib/subscriptions/require-subscription.ts` ya lee a nivel instalación.
- **Alcance**: definir y documentar qué pasa con la suscripción cuando cambia el
  usuario dueño o cuando el dueño es dado de baja. Si hace falta, migrar el
  anclaje a una entidad estable de la instalación (no un tenant: ver decisión 1).
- **Aceptación**: existe una regla escrita; el comportamiento de
  `require-subscription.ts` coincide con la regla; test que cubre el caso de
  cambio de dueño.
- **Verificación**: tests nuevos + revisión de la migración con plan de rollback.
- **Riesgo**: alto. Toca datos persistidos; requiere migración reversible.
- **Resultado**: se resolvió **sin migración**, revirtiendo el riesgo.
  - **El diagnóstico real**: no era un problema de lectura (el código ya busca
    cualquier suscripción activa), sino de ciclo de vida. La FK `RESTRICT` hacía
    que borrar al contacto de facturación fallara con un 500 opaco.
  - **Regla (ADR 002)**: la suscripción pertenece a la instalación; `userId` es el
    contacto de facturación. Al eliminarlo, se reasigna en la misma transacción
    al administrador activo de menor `id` que no tenga ya una suscripción.
  - **Por qué no se migró**: hacer `userId` nullable habría obligado a tocar
    siete puntos de facturación que dereferencian `sub.user.nombre`
    (`check-subscriptions` ×2, `check-vencimientos` ×4, webhooks MP y PayPal). Un
    `null` sin manejar rompe el aviso de vencimiento justo cuando más importa.
    Anclar a `Sucursal` era desproporcionado para un caso que ocurre una vez al
    año. Sin migración no hay plan de rollback que diseñar.
  - **Test**: `subscription-ownership.integration.test.ts`, ejecutado contra el
    dump restaurado. Verifica que el borrado no falla, que la suscripción
    sobrevive con plan y estado intactos, que el nuevo contacto es un admin
    activo sin otra suscripción, y que `getActivePlanLimits()` sigue resolviendo.
  - **Hallazgo que el test destapó**: el primer intento de reasignación falló por
    violación de unicidad, porque el candidato ya tenía suscripción propia. El
    filtro `subscription: { is: null }` es necesario, no cosmético.

### M19 — Corregir secuencias atrasadas en producción

- **Prioridad** P0 · **Esfuerzo** S · **Dependencias** ninguna
- **Estado**: diagnosticada, **no ejecutada**. Requiere autorización explícita:
  es una operación sobre la base de producción.
- **Evidencia** (consulta de solo lectura sobre producción, 2026-11-04):

  | Tabla | `max(id)` | `last_value` de la secuencia |
  | --- | --- | --- |
  | `Plan` | 3 | **0** (nunca usada) |
  | `TiendaGlobalConfig` | 1 | **0** (nunca usada) |

  Las filas se insertaron con `id` explícito y la secuencia nunca avanzó. Cualquier
  `INSERT` sin `id` en esas tablas choca contra la PK.
- **Impacto**: `prisma.plan.create()` falla. Eso rompe el auto-seeding de planes
  que el README promete para instalaciones antiguas, y cualquier alta de plan
  desde administración. `TiendaGlobalConfig` tiene el mismo problema.
- **Alcance**: `setval` al máximo actual, en una ventana controlada.
- **Aceptación**: `max(id) <= last_value` en ambas tablas; un `INSERT` de prueba en
  una transacción con `ROLLBACK` no falla.
- **Verificación**: la misma consulta del diagnóstico, antes y después.
- **Nota**: el problema se detectó primero en el clúster restaurado, donde el
  restore reproduce el estado real de las secuencias. No es un artefacto del dump.

### M20 — Reparar el preflight de migraciones

- **Prioridad** P1 · **Esfuerzo** S · **Dependencias** ninguna
- **Estado**: diagnosticada, no ejecutada. Bloquea el camino documentado de
  despliegue (ver `deploy-2026-11-04.md`).
- **Evidencia**: `npm run migrate:t11:deploy` falla con
  `Unknown migration history row: 20261101040000_serialize_stock_projection`.
  El script `scripts/migrations/preflight-t11.mjs` valida contra una lista cerrada
  de migraciones conocidas y no incluye las cuatro posteriores a T11
  (`20261101040000`, `20261101050000`, `20261101060000`, `20261101070000`), que ya
  están aplicadas en producción. También fija `CURRENT_SCHEMA_HASH`, así que
  cualquier cambio de `schema.prisma` (como los índices de M13) lo invalida.
- **Impacto**: el comando que el README recomienda para desplegar migraciones no
  se puede usar. Hoy el despliegue debe hacerse con `npx prisma migrate deploy`.
- **Alcance**: reemplazar la lista cerrada por una validación que derive del
  directorio `prisma/migrations`, o dejar el script explícitamente acotado a T11 y
  documentar que no es el camino general.
- **Aceptación**: `npm run migrate:t11:deploy` corre sobre una base con el
  historial actual, o el README deja de recomendarlo para migraciones nuevas.
- **Verificación**: ejecutarlo contra el clúster descartable.

### M05 — Alinear el `README.md` con la realidad del sistema

- **Prioridad** P0 · **Esfuerzo** S · **Dependencias** M02, M03
- **Estado**: **cerrada** (2026-11-04).
- **Evidencia**: Eje 6.
- **Alcance**: (a) aclarar que la unidad de despliegue es una instalación por
  comercio; (b) ajustar la afirmación de auditoría al estado real o, si M02 ya
  cerró, al alcance exacto cubierto; (c) corregir la tabla de stack; (d) declarar
  el modelo de render.
- **Aceptación**: ninguna afirmación del README queda sin respaldo en el código.
- **Verificación**: recorrer el README contra el código, ítem por ítem.
- **Nota**: barata y de alto retorno. Va después de M02 para no documentar dos
  veces.
- **Resultado** (7 cambios verificados uno por uno):
  1. **Título e intro**: se quitó "B2B SaaS" del título y se agregó un bloque de
     *Unidad de despliegue* que dice explícitamente que es una instalación por
     comercio, que no hay tabla de organizaciones ni de tenants, y que varias
     sucursales sí están aisladas.
  2. **Auditoría**: la viñeta "Auditoría central de acciones por usuario y módulo"
     pasó a describir el alcance real —usuarios, productos, anulación de ventas,
     consignaciones y configuración— y a declarar que el resto todavía no audita,
     con puntero a M18.
  3. **Árbol de estructura**: listaba sólo `modules/invoices/`; ahora lista los
     seis módulos reales y aclara que `modules/ventas/` es el patrón de
     referencia, no el estado de todos.
  4. **Modelo de render**: sección nueva. Dice que es una SPA sobre App Router
     (42/47 páginas cliente, un solo `"use server"`), que el catálogo público sí
     es SSR por SEO, y que no se usan Server Actions.
  5. **Variable inexistente**: la tabla de entorno declaraba `SOCKET_DISPATCH_URL`,
     que **no existe en el código**. Se reemplazó por `SOCKET_DISPATCH_SECRET`
     (el real, con fallback a `CRON_SECRET`) y `APP_URL`, que es de donde
     `socket-trigger.ts` toma la base.
  6. **Scripts**: se agregaron `npm test`, `test:integration` y `test:all` con la
     aclaración de que los de integración fallan cerrado sin `TEST_DATABASE_URL`.
  7. **"tenant"**: quedaban dos usos (`auto-seeding` y setup inicial) que
     contradecían la decisión 1; se cambiaron por "instalación" y "comercio".
- **Corrección del alcance original**: el punto (c) decía "corregir la tabla de
  stack (Server Actions)". El README **nunca** mencionó Server Actions — eso
  estaba en `openspec/config.yaml`. La afirmación realmente falsa era la variable
  `SOCKET_DISPATCH_URL`. Se corrigió esa.

### M06 — ADR: modelo de render (SPA vs RSC)

- **Prioridad** P1 · **Esfuerzo** S · **Dependencias** M05
- **Estado**: **cerrada** (2026-11-04). Decisión: **A — SPA sobre el App Router**.
  ADR: [`adrs/001-modelo-de-render-spa.md`](./adrs/001-modelo-de-render-spa.md).
- **Evidencia**: Eje 5.
- **Alcance**: decisión explícita con consecuencias. Si se elige SPA, se
  documenta y se cierra el tema. Si se elige RSC parcial, se listan las pantallas
  candidatas (dashboard y listados con waterfall) y nace M07.
- **Aceptación**: ADR en `odd/mejoras-arquitectura/adrs/` con contexto, decisión,
  alternativas y consecuencias.
- **Verificación**: revisión humana del ADR. No hay verificación automática.
- **Resultado**: el ADR 001 declara la SPA como modelo oficial, con el catálogo
  público como única excepción (SSR por SEO). Se descartaron explícitamente la
  migración a RSC parcial (opción B) y el diferimiento (opción C). Incluye cinco
  reglas operativas para trabajo futuro y una cláusula de reapertura atada al
  baseline de bundle de M15.
- **Consecuencia en el backlog**: M07 queda **cancelada**. Si M15 demuestra que
  una ruta crítica excede el presupuesto de bundle, se reabre el ADR y con él M07.

### M07 — Migrar dashboard y listados a Server Components (condicional)

- **Prioridad** P2 · **Esfuerzo** L · **Dependencias** M06 (solo si el ADR lo
  elige explícitamente)
- **Estado**: **cancelada** por M06. El ADR 001 decidió SPA. Se reabre sólo si M15
  demuestra que una ruta crítica excede el presupuesto de bundle.
- **Evidencia**: 42 de 47 páginas `"use client"`; `src/app/apiService.ts` con
  ~205 métodos.
- **Alcance**: una pantalla piloto (dashboard), con islas cliente para lo
  interactivo.
- **Aceptación**: la pantalla piloto no hace fetch inicial en el cliente; el
  contrato HTTP existente sigue funcionando; los tests verdes.
- **Verificación**: comparar requests de red antes/después en la pantalla.
- **Nota**: si M06 decide SPA, esta tarea se cancela. No arrancarla sin ADR.

### M08 — Reducir `factura-proveedor-dialog.tsx` y `productos-view.tsx`

- **Prioridad** P1 · **Esfuerzo** L · **Dependencias** M01
- **Estado**: **en curso** (2026-11-04). `factura-proveedor-dialog.tsx` 1964 → 835.
- **Evidencia**: Eje 4.
- **Alcance**: extraer subcomponentes y hooks con responsabilidad única, sin
  cambiar comportamiento ni estilos. Una extracción por commit, cada una con su
  verificación.
- **Aceptación**: cada archivo queda por debajo de 500 líneas; cero cambios de
  comportamiento observables; los tests del módulo verdes en cada paso.
- **Verificación**: `npm run lint`, `npm run build`, tests del módulo, y una
  prueba manual del flujo de carga de factura contra el baseline.
- **Riesgo**: medio-alto. Es el flujo con más lógica de UI del sistema; se hace
  por partes, nunca de una.
- **Progreso**:
  1. `factura-proveedor-helpers.ts` — 142 líneas de helpers puros.
  2. `factura-upload-pane.tsx` — 176 líneas, vista de carga/escáner.
  3. `factura-item-row.tsx` — 493 líneas, la fila de ítem completa.
  4. `factura-resumen-lateral.tsx` — 233 líneas, preview y resumen.
  5. `factura-datos-generales.tsx` — 322 líneas, formulario de cabecera.
  6. `factura-companion-dialogs.tsx` — 173 líneas, los tres diálogos que
     acompañan la revisión.
  - Sin cambios de comportamiento: cada bloque se movió con el JSX idéntico y las
    dependencias del padre pasan por un objeto `ctx` tipado, así los nombres
    internos se conservan y el diff es un movimiento, no una reescritura.
  - Verificación por slice: `tsc` y `eslint` en cero. Build completo tras el
    lote: `Compiled successfully`.
- **Pendiente para cerrarla**:
  7. El panel de revisión restante (progreso + filtros + contenedor de la lista,
     ~130 líneas de JSX con una dependencia de ~30 valores). Se evaluó y se dejó
     para después: el costo del `ctx` supera el beneficio frente a la deuda que
     queda.
  8. **Los hooks de estado y efectos** (~450 líneas). Es el único camino para
     bajar de 500 y el más delicado: mover efectos puede cambiar el orden de
     ejecución.
  9. `productos-view.tsx` (1829 líneas) sigue **intacto**. Es un trabajo
     comparable al del diálogo y no se empezó.
  - Nota de criterio: la meta es cohesión, no el número.

### M09 — Triar los 328 `TODO` y las menciones de `legacy`

- **Prioridad** P2 · **Esfuerzo** S (incremental) · **Dependencias** ninguna
- **Evidencia**: 328 `TODO` en `src/`; 41 menciones de `legacy`.
- **Alcance**: triage, no borrado ciego. Convertir los vigentes en tareas con ID;
  eliminar los obsoletos; dejar los que tengan justificación escrita.
- **Aceptación**: cada `TODO` vigente apunta a una tarea o a una decisión; no
  queda ninguno huérfano.
- **Verificación**: conteo antes/después y listado de los que quedan con motivo.

### M10 — Acotar los `findMany` sin `take` en endpoints de listado

- **Prioridad** P2 · **Esfuerzo** M · **Dependencias** M01
- **Evidencia**: 27 routes con `findMany` sin `take`. Excluyendo cron y auth
  (legítimos por diseño), quedan: `clientes`, `consignaciones/[id]`,
  `facturas-proveedor`, `gastos`, `gastos/categorias`, `historial`,
  `historial/anios`, `liquidaciones/[id]`, `liquidaciones/consignacion/[id]`,
  `pedidos-esperados`, `proveedores`, `security/sessions`, `settings/plan-limits`,
  `settings/pos/cajas`, `settings/pos/horarios`, `settings/sucursales`,
  `categorias`, `subcategorias`, `subscriptions/plans`.
- **Alcance**: paginación o cota explícita donde el volumen pueda crecer.
  `categorias`, `subcategorias` y `plans` pueden quedar con cota alta justificada.
- **Aceptación**: cada endpoint de listado tiene cota o paginación declarada, y
  la respuesta mantiene compatibilidad con el cliente.
- **Verificación**: tests de contrato por endpoint + medir tiempo de respuesta
  con volumen sembrado.
- **Riesgo**: medio. Cambia contratos de respuesta; requiere coordinar con
  `apiService`.

### M11 — Validación uniforme con Zod en las rutas que mutan

- **Prioridad** P2 · **Esfuerzo** M · **Dependencias** M01
- **Evidencia**: 25 de 114 routes referencian Zod; hay 77 routes con métodos de
  escritura.
- **Alcance**: inventariar qué rutas de escritura no validan con esquema y
  agregar validación en el borde, sin cambiar la forma de la respuesta de error.
- **Aceptación**: toda ruta de escritura valida con un esquema declarado; test
  por ruta con un payload inválido devolviendo 400.
- **Verificación**: los tests nuevos + `npm run lint`.
- **Nota**: antes de esta tarea conviene confirmar cuántas rutas ya validan a
  mano; el número real puede ser menor que 52.

### M12 — Extraer el segundo módulo con el molde de ventas

- **Prioridad** P1 · **Esfuerzo** XL · **Dependencias** M01, M03
- **Evidencia**: 93 de 114 routes (82 %) hablan Prisma directo; 15 pasan por
  `modules/`; `modules/` es 5 % del código. El patrón correcto ya existe en
  `src/modules/ventas/` (`register-sale.ts:164` unidad de trabajo,
  `prisma-register-sale.ts:192` adaptador).
- **Alcance**: elegir **un** flujo de alto riesgo (consignaciones o gastos),
  extraerlo con el mismo patrón, y dejar el molde documentado para lo que venga.
- **Aceptación**: el flujo elegido tiene caso de uso puro con dependencias
  inyectadas, adaptador de persistencia aislado, y tests del caso de uso sin
  base de datos.
- **Verificación**: tests del caso de uso + paridad de contrato HTTP contra el
  baseline (differential check).
- **Riesgo**: alto. Es el cambio más grande del backlog; no empezar sin M01 y
  M03 cerradas.

### M13 — Índices compuestos para las consultas del dashboard

- **Prioridad** P0 · **Esfuerzo** S · **Dependencias** ninguna (medir después de
  M01 si se quiere baseline reproducible)
- **Estado**: **cerrada** (2026-11-04). Migración
  `20261104190000_venta_pago_sucursal_fecha_index`, verificada sobre el dump real
  y aplicada al clúster descartable. **No desplegada a producción.**
- **Evidencia**: `prisma/schema.prisma` declara `@@index([sucursalId])` y
  `@@index([clienteId, fecha])` en `Venta`, y `@@index([sucursalId])` en `Pago`,
  pero la consulta caliente es `(sucursalId, fecha, anulada)`
  (`src/lib/dashboard/kpi-logic.ts:499-514`). `MovimientoStock` tiene
  `(sucursalId)` y `(createdAt)` separados.
- **Alcance**: migración **aditiva** con `(sucursalId, fecha)` en `Venta` y
  `Pago`. Evaluar cada índice contra el plan real antes de mergear; no agregar
  índices que el planner ignore.
- **Aceptación**: `EXPLAIN (ANALYZE, BUFFERS)` antes/después sobre un dataset
  representativo muestra que la consulta deja de hacer scan con filtro; la
  migración aplica y revierte sin pérdida.
- **Verificación**: los dos planes adjuntos al cierre de la tarea + `npm run
  migrate:t11:preflight` (o el preflight vigente) sobre un entorno descartable.
- **Riesgo**: bajo en lectura, medio en escritura por el costo de mantener el
  índice. Nunca editar una migración ya mergeada; siempre una nueva.
- **Infraestructura de medición (2026-11-04)**: base descartable lista.

  - Dump tomado de Railway (`POS - Import.VPS`, ambiente `production`, servicio
    `Postgres`, PostgreSQL 17.11) con `pg_dump` en formato custom: **4 MB**,
    guardado en `%TEMP%\consignacion-bench\prod-2026-11-04.dump` (fuera del repo).
  - Restaurado en un clúster PostgreSQL **18** descartable inicializado en
    `%TEMP%\consignacion-bench\pgdata`, puerto **55432**, usuario `bench`,
    autenticación `trust`. No toca la instalación local.
  - **Datos reales restaurados**: 922 `Venta`, 1.163 `VentaDetalle`, 922 `Pago`,
    1.828 `MovimientoStock`, 248 `Producto`, 11 `Cliente`, 4 `Sucursal`.
    Rango de ventas: 2026-03-01 a 2026-11-03.
  - **Corrección**: la primera lectura desde producción mostró "17 ventas" porque
    se leyó `pg_stat_user_tables.n_live_tup`, que era una estadística vieja. Los
    conteos reales (`count(*)`) son los de arriba; siempre verificar con
    `count(*)`, nunca con `n_live_tup`.
  - **Conclusión para la aceptación**: 922 ventas ocupan 18 páginas de heap
    (144 kB). Medido con `EXPLAIN (ANALYZE, BUFFERS)` el 2026-11-04 sobre la base
    restaurada, el resultado **no** es el que yo había anticipado:

    | Consulta | Antes | Después del índice |
    | --- | --- | --- |
    | `Venta` sucursal 1, un mes | `Venta_clienteId_fecha_idx` + Filter `sucursalId`, 51 filas descartadas, **20 buffers** | `(sucursalId, fecha)`, 1 fila descartada, **10 buffers** |
    | `Pago` sucursal 1, un mes | `Pago_clienteId_fecha_idx` + Filter `sucursalId`, 50 filas descartadas, **19 buffers** | `(sucursalId, fecha)`, **9 buffers** |
    | `Venta` vista global, 8 meses | Seq Scan, 18 buffers | **Seq Scan, 18 buffers (sin cambio)** |
    | `Pago` vista global, 8 meses | Seq Scan, 9 buffers | **Seq Scan, 9 buffers (sin cambio)** |
    | `Venta` sin filtro de fecha | Seq Scan, 18 buffers | **Seq Scan, 18 buffers (sin cambio)** |

  - **Lectura correcta**: el backup **sí alcanza** para justificar el índice. El
    planner lo elige para la consulta caliente documentada (sucursal + rango de
    fechas) en `Venta` y en `Pago`, y deja de descartar ~50 filas por el filtro de
    sucursal. Los buffers se reducen a la mitad.
  - **Lo que NO alcanza**: cuantificar la mejora en tiempo absoluto (0,18 ms →
    0,14 ms es ruido de medición) y predecir el comportamiento de la vista global
    con años de histórico. Con 922 filas ningún plan es caro.
  - **Hallazgo de diseño**: el índice compuesto **no ayuda a la vista global** a
    este tamaño, porque esa consulta selecciona 892 de 922 filas (97 %). Es la
    decisión correcta del planner. A volumen real (cientos de miles de ventas en
    varios años), una ventana de 8 meses sí sería selectiva y el índice pasaría a
    usarse; pero eso no se puede demostrar con estos datos y no se afirma.
  - **Decisión**: se procede con `(sucursalId, fecha)` en `Venta` y `Pago` por
    evidencia de selección de plan, no por una mejora de tiempo medida.
    `MovimientoStock` **no** se toca: sus consultas no son por rango de fecha y no
    hay medición que lo respalde.
  - **Volumen sintético**: no es necesario para cerrar M13. Se reserva para M14,
    donde la comparación de agregación en SQL sí necesita volumen para mostrar
    diferencia.

### M14 — Mover la agregación del dashboard a SQL

- **Prioridad** P1 · **Esfuerzo** M · **Dependencias** M13
- **Estado**: **cerrada** (2026-11-04). Commit
  `perf(dashboard): aggregate trend and top products in SQL`.
- **Evidencia**: `getDashboardTendencia` (`kpi-logic.ts:499-570`) carga todas las
  ventas del período con `detalles` anidados y acumula en un `for`;
  `getDashboardTopProductos` (`kpi-logic.ts:597+`) trae todos los
  `liquidacionItem`/`ventaDetalle` y ordena en memoria para devolver `limit`.
- **Alcance**: reemplazar la acumulación en Node por `groupBy`/`aggregate` por
  día y por producto; usar `$queryRaw` donde Prisma no alcance (el repo ya lo usa
  en 31 archivos, así que no introduce un patrón nuevo).
- **Aceptación**: los números son **idénticos** a los del baseline para el mismo
  dataset y rango (differential check, no "parecidos"), y el p95 de la ruta baja
  respecto del baseline medido.
- **Verificación**: script de comparación viejo-vs-nuevo sobre el mismo rango +
  `kpi-logic.integration.test.ts` verde.
- **Riesgo**: medio-alto. Si un decimal se redondea distinto, el dashboard miente.
  La paridad numérica es criterio de aceptación, no un extra.
- **Resultado**:
  - `getDashboardTendencia`: tres CTE (`por_dia`, `unidades`, `pagos`) agrupadas
    por día calendario; la serie con días en cero se sigue armando en JS.
  - `getDashboardTopProductos`: `UNION ALL` de consignación y POS, agrupado por
    producto, ordenado y limitado en SQL.
  - **Bucketing de fecha**: las fechas se guardan como hora local en una columna
    `timestamp` sin zona, y Prisma las lee como UTC. El día calendario es
    `fecha AT TIME ZONE 'UTC' AT TIME ZONE <tz>`, que reproduce exactamente lo
    que hacía `formatDateInputAR(v.fecha, tz)`. Verificado empíricamente: hay
    ventas en las 24 horas del día, así que son hora local, no UTC.
  - **Filas que cruzan la frontera**: de O(ventas del período) a O(días), y de
    O(detalles) a O(`limit`). Ese es el beneficio real; con 922 ventas no hay
    diferencia de tiempo medible.
- **Evidencia de paridad** (harness diferencial contra el dump restaurado, 42
  escenarios = 3 alcances × 5 períodos × 3 salidas):
  - **21/21 escenarios de `tendencia` idénticos al centavo.**
  - **0 diferencias de valor** en `top*` (units, total y nombre por producto).
  - Único cambio: qué producto entra cuando hay **empate en el corte** (10 casos)
    y el orden entre empatados (6 escenarios). Ese orden nunca fue determinista:
    la consulta original usaba `findMany` sin `ORDER BY`, así que dependía del
    orden físico de Postgres. La versión SQL es determinista y desempata por
    origen (consignación antes que POS) y luego por primer `id` que aportó.
  - Herramientas agregadas: `scripts/kpi-parity.ts` (captura) y
    `scripts/kpi-parity-compare.mjs` (compara con el criterio de arriba), para
    poder repetir la verificación si se vuelve a tocar el dashboard.
- **Deuda honesta**: no se pudo demostrar una mejora de p95 porque la base tiene
  922 ventas. El criterio que sí se cumple y se mide es la cantidad de filas
  transferidas, que escala con el histórico en la versión vieja y no en la nueva.

### M15 — Medir el bundle y fijar presupuesto por ruta

- **Prioridad** P1 · **Esfuerzo** M · **Dependencias** M01
- **Estado**: **cerrada** (2026-11-04). `scripts/check-bundle-budget.mjs` +
  `bundle-budget.json`.
- **Evidencia**: 42 de 47 páginas son cliente; `src/lib/apiService.ts` (1.225
  líneas) lo importan 50 archivos; 46 de 47 usos de `motion/react` están en
  componentes cliente. Nunca se midió First Load JS.
- **Alcance**: medir First Load JS por ruta con el build de producción, registrar
  el baseline en este documento, fijar un presupuesto por tipo de ruta y dejarlo
  como chequeo.
- **Aceptación**: tabla de baseline por ruta; presupuesto declarado; una ruta que
  lo exceda produce un fallo visible.
- **Verificación**: `npm run build` con el reporte y la tabla comparada contra el
  baseline.
- **Nota**: **medir antes de optimizar**. Sin baseline, cualquier "mejora de
  bundle" es una opinión.
- **Resultado**:
  - **Turbopack no imprime tamaños.** A diferencia de webpack, `next build` no
    muestra la tabla de "First Load JS". Por eso el medidor es propio.
  - **Cómo mide**: Next genera un `*_client-reference-manifest.js` por ruta con
    `entryJSFiles` (chunks del root layout, layouts anidados y página). Se toma la
    unión, se comprime cada chunk con gzip y se suma. 49 rutas medidas.
  - **Baseline** (`bundle-budget.json`), las más pesadas:

    | Ruta | KB gzip | Chunks |
    | --- | --- | --- |
    | `/settings/branding` | 312,5 | 12 |
    | `/productos` | 239,1 | 16 |
    | `/proveedores` | 236,8 | 16 |
    | `/settings/tienda` | 227,5 | 14 |
    | `/proveedores/[id]` | 224,6 | 16 |
    | `/dashboard` | 213,2 | 14 |
    | `/pedidos-esperados` | 211,6 | 15 |
    | `/ventas/nueva` | 191,7 | 13 |

  - **Presupuesto**: dos reglas combinadas, porque un techo absoluto solo no
    detecta crecimientos silenciosos.
    1. `defaultMaxKB: 350` — ninguna ruta puede pasar ese techo.
    2. `maxGrowthKB: 10` — ninguna ruta puede crecer más de 10 KB sobre su
       baseline, aunque quede debajo del techo.
  - **Comandos**: `npm run bundle:check` (falla con exit 1 si hay violación) y
    `npm run bundle:baseline` (regenera el baseline tras un cambio deliberado).
  - **Canario ejecutado**: bajando el baseline de `/dashboard` a 100 KB, el check
    responde `/dashboard: 213.2 KB > 110 KB` y sale 1. No es un falso verde.
  - **Hallazgo del camino**: `JSON.parse` explota con BOM y un editor de Windows
    lo agrega solo. El script ahora lo tolera.
- **Lo que este número habilita**: cualquier discusión sobre migrar a RSC (M06) ya
  tiene una medición. La ruta más pesada es `/settings/branding` con 312 KB, no el
  POS ni el dashboard. Si algún día se reabre M06, el candidato obvio es esa
  pantalla, no las que se suponían.

### M16 — Justificar o eliminar `force-dynamic`

- **Prioridad** P2 · **Esfuerzo** S · **Dependencias** M06
- **Evidencia**: 16 archivos con `export const dynamic`, incluido
  `src/app/(system-guard)/layout.tsx`, que envuelve toda la app protegida.
- **Alcance**: clasificar cada uno en "necesario por sesión/datos por request" o
  "puede ser estático/revalidado". No tocar los protegidos sin un reemplazo
  equivalente de la verificación de sesión.
- **Aceptación**: cada `force-dynamic` tiene una razón escrita de una línea, o se
  elimina con evidencia de que nada se rompe.
- **Verificación**: navegación autenticada de los flujos principales después de
  cada cambio + build.
- **Riesgo**: medio. Sacar `force-dynamic` de un layout con auth puede servir HTML
  cacheado a un usuario equivocado. Es exactamente el tipo de cambio que necesita
  verificación independiente.

### M17 — Convertir Web Vitals en presupuesto con alarma

- **Prioridad** P2 · **Esfuerzo** M · **Dependencias** M15
- **Evidencia**: `src/lib/performance-vitals-store.ts` ya calcula p50/p75/p95 y
  `src/components/performance-vitals.tsx` los reporta a
  `/api/performance/vitals`; no existe umbral ni gate.
- **Alcance**: definir umbrales de p75 para LCP, INP y CLS, y un chequeo que
  detecte rutas por encima. Empezar por las tres rutas más usadas (POS,
  dashboard, catálogo).
- **Aceptación**: umbral escrito; un reporte que muestre p75 real por ruta contra
  el umbral; una ruta en violación se detecta sin intervención manual.
- **Verificación**: consultar el endpoint con datos reales y adjuntar la tabla.
- **Nota**: no construir un tablero nuevo; la recolección ya existe. El trabajo es
  el umbral y la acción.

---

## Matriz de aislamiento por sucursal (M03)

Los 22 archivos que tocan modelos con `sucursalId` sin pasar por
`src/lib/security/sucursalScope.ts`, clasificados uno por uno.

**Convención de veredicto:**

- **Correcto**: filtra por sucursal, o valida explícitamente que el recurso
  pertenece a la sucursal activa.
- **Corregido**: tenía un hueco y se arregló en esta tarea.
- **Público por diseño**: expone datos de la tienda o un recurso firmado; la
  sucursal no es un límite de seguridad ahí.
- **Proceso por diseño**: corre con secreto de cron sobre todas las sucursales.

| Archivo | Modelos | Filtro aplicado | Veredicto |
| --- | --- | --- | --- |
| `src/lib/ocr/matching-engine.ts` | `Producto`, `ProductoProveedorAlias` | catálogo por `sucursalId`; **alias sin filtro** | **Corregido**: los alias podían apuntar a un producto de otra sucursal y el matcher lo proponía. Lo frenaba el guard de `confirm`, no el origen |
| `src/lib/storefront/public-catalog.ts` | `Configuracion`, `StoreSettings`, `Producto`, `Categoria` | sucursal resuelta desde el slug | Público por diseño (catálogo de la tienda) |
| `src/lib/subscriptions/require-subscription.ts` | `Subscription`, `Producto`, `Usuario`, `FacturaProveedor` | conteos por instalación, sin sucursal | Correcto por diseño: los límites del plan son de la instalación (decisión 1) |
| `src/app/api/catalog/route.ts` | `Producto`, `Configuracion` | `sucursalId` de query (default 1) | Público por diseño (catálogo público) |
| `src/app/api/public/checkout/route.ts` | `Configuracion`, `Producto`, `Cliente` | `sucursalId` del body | Público por diseño (checkout de la tienda) |
| `src/app/api/consignaciones/[id]/remito-link/route.ts` | `Consignacion`, `ShareLink` | `sucursalId: auth.activeSucursalId` | Correcto |
| `src/app/api/cron/check-vencimientos/route.ts` | `Producto`, `Notification`, `Subscription` | itera sucursales con `CRON_SECRET` | Proceso por diseño |
| `src/app/api/cron/consignaciones/route.ts` | `Consignacion`, `Notification` | idem | Proceso por diseño |
| `src/app/api/dashboard/consignaciones/route.ts` | `Consignacion`, `Liquidacion` | `sucursalWhere` con soporte de vista global | Correcto |
| `src/app/api/facturas-proveedor/items/[id]/confirm/route.ts` | `Producto`, `FacturaProveedorItem` | `canAccessSucursalResource` + `producto.sucursalId === item.factura.sucursalId` | Correcto |
| `src/app/api/gastos/[id]/comprobante-link/route.ts` | `Gasto`, `ShareLink` | `sucursalId` propio o `gastosCompartidos.some` | Correcto |
| `src/app/api/gastos/categorias/[id]/route.ts` | `CategoriaGasto`, `Gasto` | comparación explícita contra `activeSucursalId` | Correcto |
| `src/app/api/productos/barcode/[code]/route.ts` | `Producto` | `sucursalId: auth.activeSucursalId` | Correcto |
| `src/app/api/settings/pos/cajas/route.ts` | `Caja` | `sucursalId` en lectura y en alta | Correcto |
| `src/app/api/settings/pos/cajas/turno/route.ts` | `SesionCaja`, `Caja`, `HorarioLaboral` | `caja.sucursalId`, validación explícita y `$queryRaw` con `sucursalId` | Correcto |
| `src/app/api/ventas/[id]/ticket-link/route.ts` | `Venta`, `ShareLink` | `sucursalId: auth.activeSucursalId` | Correcto |
| `src/app/ver/consig/[period]/pdf/route.ts` | `Consignacion`, `StockSucursal`, `Cliente`, `Liquidacion` | `sucursalWhere` en las 10 consultas | Público por diseño (share link firmado) |
| `src/app/ver/dashboard/[period]/pdf/route.ts` | `Consignacion`, `Venta`, `Gasto`, `GastoSucursal` | `sucursalWhere` / `scopedSucursalId` con `isGlobal` | Público por diseño (share link firmado) |
| `src/app/ver/pos/[period]/pdf/route.ts` | `Venta`, `Pago`, `Gasto`, `GastoSucursal`, `VentaDetalle` | idem | Público por diseño (share link firmado) |
| `src/app/ver/gasto/[id]/route.ts` | `Gasto` | `verifyPdfToken(id, token)` | Público por diseño (token firmado) |
| `src/app/ver/remito/[id]/route.ts` | `Consignacion` | `verifyPdfToken(id, token)` | Público por diseño (token firmado) |
| `src/app/ver/ticket/[id]/route.ts` | `Venta` | `verifyPdfToken(id, token)` | Público por diseño (token firmado) |

**Lectura del resultado:** el aislamiento por sucursal estaba bien resuelto en
21 de 22 archivos. El único hueco real no era de autorización clásica sino de
procedencia de datos: un alias de proveedor podía venir de otra sucursal y el
motor lo proponía como candidato. No era explotable porque `confirm` revalida
`producto.sucursalId`, pero dependía de que ese guard existiera para siempre.
Ahora el filtro está en el origen.

**Lo que esta matriz NO prueba:** el comportamiento en runtime con dos sucursales
reales. Para eso hace falta un test de integración con `TEST_DATABASE_URL` que
cree datos en sucursal A y B y verifique que un usuario de A no los ve. Queda
como verificación pendiente de M03 y es la deuda honesta de esta tarea.

---

## Secuencia propuesta

| Orden | Tarea | Por qué ahora |
| --- | --- | --- |
| 1 | M01 | Sin suite, todo lo demás se hace a ciegas |
| 2 | M02 | Cumple lo que la documentación ya promete |
| 3 | M03 | Desbloquea la segunda sucursal con evidencia, no con fe |
| 4 | M05 | Cierra la brecha doc/código una sola vez |
| 5 | M06 | Decisión barata que evita meses de trabajo mal orientado — **cerrada: SPA** |
| 6 | M13 | Índices: la mejora más barata de todo el backlog |
| 7 | M15 | Medir bundle antes de tocar render |
| 8 | M14 | Aggregación en SQL, con paridad numérica como criterio |
| 9 | M04 | Toca datos: necesita ventana propia |
| 10 | M08 | Reduce el archivo más peligroso del repo |
| 11 | M09 | Barrido incremental, se puede intercalar |
| 12 | M10 | Coordina con `apiService` |
| 13 | M11 | Después de saber cuántas rutas ya validan |
| 14 | M16 | `force-dynamic`: al final, es el más delicado de render |
| 15 | M17 | Necesita el baseline de M15 |
| 16 | ~~M07~~ | Cancelada por M06: el ADR eligió SPA |
| 17 | M12 | El más grande; va último y con presupuesto propio |
| 18 | M18 | Resto de los módulos sin auditar; mismo patrón que M02 |

Bloque de mejor ROI: **M01 → M02 → M03 → M05 → M06 → M13**, aproximadamente una
semana y media de trabajo efectivo. Los dos últimos cierran las dos brechas más
caras de justificar ante un cliente: auditoría que no existe y consultas que no
escalan.

Bloque de performance, en orden estricto: **M13 (índices) → M15 (medir) → M14
(SQL) → M16 (render) → M17 (umbral)**. Medir antes de optimizar, y nunca al revés.

## Riesgos del backlog

1. **M03 y M04 tocan autorización y datos.** Cualquier cambio requiere verificación
   independiente y plan de rollback antes de mergear.
2. **M12 mal ejecutada empeora el sistema.** Extraer un módulo sin tests previos
   (M01) ni aislamiento verificado (M03) traslada el problema en lugar de
   resolverlo.
3. **M07 puede ser trabajo tirado.** Si M06 no la autoriza explícitamente, no se
   hace.
4. **M14 puede cambiar números.** Si la agregación en SQL redondea distinto que el
   acumulador en JS, el dashboard queda mal sin lanzar ningún error. La paridad
   numérica contra el baseline es criterio de aceptación obligatorio.
5. **M16 puede filtrar datos entre usuarios.** Sacar `force-dynamic` de un layout
   con auth y servir HTML cacheado a otro usuario es un incidente de seguridad, no
   de performance. Requiere verificación independiente.
6. **Optimizar sin medir es gastar a ciegas.** Ninguna tarea de performance se
   cierra sin su medición antes/después adjunta. "Quedó más rápido" no es
   evidencia.
7. **El baseline envejece.** Cada `archivo:línea` de este documento se revalida
   antes de ejecutar la tarea correspondiente; las líneas cambian y la evidencia
   caduca.
