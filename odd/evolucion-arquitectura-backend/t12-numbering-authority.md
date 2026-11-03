# T12-B — Autoridad PostgreSQL de numeración

## Objetivo

Instalar y verificar, únicamente en PostgreSQL 16 descartable, numeradores por
ámbito y triggers `BEFORE INSERT` que reemplacen los candidatos enviados por los
writers legacy sin renumerar datos existentes.

## Orden recomendado

1. Ejecutar la auditoría T12-A como diagnóstico previo.
2. Para un despliegue real futuro, exigir como precondición verificable que el
   puente T12-A esté desplegado en todas las instancias y que ninguna versión
   anterior pueda volver durante rollback. Esta etapa no verifica ni modifica un
   ambiente real.
3. Ejecutar una única migración atómica dentro de una ventana de mantenimiento.
   El operador debe cerrar ingress, cron, workers y webhooks, revocar temporalmente
   escritura al rol runtime y drenar sus sesiones antes de iniciar. Si migrador y
   runtime comparten rol, el despliegue queda bloqueado hasta separarlos.
4. En una única transacción, adquirir `SHARE ROW EXCLUSIVE` sobre
   `Consignacion` y luego `Venta`; repetir los preflight de datos, schema y
   triggers bajo esos locks; y recién entonces crear:
   - índice único
     `Venta_sucursalId_numeroVenta_key_t12` sobre
     `public."Venta"("sucursalId", "numeroVenta")`;
   - índice único `Consignacion_clienteId_numeroFolio_key_t12` sobre
     `public."Consignacion"("clienteId", "numeroFolio")`;
   - `VentaNumerador(sucursalId PRIMARY KEY, ultimoNumero)`;
   - `ConsignacionNumerador(clienteId PRIMARY KEY, ultimoNumero)`;
   - funciones de asignación atómica mediante `INSERT ... ON CONFLICT DO UPDATE
     ... RETURNING`;
   - triggers `BEFORE INSERT` que siempre reemplazan `NEW.numeroVenta` y
     `NEW.numeroFolio`;
   - guards `BEFORE UPDATE` que impiden cambiar número o ámbito de registros ya
     persistidos.
5. Verificar catálogo e invariantes y ejecutar smokes dentro de transacciones que
   siempre hacen rollback. Rehabilitar escritura sólo después de esas pruebas.
6. Mantener temporalmente todos los cálculos y advisory locks legacy.

`CREATE UNIQUE INDEX CONCURRENTLY` fue descartado para esta etapa: evita un lock
prolongado, pero separa índices y autoridad en commits distintos y exige una
recuperación combinada de catálogo e historial Prisma. La alternativa elegida
prioriza atomicidad: si preflight, índice, numerador, función o trigger falla,
PostgreSQL revierte TODO. El costo es una ventana de mantenimiento cuyo presupuesto
de lock y duración deberá aprobarse con métricas reales antes de cualquier deploy.

## Invariantes

- Ventas numeran independientemente por `sucursalId`.
- Consignaciones numeran independientemente por `clienteId`, no por sucursal.
- El primer número de un ámbito vacío es `1`.
- El primer número después de datos existentes es `MAX + 1`.
- El trigger siempre reemplaza candidatos locales, incluso si son nulos,
  repetidos o muy altos.
- Un rollback del alta revierte también el incremento del numerador.
- Los `Venta.numeroVenta` históricos nulos permanecen nulos.
- Nuevas ventas nunca quedan sin número mientras el trigger esté habilitado.
- Duplicados preexistentes abortan antes de instalar autoridad o índices.
- Los índices deben terminar `indisvalid = true` e `indisready = true`.
- El índice de ventas incluye filas nulas, pero PostgreSQL permite múltiples
  valores nulos en un índice único por defecto. Se evita así depender del preview
  `partialIndexes` de Prisma y el índice queda representable con `@@unique`.
- `Venta.sucursalId`, `Consignacion.clienteId` y ambos campos numéricos deben ser
  `NOT NULL` en el catálogo, salvo `Venta.numeroVenta`, que permanece nullable
  exclusivamente para registros históricos.
- Número y ámbito son inmutables después del insert. No existe hoy ningún writer
  de aplicación que los actualice o haga upsert por esas claves; esa ausencia se
  verifica nuevamente antes de instalar los guards.
- Los máximos existentes deben ser menores que `2147483647`; el agotamiento
  posterior falla cerrado por overflow y requiere una migración de tipo separada.
- No puede existir otro trigger de usuario `BEFORE INSERT` o `BEFORE UPDATE` sobre
  `Venta` o `Consignacion`; el preflight rechaza esa composición en vez de asumir
  un orden alfabético seguro.
