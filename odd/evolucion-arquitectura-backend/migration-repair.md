# Reparación del historial de migraciones

## Alcance

T11 agrega una única migración de reconciliación e idempotente:
`20261101010000_reconcile_schema_history`. No modifica ninguna de las 29
migraciones ya publicadas y elimina los mecanismos que borraban filas de
`_prisma_migrations`.

La reparación cubre los dos estados confirmados por evidencia del repositorio:

| Estado | Evidencia | Comportamiento |
| --- | --- | --- |
| Base creada sólo con las 29 migraciones | T08/T09 y reproducción T11 | crea los objetos ausentes y conserva datos legacy |
| Esquema actual exacto, actualizado por `db push` o SQL manual, sin migración equivalente | reproducción T11 | registra la reconciliación sin recrear ni borrar datos |

No se consultó ni modificó Railway. Un estado parcial diferente de los dos
anteriores debe detener el despliegue y analizarse; no se debe borrar historial
para forzarlo.

## Riesgos operativos

- La migración agrega columnas, índices y claves foráneas, y reemplaza la unicidad
  global de categorías por unicidad por sucursal. Los DDL toman locks; por eso el
  SQL fija `lock_timeout = 5s` y `statement_timeout = 5min`.
- Las claves foráneas nuevas se crean `NOT VALID` y luego se validan. Esto reduce
  el lock inicial, pero la validación todavía recorre datos existentes.
- Los pagos legacy derivan sucursal primero de su sesión de caja y luego del
  cliente. Si ambas fuentes existen y difieren, la migración aborta.
- Notificaciones derivan sucursal de producto o usuario. Las categorías usan
  `Sucursal.id = 1` sólo cuando una fila requiere backfill. Un esquema actual sin
  sucursal `1` es válido si ninguna fila necesita ese fallback.
- Los índices únicos pueden fallar si un ambiente parcial ya contiene duplicados
  incompatibles. Eso requiere saneamiento explícito, no eliminación de la fila de
  migración.
- No existe un rollback SQL universal seguro: en ambientes donde estas tablas ya
  contenían datos antes de T11, un `DROP` destruiría información. El rollback es
  restaurar el backup o corregir hacia adelante.

## Preflight obligatorio para un ambiente real

Usar una conexión PostgreSQL directa, nunca un pooler, y realizar backup antes de
la ventana de mantenimiento.

Usar Node.js y las dependencias bloqueadas del repositorio. El preflight exige
Prisma CLI `7.8.0` y acepta únicamente una base vacía, el esquema exacto producido
por las 29 migraciones o el esquema actual exacto:

```bash
npx prisma migrate status
npm run migrate:t11:preflight
```

Un estado parcial, aunque parezca compatible, se rechaza. Debe analizarse y
repararse explícitamente antes de reintentar. El historial también se valida: las
29 migraciones deben tener exactamente una aplicación exitosa, sin nombres
desconocidos ni checksums ajenos a las tres versiones conocidas de la migración
histórica editada. T11 puede estar pendiente o aplicada según el estado.

Si `20260523120000_add_storefront_content_to_branding` figura como fallida, usar
el flujo soportado por Prisma en vez de editar `_prisma_migrations`:

```bash
npx prisma migrate resolve \
  --rolled-back 20260523120000_add_storefront_content_to_branding
npx prisma db execute \
  --file prisma/migrations/20260523120000_add_storefront_content_to_branding/migration.sql
npx prisma migrate resolve \
  --applied 20260523120000_add_storefront_content_to_branding
```

Este flujo sólo corresponde cuando `migrate status` confirma ese fallo y la
inspección verifica que se trata de esa migración. Su SQL actual es idempotente:
se completa explícitamente y después se registra mediante el mecanismo soportado
por Prisma. Si la fila exitosa fue eliminada pero todos sus objetos ya existen,
se omite `db execute` y se usa únicamente `migrate resolve --applied`. Nunca se
borra ni inserta una fila manualmente.

## Despliegue y verificación

Ejecutar una sola vez, con la aplicación detenida y sin réplicas arrancando en
paralelo:

```bash
npm run migrate:t11:deploy
npx prisma migrate status
```

`migrate:t11:deploy` repite el preflight con `--require-current` después de
`prisma migrate deploy`; debe terminar con código `0`. Después se verifican
fixtures representativos y recién entonces se habilita la aplicación. `npm start`
no ejecuta migraciones.

## Verificación local reproducible

El harness requiere PostgreSQL local, una base cuyo nombre termine en `test` y
una confirmación redundante del nombre. Crea y elimina siete bases nuevas
derivadas y se niega a sobrescribir una base preexistente:

```bash
TEST_DATABASE_URL='postgresql://postgres:postgres@127.0.0.1:5432/consignacion_t11_test?schema=public' \
T11_CONFIRM_DATABASE='consignacion_t11_test' \
npm run migrate:t11:test
```

Comprueba base nueva, legacy multi-sucursal, esquema actual sin sucursal `1`, un
esquema actual donde `db push` dejó un pago en la sucursal por defecto incorrecta,
rechazo de estado parcial y aborto ante conflicto de sucursal en pagos. En los
estados aceptados exige preflight final y `prisma migrate status` limpio.
También prueba historial faltante, desconocido y con checksum inválido. El fallo
intencional por conflicto comprueba que Prisma 7.8.0/PostgreSQL revierte el DDL
completo y que `migrate resolve --rolled-back` permite corregir los datos y
reintentar. Una segunda variante agrega un fallo al final de una copia temporal
de T11 y comprueba que no quedan tabla, columna ni valores enum parciales. Los
checksums equivalentes LF y CRLF se aceptan explícitamente.

Si el deploy falla:

1. mantener la aplicación detenida;
2. conservar logs y el registro fallido;
3. corregir la causa de datos o restaurar el backup;
4. confirmar que PostgreSQL revirtió el DDL y usar
   `migrate resolve --rolled-back 20261101010000_reconcile_schema_history`;
5. reintentar `migrate:t11:deploy`. Nunca ejecutar `DELETE` sobre
   `_prisma_migrations`.
