# Plan y estado de tareas

Baseline: `main` en `f29298eb20c54b0ca11368ce219bd70bb8e8e386`, árbol limpio,
2026-11-04.

## Estado general

Diagnóstico cerrado. **Ninguna tarea está autorizada.** Cada tarea requiere
autorización explícita e individual antes de empezar, y su verificación se
declara antes de escribir código, no después.

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
problema no es la lista: es que **nadie clasificó la lista**. Sin ese veredicto
por archivo no se puede afirmar que el aislamiento es correcto, y es exactamente
lo que se rompe al operar con la segunda sucursal.

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

### M03 — Clasificar el aislamiento por sucursal de los 22 archivos

- **Prioridad** P0 · **Esfuerzo** M · **Dependencias** M01
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

### M04 — Corregir la suscripción atada al usuario

- **Prioridad** P1 · **Esfuerzo** M · **Dependencias** M03
- **Evidencia**: `Subscription.userId @unique` en `prisma/schema.prisma`;
  `src/lib/subscriptions/require-subscription.ts`.
- **Alcance**: definir y documentar qué pasa con la suscripción cuando cambia el
  usuario dueño o cuando el dueño es dado de baja. Si hace falta, migrar el
  anclaje a una entidad estable de la instalación (no un tenant: ver decisión 1).
- **Aceptación**: existe una regla escrita; el comportamiento de
  `require-subscription.ts` coincide con la regla; test que cubre el caso de
  cambio de dueño.
- **Verificación**: tests nuevos + revisión de la migración con plan de rollback.
- **Riesgo**: alto. Toca datos persistidos; requiere migración reversible.

### M05 — Alinear el `README.md` con la realidad del sistema

- **Prioridad** P0 · **Esfuerzo** S · **Dependencias** M02, M03
- **Evidencia**: Eje 6.
- **Alcance**: (a) aclarar que la unidad de despliegue es una instalación por
  comercio; (b) ajustar la afirmación de auditoría al estado real o, si M02 ya
  cerró, al alcance exacto cubierto; (c) corregir la tabla de stack (Server
  Actions); (d) declarar el modelo de render.
- **Aceptación**: ninguna afirmación del README queda sin respaldo en el código.
- **Verificación**: recorrer el README contra el código, ítem por ítem.
- **Nota**: barata y de alto retorno. Va después de M02 para no documentar dos
  veces.

### M06 — ADR: modelo de render (SPA vs RSC)

- **Prioridad** P1 · **Esfuerzo** S · **Dependencias** M05
- **Evidencia**: Eje 5.
- **Alcance**: decisión explícita con consecuencias. Si se elige SPA, se
  documenta y se cierra el tema. Si se elige RSC parcial, se listan las pantallas
  candidatas (dashboard y listados con waterfall) y nace M07.
- **Aceptación**: ADR en `odd/mejoras-arquitectura/adrs/` con contexto, decisión,
  alternativas y consecuencias.
- **Verificación**: revisión humana del ADR. No hay verificación automática.

### M07 — Migrar dashboard y listados a Server Components (condicional)

- **Prioridad** P2 · **Esfuerzo** L · **Dependencias** M06 (solo si el ADR lo
  elige explícitamente)
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
- **Evidencia**: `prisma/schema.prisma` declara `@@index([sucursalId])` y
  `@@index([clienteId, fecha])` en `Venta`, y `@@index([sucursalId])` en `Pago`,
  pero la consulta caliente es `(sucursalId, fecha, anulada)`
  (`src/lib/dashboard/kpi-logic.ts:499-514`). `MovimientoStock` tiene
  `(sucursalId)` y `(createdAt)` separados.
- **Alcance**: migración **aditiva** con `(sucursalId, fecha)` en `Venta` y
  `Pago`, más `(sucursalId, createdAt)` en `MovimientoStock`. Evaluar cada índice
  contra el plan real antes de mergear; no agregar índices que el planner ignore.
- **Aceptación**: `EXPLAIN (ANALYZE, BUFFERS)` antes/después sobre un dataset
  representativo muestra que la consulta deja de hacer scan con filtro; la
  migración aplica y revierte sin pérdida.
- **Verificación**: los dos planes adjuntos al cierre de la tarea + `npm run
  migrate:t11:preflight` (o el preflight vigente) sobre un entorno descartable.
- **Riesgo**: bajo en lectura, medio en escritura por el costo de mantener el
  índice. Nunca editar una migración ya mergeada; siempre una nueva.

### M14 — Mover la agregación del dashboard a SQL

- **Prioridad** P1 · **Esfuerzo** M · **Dependencias** M13
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

### M15 — Medir el bundle y fijar presupuesto por ruta

- **Prioridad** P1 · **Esfuerzo** M · **Dependencias** M01
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

## Secuencia propuesta

| Orden | Tarea | Por qué ahora |
| --- | --- | --- |
| 1 | M01 | Sin suite, todo lo demás se hace a ciegas |
| 2 | M02 | Cumple lo que la documentación ya promete |
| 3 | M03 | Desbloquea la segunda sucursal con evidencia, no con fe |
| 4 | M05 | Cierra la brecha doc/código una sola vez |
| 5 | M06 | Decisión barata que evita meses de trabajo mal orientado |
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
| 16 | M07 | Solo si M06 lo elige |
| 17 | M12 | El más grande; va último y con presupuesto propio |

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