- Las funciones usan únicamente referencias calificadas y `SECURITY DEFINER SET
  search_path = pg_catalog, pg_temp`. En la misma transacción se revoca `EXECUTE`
  a `PUBLIC` y todo acceso público a numeradores. El rol runtime no puede ser dueño
  de tablas, funciones o triggers ni poseer `TRIGGER`/DDL.

## Matriz que debe probarse

| Escenario | Resultado esperado |
| --- | --- |
| Base vacía | primera venta y consignación reciben `1` |
| Historial limpio | numeradores se inicializan con el máximo por ámbito |
| Candidatos legacy distintos | PostgreSQL devuelve y persiste el siguiente número autoritativo |
| Writer omite `numeroVenta` | el trigger asigna número |
| Dos ámbitos | ambos pueden usar el mismo número sin colisión |
| Concurrencia dentro de un ámbito | números únicos, sin duplicados ni incrementos perdidos |
| Transacción abortada | el número queda disponible para el siguiente alta |
| Duplicados existentes | migración rechazada y sin objetos parciales |
| Nulos históricos de venta | conservados; índice único completo válido con nulos distintos |
| Columna o ámbito nullable inesperado | instalación rechazada |
| Máximo `2147483647` | instalación rechazada antes de crear autoridad |
| UPDATE de número o ámbito | rechazado por guard, sin alterar numerador |
| Rol de aplicación restringido | puede insertar mediante trigger pero no modificar numeradores |
| Falla en índice o autoridad | rollback total; no queda ningún objeto T12-B |
| Otro trigger BEFORE en tablas objetivo | instalación rechazada |
| Rollback de esquema | con writers drenados, se retira autoridad y luego índices; la base se descarta |

## Rollback

El rollback de aplicación NO retira esta autoridad. Los archivos `rollback.sql`
son exclusivamente para ensayar una reversión de esquema deliberada en una base
descartable, con writers detenidos y conexiones drenadas. Se ejecutan en orden
inverso al deploy:

1. en una única transacción, bloquear primero `Consignacion` y luego `Venta`;
2. retirar guards, triggers, funciones, numeradores e índices;
3. comparar datos con el snapshot previo y descartar la base.

El ensayo valida schema y datos, pero luego descarta la base completa. No intenta
convertir esos `rollback.sql` en una reversión de `_prisma_migrations`: SQL inverso
no deshace el historial de Prisma y esa base no puede reutilizarse para deploy.

Nunca se ejecutará este rollback en un ambiente real sin una decisión posterior
que instale antes otro allocator único para todos los writers.

## Terminado cuando

Los criterios siguientes corresponden a los artefactos locales y se verifican en
PostgreSQL 16 descartable. El rollout operativo es T12-R y queda bloqueado hasta
contar con producción, roles separados, fence verificable y ventana aprobada.

- La prueba se observa RED antes de crear las migraciones y GREEN después.
- La matriz anterior pasa contra PostgreSQL 16 descartable.
- `prisma migrate status` queda limpio y los índices quedan válidos.
- El rollback de esquema descartable deja el schema previo sin alterar datos.
- Se fuerza un fallo tardío y se comprueba rollback total de todos los objetos
  T12-B.
- Se verifica con un rol restringido que el trigger funciona sin conceder acceso
  directo a numeradores ni funciones y sin capacidad de deshabilitar triggers.
- Una revisión adversarial no encuentra carreras, estado parcial silencioso ni
  ampliación hacia backfill o renumeración.

## Rollout operativo (T12-R, bloqueado)

No se ejecutó y no forma parte de los artefactos locales. Antes de intentarlo:

1. confirmar T12-A desplegado en todas las instancias;
2. separar roles migrador/runtime y verificar que runtime no es owner ni puede
   deshabilitar triggers ni acceder directo a numeradores;
3. disponer de un fence verificable: pausa de altas/modificaciones, drenaje de
   transacciones y ventana de mantenimiento aprobada;
4. ejecutar preflight y auditoría, `migrate deploy`, y verificar triggers,
   numeradores, índices, `migrate status` y `migrate diff`;
5. confirmar que los cinco writers corren la versión puente y retirar los
   allocators legacy según ADR 007.

Sin backfill, renumeración ni edición de migraciones aplicadas.

## Estado verificado de producción (2026-11-02, solo lectura)

- Última migración registrada: `20260805123000_add_share_link_date_range`.
  T11, T12 y T14 no están aplicadas.
- `StockAutoridad` no existe; `trg_sync_producto_stock` está activo
  (`tgenabled = O`). No hay triggers T12.
- `Venta.numeroVenta` y `Consignacion.numeroFolio` existen.
- Rol actual de la base: `postgres`, superusuario y `createrole`; no hay
  separación migrador/runtime.
