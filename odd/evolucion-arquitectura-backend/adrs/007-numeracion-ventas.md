# ADR 007 — Autoridad única de numeración comercial

## Contexto

POS utiliza advisory lock para obtener el próximo número, pero liquidaciones no
lo hacen y la base no impone unicidad por sucursal. Las consignaciones calculan
`numeroFolio` con `MAX + 1` por cliente y tampoco poseen unicidad.

## Opciones

- Mantener cálculo independiente por escritor.
- Confiar sólo en advisory locks dispersos.
- Usar secuencias globales, que perderían el alcance actual por sucursal/cliente.
- Usar numeradores por ámbito, triggers y unicidad en PostgreSQL.

## Decisión

PostgreSQL será la autoridad incluso durante despliegues con instancias antiguas.
Se crearán dos numeradores explícitos:

- `VentaNumerador(sucursalId PRIMARY KEY, ultimoNumero)`;
- `ConsignacionNumerador(clienteId PRIMARY KEY, ultimoNumero)`.

Cada asignación ejecutará dentro de la misma transacción del alta un UPSERT
atómico equivalente a `INSERT ... ON CONFLICT DO UPDATE ... RETURNING`. El update
de la fila del ámbito serializa competidores sin depender de que todos los
callers recuerden adquirir un advisory lock.

Triggers PostgreSQL `BEFORE INSERT` asignarán siempre `NEW.numeroVenta` por
sucursal y `NEW.numeroFolio` por cliente. El valor final devuelto por `INSERT
RETURNING` será el observable por Prisma.

La compatibilidad no es idéntica para ambos agregados:

- POS, liquidaciones y checkout ya continúan sus efectos con la venta devuelta;
  sus cálculos locales pueden ser reemplazados por el trigger durante el rollout.
- Consignaciones no es compatible con el binario actual: después del insert usa
  la variable local `nuevoFolio` en `MovimientoStock.observaciones`. Antes de
  activar el trigger se desplegará una versión puente que utilice siempre
  `consignacion.numeroFolio`, retornado por PostgreSQL, en respuestas, auditoría y
  cualquier efecto posterior. Todas las instancias anteriores deben drenarse.

El alcance actual se preserva exactamente:

- `numeroVenta`: secuencia independiente por `sucursalId`;
- `numeroFolio`: secuencia independiente por `clienteId`, no por sucursal.

La base reforzará las invariantes con índices únicos sobre
`Venta(sucursalId, numeroVenta)` y `Consignacion(clienteId, numeroFolio)`.
PostgreSQL permite múltiples nulos por defecto en el primer índice, por lo que los
`Venta.numeroVenta` históricos nulos se conservan sin depender del preview
`partialIndexes` de Prisma; toda venta nueva recibirá número.

## Rollout mixto

1. Auditar nulos, duplicados y máximos por ámbito. Si existen duplicados, detener
   el rollout. La reparación y la elección de qué números conservar requieren una
   decisión separada basada en evidencia de negocio; este ADR no preselecciona una
   política de renumeración.
2. Desplegar el puente de consignaciones que conserva el cálculo y el campo
   requerido por Prisma, pero después del insert usa exclusivamente el
   `numeroFolio` retornado. Probar que observaciones, respuesta y registro
   persistido usan el mismo valor; drenar todo binario anterior.
3. Pausar y drenar altas/modificaciones mediante un fence verificable: migrador y
   runtime deben usar roles separados, se revoca escritura al runtime y se drenan
   sus sesiones. Si comparten rol, el rollout queda bloqueado.
4. Bajo locks `SHARE ROW EXCLUSIVE` adquiridos siempre sobre `Consignacion` y luego
   `Venta`, repetir auditoría y preflight de nullability/rango/triggers. En una
   única transacción crear índices únicos no concurrentes, numeradores
   inicializados con el máximo, funciones, triggers de insert y guards que vuelven
   inmutables número y ámbito. Se acepta la ventana de mantenimiento para evitar
   estados parciales entre índices y autoridad; su duración debe aprobarse con
   métricas reales antes del deploy.
