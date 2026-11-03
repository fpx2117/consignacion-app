# T12-A — Puente previo a la autoridad de numeración

## Objetivo

Hacer que la creación de consignaciones use el `numeroFolio` persistido y
devuelto por PostgreSQL para toda observación posterior, sin instalar todavía
numeradores, triggers ni índices únicos.

## Alcance autorizado

- Inventariar todos los escritores de `Venta.numeroVenta` y
  `Consignacion.numeroFolio`.
- Preparar y ejecutar una auditoría reproducible de nulos, duplicados y máximos
  por ámbito sobre PostgreSQL descartable.
- Cambiar el alta de consignaciones para que `MovimientoStock.observaciones` use
  exclusivamente `consignacion.numeroFolio`, retornado por el `INSERT`.
- Caracterizar que persistencia, respuesta y observaciones comparten el folio
  retornado aunque difiera del candidato calculado localmente.

## Terminado cuando

- Una prueba focalizada falla con el comportamiento actual y pasa después del
  puente.
- La auditoría enumera nulos y duplicados de ventas por sucursal y consignaciones
  por cliente sin modificar datos.
- Las pruebas focalizadas y de regresión relacionadas pasan.
- Una revisión adversarial no encuentra usos posteriores de `nuevoFolio` ni
  instalación prematura de autoridad en base de datos.

## Fuera de alcance

- Crear `VentaNumerador` o `ConsignacionNumerador`.
- Agregar funciones, triggers o índices únicos.
- Renumerar datos, hacer backfill o resolver duplicados existentes.
- Retirar cálculos o advisory locks legacy.
- Consultar producción, hacer commit, push o deploy.

## Detenerse si

- Aparece otro escritor de consignaciones no cubierto por el puente.
- La auditoría requiere decidir cómo renumerar datos reales.
- El cambio exige hacer `numeroFolio` opcional en Prisma.
- Una regresión ajena impide distinguir el resultado de las pruebas focalizadas.

## Comandos de verificación

```bash
node --test scripts/migrations/audit-numbering.test.mjs
node --import tsx --test src/modules/consignaciones/consignacion-numbering.test.ts src/modules/consignaciones/consignacion-numbering-wiring.test.ts
TEST_DATABASE_URL=postgresql://.../t12_numbering_test T12_CONFIRM_DATABASE=t12_numbering_test npm run numbering:audit:test
```

El tercer comando crea una base hija descartable, aplica las migraciones, inserta
fixtures con nulos y duplicados conocidos, ejecuta la auditoría y elimina la base
en un bloque `finally`.