- Auditoría: 4 sucursales con 650/191/39/29 ventas, sin nulos ni duplicados;
  no hay consignaciones.
- Servicio `import.vps - POS` online en `importvps.com`; cron activo. No existe
  un fence implementado.

Los datos permiten construir los índices únicos, pero el orden de rollout sigue
exigiendo desplegar primero el puente T12-A, separar roles y disponer de fence y
ventana. No se ejecutó ninguna escritura en producción.

## Rollout ejecutado (2026-11-02)

- Servicio detenido (`railway down`) y conexiones de aplicación drenadas a cero.
- Backup lógico previo (`pg_dump` formato custom, 4.18 MB).
- Migraciones T11/T12 aplicadas; status y diff limpios.
- Triggers T12 y de stock activos; índices únicos válidos; counters sembrados en
  650/191/39/29.
- Smoke revertido como `postgres` y como `consigna_runtime`: venta 651, folio 1.
- Rol `consigna_runtime`: sin superuser/createrole/createdb/bypassrls; DDL y
  `ALTER TABLE ... DISABLE TRIGGER` denegados (42501).
- Deployment `877f99e0-ec55-44b5-bb92-851d087647f1` online; `/login` HTTP 200;
  10 conexiones de app con `consigna_runtime`; sin errores ni 500 recientes.
- `DATABASE_URL` (migrador) y `RUNTIME_DATABASE_URL` (runtime) separados.
- PR #3 mergeado a `main` (`5b41eb4`); auto-deploy
  `5f0ca137-993f-4061-b8e0-b34df9adad57` SUCCESS, sin migraciones pendientes,
  `/login` 200 y 10 conexiones `consigna_runtime`. T12 persistido en Git y
  producción.
- ACL del rol runtime corregida: se revocaron `VentaNumerador`,
  `ConsignacionNumerador` y las funciones `t12_*`. El chequeo exige owner-only;
  con grants al runtime fallaba `VENTA_NUMBERING_AUTHORITY_REQUIRED` y toda venta
  devolvía 500. Verificado como `consigna_runtime` (`AUTHORITY_OK`).

## Fuera de alcance

- Consultar o modificar Railway/producción.
- Reparar duplicados o completar números históricos nulos.
- Hacer opcional `Consignacion.numeroFolio` en Prisma.
- Retirar cálculos, retries o advisory locks legacy.
- Cambiar los cinco writers para omitir candidatos.
- Soportar upserts por número/ámbito o transacciones que creen ventas de múltiples
  ámbitos; el inventario actual no contiene esos patrones y cualquier incorporación
  futura exige revisar orden de locks e identidad de conflicto.
- Commit, push o deploy.
- Ejecutar el rollout operativo real: esta etapa produce y prueba los artefactos,
  pero no afirma que exista todavía un fence verificable en Railway.

## Detenerse si

- La migración necesita decidir qué registro histórico conservar o renumerar.
- Aparece un writer que modifica número/ámbito, hace upsert por esas claves o crea
  múltiples ámbitos en una misma transacción.
- El rol runtime actual es dueño de tablas o comparte identidad con el migrador;
  esa topología no puede garantizar el fence ni impedir bypass de triggers.
- Existen triggers de usuario previos sobre `Venta` o `Consignacion`.
- Una prueba requiere acceder a una base no local o cuyo nombre no termine en
  `test`.
- El diff toca migraciones publicadas o cambios preexistentes ajenos.

## Evidencia descartable

- `npm run numbering:authority:test`: fresh, legacy, rechazos de duplicados,
  agotamiento, nullability y trigger incompatible; fallo tardío; concurrencia;
  privilegios; rollback.
- `node --import tsx --test src/app/api/consignaciones/route.integration.test.ts`:
  persistencia, respuesta y observación comparten el folio asignado por DB.
- `node --import tsx --test src/app/api/ventas/route.integration.test.ts`:
  contrato POS preservado con autoridad activa.
- `prisma migrate status` y `prisma migrate diff`: historial actual y cero drift.
- T12-C centraliza los cinco writers de venta en
  `createVentaWithAuthority`: omiten `numeroVenta`, fallan cerrados ante esquema
  incompatible y conservan cálculos, locks y retries legacy durante el rollout.

## Fuentes oficiales

- PostgreSQL 16, índices únicos y tratamiento de nulos:
  https://www.postgresql.org/docs/16/indexes-unique.html
- PostgreSQL 16, funciones `SECURITY DEFINER`:
  https://www.postgresql.org/docs/16/sql-createfunction.html
- PostgreSQL 16, locks explícitos:
  https://www.postgresql.org/docs/16/explicit-locking.html
- Prisma ORM 7, índices parciales y migraciones personalizadas:
  https://www.prisma.io/docs/orm/v7/prisma-schema/data-model/indexes
