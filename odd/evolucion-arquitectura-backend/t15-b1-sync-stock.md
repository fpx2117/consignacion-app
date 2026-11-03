# T15-I — Retiro de `sync-stock`

## Objetivo

Eliminar las dos últimas herramientas que escribían `Producto` directamente
fuera del puente `B1` y de la compensación T14.

## Por qué se retiran

`POST /api/admin/sync-stock` y `scripts/sync-stock.ts` recalculaban
`Producto = SUM(StockSucursal)` producto por producto, con estas fallas:

- No leían `StockAutoridad`: escribían aunque la capacidad estuviera ausente,
  desconocida o incompatible.
- No abrían transacción ni tomaban locks: un writer de `B1` podía incrementar
  `StockSucursal` y aplicar su delta entre la lectura y la escritura del
  reparador, dejando el `Producto` en el valor viejo (lost update).
- Bajo `DB_PROJECTION` competían con el trigger: el trigger proyectaba el valor
  nuevo y el reparador escribía el `SUM` que había leído antes.
- No verificaban deriva posterior ni exigían confirmación del destino.

Ninguno de los dos tenía caller en la aplicación: eran herramientas operativas
manuales.

## Reemplazo

La reparación global válida es
`scripts/migrations/compensate-t14-stock-authority.mjs`:

- Exige `DATABASE_URL` y confirmación exacta de la base; sólo acepta host local
  con base terminada en `test` salvo `T14_ALLOW_PRODUCTION=true`.
- Toma `pg_advisory_xact_lock`, bloquea la capacidad con `FOR UPDATE` y luego
  `StockSucursal -> Producto` en `ACCESS EXCLUSIVE` (orden fijo).
- Desactiva el trigger de proyección, reconcilia ambos campos globales, deja la
  capacidad en `APP_DUAL_WRITE` y falla si queda deriva.
- Tiene timeout de lock y rollback total.

En `DB_PROJECTION` no hace falta reparar: el trigger mantiene el invariante. La
compensación es una transición de modo, no un reparador genérico de esa fase.
## Contrato implementado

- La ruta conserva `requireAuth` y el gate `ADMIN`; no importa Prisma, no toca
  ninguna API de stock y responde `410 Gone` con el comando de compensación. Las
  únicas lecturas son las de autenticación y sucursal.
- `scripts/sync-stock.ts` no abre conexión, imprime el procedimiento correcto y
  sale con código `2`.
- Escaneo Prisma: en los archivos de producción `.ts/.tsx/.mts` de `src/` y
  `scripts/` (se excluyen tests y fixtures, que siembran deriva a propósito),
  ningún `producto.update|updateMany|upsert` puede escribir
  `stockDisponibleUnits`/`stockConsignadoUnits`. Dentro de `stock-authority.ts`
  sólo se admiten deltas (`increment`/`decrement`), el módulo no puede agregar
  `StockSucursal` ni usar SQL crudo de escritura (`$executeRaw`/
  `$queryRawUnsafe`).
- El escaneo falla también si un `data:` hace spread de un identificador no
  probado, si recibe los datos de forma indirecta (`data: variable`), o si un
  spread calculado menciona un campo de stock. El identificador se acepta sólo si
  viene de un rest que excluyó `stockDisponibleUnits`; un test aparte fija que
  `validators/producto.ts` no expone `stockConsignadoUnits`, que es lo que hace
  suficiente esa exclusión.
- Escaneo SQL: en `.mjs/.js/.cjs` de `src/` y `scripts/`, un
  `UPDATE|INSERT ... "Producto" ... stock*` sólo se tolera en la tooling T14
  (`compensate-*` y `verify-*`), porque los reparadores del repo son `.mjs`.
- Las creaciones (`producto.create`) quedan fuera a propósito: inicializan una
  fila nueva, sin representación previa de la que divergir, y están cubiertas por
  las integraciones de T15-F/T15-G.
- Límite declarado: clientes Prisma renombrados, SQL armado por concatenación y
  datos construidos y pasados como objeto (cubierto por la regla de `data:`
  indirecto, no por contenido) quedan para la revisión manual del rollout.

## Pruebas obligatorias

```bash
node --import tsx --test src/modules/inventory/producto-stock-writers.test.ts
node --import tsx src/app/api/admin/sync-stock/route.test.ts
npx tsc --noEmit
```

- La ruta no referencia Prisma ni campos de stock y devuelve `410`.
- El script no instancia cliente Prisma/pg y sale con `2`.
- Casos sintéticos del escaneo: escritura directa, spread sin destructuring,
  spread cubierto por destructuring, spread condicional de un literal sin stock,
  spread calculado con stock, `data:` indirecto, lectura en `select`/`where`,
  delta autorizado y asignación absoluta dentro del módulo de autoridad.
- El escaneo recorre el árbol y falla al inyectar un writer directo (verificado
  con una sonda temporal, retirada).

## Límite del reparador

`compensate-t14-stock-authority.mjs` **no** es un reparador genérico: retira el
trigger de proyección y deja la capacidad en `APP_DUAL_WRITE`. Ejecutarlo con T16
activo revierte el cutover. Bajo `DB_PROJECTION` el invariante lo mantiene el
trigger; si apareciera deriva por escrituras manuales, la resuelve el cutover, no
esta compensación. La advertencia está en la respuesta `410`, en la salida del
script y en este documento.

## Fuera de alcance

- T16, producción, commit, push y deploy.
- El baseline del visual guard: ya no aplica. El guard se retiró (ver la nota de
  tooling en `tasks.md`); el chequeo de tokens de diseño queda en
  `src/theme/know-design-system.test.ts`.
