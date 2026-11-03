# T12-C — Migración compatible de writers de numeración

## Objetivo

Hacer que los cinco writers de `Venta` dependan de la autoridad PostgreSQL
instalada en T12-B, sin retirar todavía cálculos, locks, retries ni puentes legacy.

## Prerrequisitos

- La migración `20261101020000_establish_numbering_authority` está aplicada.
- El trigger `t12_assign_venta_numero`, el numerador y el índice único están
  presentes, habilitados, ready y válidos.
- `Consignacion.numeroFolio` continúa requerido por Prisma. Su writer conserva el
  candidato legacy; el puente T12-A sigue usando el folio persistido.

## Writers incluidos

1. `POST /api/ventas`.
2. Webhook aprobado de Mercado Pago.
3. Alta de liquidación por consignación.
4. Corrección de liquidación.
5. Liquidación desde `POST /api/consignaciones/[id]`.

Todos pasan por `createVentaWithAuthority`, único límite que admite
`venta.create`: rechaza candidatos `numeroVenta`, adquiere el advisory lock T12,
bloquea `Venta`, verifica la autoridad y recién entonces crea dentro de la misma
transacción. Los dos últimos ya omitían el campo, pero ahora tampoco pueden
saltear el guard de compatibilidad.

## Matriz de compatibilidad

| Aplicación | Esquema | Resultado |
|---|---|---|
| pre-T12-C | T12-B | compatible; el trigger reemplaza candidatos legacy |
| T12-C | T12-B | compatible; PostgreSQL asigna el número |
| T12-C | pre-T12-B | fallo cerrado antes de crear la venta |

El guard temporal comprueba catálogo en cada transacción. No se cachea: una
respuesta stale podría permitir una escritura sin autoridad durante rollback o
una intervención operativa. Migración, rollback y writers adquieren el mismo
advisory lock transaccional antes de tocar la autoridad; el lock de tabla impide
DDL concurrente sobre `Venta` hasta completar el insert.

La identidad verificada incluye trigger exacto `BEFORE INSERT FOR EACH ROW`, modo
compatible con `session_replication_role=origin`, función PL/pgSQL `SECURITY
DEFINER` con `search_path` endurecido, cuerpo normalizado conocido, `EXECUTE`
revocado a `PUBLIC`, numerador con columnas/PK/ACL esperados e índice completo con
columnas, unicidad, semántica de nulos, aplicación inmediata, readiness y validez
exactas. También rechaza triggers `BEFORE INSERT` adicionales y exige el `CHECK`
no negativo del numerador. Un runtime no-superusuario no puede ser dueño ni
miembro del rol dueño de función y numerador.

## Preservado durante rollout

- Advisory locks y cálculo `MAX + 1` existentes.
- Retries `P2002`/`P2034` del POS.
- Contratos HTTP y respuestas con el número persistido.
- Candidato y puente de consignaciones T12-A.

## Pruebas

- RED de wiring AST: existen exactamente cinco callers del límite y ningún
  `venta.create` de producción puede saltearlo.
- Unit test del límite: orden lock → verificación → create y rechazo de candidato.
- Integración PostgreSQL: rol runtime restringido crea una venta numerada; estados
  replica, disabled, trigger adicional, constraint/ACL/config/index drift y
  objetos T12 ausentes fallan cerrados; DDL concurrente queda bloqueado.
- Integración POS: al deshabilitar la autoridad después de mutaciones iniciales,
  la respuesta falla y la transacción revierte venta, pago, movimientos y stock.
- Integraciones PostgreSQL de POS y consignaciones con T12-B activa.
- T12-B, T11, TypeScript, ESLint y revisión adversarial final.

## Fuera de alcance

- Producción, Railway, deploy, commit o push.
- Backfill o renumeración.
- Retirar cálculos, advisory locks o retries legacy.
- Cambiar nullability de `Venta.numeroVenta` o requerimiento Prisma de
  `Consignacion.numeroFolio`.
- Migrar T13 o stock.

El alta preexistente de `Consumidor Final` fuera del retry transaccional del POS
permanece para T20. T12-C garantiza que no se cree una `Venta` ni sobrevivan las
mutaciones dentro de su transacción cuando falta autoridad; no adelanta ese
refactor de límites transaccionales.

## Detenerse si

- Algún writer no puede verificar autoridad dentro de su transacción.
- Omitir el candidato cambia el contrato HTTP o rompe un flujo con T12-B activa.
- La solución requiere tocar cambios preexistentes ajenos.
