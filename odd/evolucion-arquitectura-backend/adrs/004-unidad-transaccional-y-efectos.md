# ADR 004 — Unidad transaccional y efectos externos

## Contexto

Registrar una venta modifica inventario, movimientos, venta y pago en una sola
transacción y luego dispara notificaciones.

## Opciones

- Una transacción independiente por módulo.
- Compartir `Prisma.TransactionClient` entre dominio y módulos.
- Una unidad de trabajo específica implementada por Prisma.

## Decisión

Cada caso de uso multi-capacidad definirá una unidad de trabajo específica. Un
adaptador Prisma único implementará la transacción. Dominio y aplicación no
recibirán clientes Prisma. Los efectos externos se producirán post-commit y,
cuando requieran entrega garantizada, mediante outbox.

## Motivo

Preserva atomicidad sin acoplar el dominio a Prisma ni fragmentar la transacción
por límites de carpetas.

## Consecuencias

- Los resultados necesarios para HTTP se capturan dentro de la transacción.
- El outbox no se introduce hasta que una necesidad de entrega lo justifique.
- Cliente por defecto y sesión de caja se endurecen en una etapa separada después
  de caracterizar el comportamiento actual.