5. Verificar catálogo y ejecutar smokes con rollback. La escritura se restaura
   sólo después de que todos los flujos pasen. Un rollback de aplicación nunca
   puede bajar de la versión puente T12-A.
6. Mantener temporalmente los cálculos y advisory locks legacy. Son redundantes,
   pero compatibles porque el trigger reemplaza su valor antes del insert.
   Debido a que `Consignacion.numeroFolio` es requerido y no tiene default en el
   schema Prisma actual, el puente seguirá enviando el candidato calculado; no se
   documenta como omisible. Hacerlo omisible exigiría una migración de schema y
   cliente separada, ordenada y probada.
7. Desplegar callers de ventas que omitan `numeroVenta` y dependan del valor
   retornado. Para consignaciones, mantener el valor requerido hasta que exista
   la migración Prisma separada. Sólo versiones compatibles con el folio
   retornado pueden coexistir con los triggers.
8. Retirar advisory locks y cálculos legacy sólo cuando no queden instancias
   antiguas y las pruebas concurrentes demuestren unicidad y alcance.

La implementación T12-C usa temporalmente un límite único que verifica catálogo
y adquiere el mismo advisory lock transaccional que la migración y su rollback.
Esto cierra la combinación aplicación nueva/esquema anterior sin retirar todavía
los locks, candidatos calculados ni retries legacy. La verificación local no
equivale a desplegar callers ni habilita el rollout real.

El incremento del numerador es transaccional: un rollback del alta revierte
también el número. Errores de serialización o deadlock se reintentan con la misma
política acotada del caso de uso; una violación única inesperada se trata como
deriva de datos y falla cerrada, no mediante un bucle ilimitado.

## Rollback

El rollback de aplicación no retira triggers ni numeradores: las versiones
legacy de ventas siguen siendo compatibles, pero no se puede volver a una versión
de consignaciones que use `nuevoFolio` después del insert. Los triggers y
numeradores permanecen instalados durante TODO rollback de aplicación soportado.

Retirarlos exige una decisión y migración separadas que introduzcan previamente
otro allocator único, utilizado por todos los writers de cada ámbito —incluidas
liquidaciones y consignaciones—, con orden de locks documentado y prueba
concurrente. Volver a cálculos independientes `MAX + 1` no es un rollback
soportado: los índices únicos sólo convertirían la carrera en requests fallidos.
La opción ante un fallo de aplicación es conservar la autoridad PostgreSQL y
volver únicamente a callers puente compatibles.

## Motivo

Un lock usado por un solo flujo no protege la secuencia global. Los triggers
cierran el hueco de despliegue mixto porque PostgreSQL aplica la misma política a
todo `INSERT`, independientemente de su origen.

## Consecuencias

- POS, liquidaciones, checkout y consignaciones quedan bajo autoridad compartida.
- La reparación de duplicados o el backfill de nulos no se mezclan silenciosamente
  con la instalación del allocator.
- Los contratos de `numeroVenta` y `numeroFolio` se caracterizan antes del cambio.
- La solución acepta dos tablas pequeñas y triggers a cambio de eliminar carreras
  y hacer seguro el rollout con binarios antiguos.
- Una prueba concurrente debe demostrar que cada observación de movimiento usa el
  mismo `numeroFolio` que la consignación persistida.
- Los campos de número y ámbito quedan inmutables después del alta. Incorporar un
  upsert por esas claves o un writer multi-ámbito exige una decisión posterior de
  identidad y orden de locks.
- Cualquier reemplazo futuro del allocator debe probar POS, checkout,
  liquidaciones y consignaciones en paralelo antes de documentar la eliminación
  de triggers como ejecutable.

## Referencias

- PostgreSQL `INSERT`: `ON CONFLICT DO UPDATE` garantiza un resultado atómico de
  insert o update bajo concurrencia: https://www.postgresql.org/docs/current/sql-insert.html
- Los triggers de fila `BEFORE INSERT` pueden modificar `NEW` y se ejecutan en la
  misma transacción: https://www.postgresql.org/docs/current/trigger-definition.html
