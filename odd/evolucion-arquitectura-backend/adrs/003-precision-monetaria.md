# ADR 003 — Precisión monetaria y redondeo

## Contexto

Los totales comerciales suelen usar dos decimales, algunos costos conservan
cuatro y los flujos actuales redondean en momentos diferentes.

## Opciones

- Convertir todo inmediatamente a centavos.
- Mantener `number` sin contratos de precisión.
- Extraer primero la aritmética vigente y luego adoptar punto fijo con escala.

## Decisión

La extracción inicial conservará operaciones y redondeos actuales. Después de
caracterizar cada flujo se podrán introducir tipos de punto fijo con escala
explícita para dinero de venta, costos precisos y tasas.

## Motivo

Una conversión temprana a centavos perdería precisión intermedia y cambiaría
resultados observables.

## Consecuencias

- Todo cambio de redondeo requiere aprobación separada.
- Los adaptadores convierten HTTP y Prisma Decimal; el dominio no importa Prisma.
- Las pruebas cubren precisión intermedia, tie-breaking, línea, agregado y valor
  persistido.
