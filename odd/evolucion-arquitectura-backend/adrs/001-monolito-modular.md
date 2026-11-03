# ADR 001 — Monolito modular incremental

## Contexto

El backend mezcla HTTP, reglas, Prisma, cálculos y efectos, pero sigue siendo una
única aplicación Next.js con una base PostgreSQL por comercio.

## Opciones

- Reescritura o microservicios.
- Capas globales por tipo técnico.
- Monolito modular extraído por casos de uso.

## Decisión

Adoptar un monolito modular incremental. Las rutas dependen de aplicación;
aplicación depende de dominio; infraestructura implementa puertos específicos.

## Motivo

Permite aislar reglas y transacciones sin introducir coordinación distribuida ni
una reescritura de alto riesgo.

## Consecuencias

- Los módulos se crean sólo durante extracciones reales.
- No habrá repositorios genéricos ni entidades espejo sin invariantes.
- Las transacciones entre capacidades se componen mediante unidades de trabajo
  específicas del caso de uso.
