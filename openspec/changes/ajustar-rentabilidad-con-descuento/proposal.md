# Propuesta: Ajustar Rentabilidad al Aplicar Descuento en Catálogo

## Intención

Cuando un usuario edita o crea un producto y activa un descuento en catálogo (porcentaje o monto fijo), la sección de "Rentabilidad Proyectada/Estimada" muestra actualmente la ganancia calculada sobre el `precioVenta` original, ignorando completamente el descuento. Esto induce a error: el comerciante cree que su margen es mayor al real, ya que el precio efectivo de venta (con descuento) es menor.

El objetivo es que la rentabilidad refleje el precio final con descuento cuando este esté activo, dando una visión realista del margen.

## Alcance

### Dentro del Alcance

- Corregir el cálculo de rentabilidad en el diálogo de **creación** de producto (`create-producto-dialog.tsx`) para que use el precio con descuento como base cuando corresponda.
- Corregir el cálculo de rentabilidad en el diálogo de **edición** de producto (`edit-producto-dialog.tsx`) para que use el precio con descuento como base cuando corresponda.
- Ajustar la validación de `esGananciaNegativa` (que deshabilita el botón de guardar) para que también considere el precio con descuento.
- Mostrar visualmente que la rentabilidad es "con descuento" cuando el descuento está activo (etiqueta diferenciadora).
- Mantener el preview de precio final existente (ya funciona correctamente, como complemento visual).

### Fuera del Alcance

- NO se modifica la lógica de KPIs del dashboard (`kpi-logic.ts`) — esa usa datos reales de ventas, no proyecciones.
- NO se modifica la lógica de rentabilidad en el reporte de inventario PDF — es un margen potencial basado en precio de lista.
- NO se modifica el cálculo de rentabilidad en la tabla de productos (`productos-view.tsx`) — es un vistazo rápido sin contexto de descuento.
- NO se modifica la API de productos ni la base de datos.

## Enfoque

En ambos diálogos, la lógica actual es:

```typescript
const pv = toNumber(precioVenta) || 0;
const pc = toNumber(precioCosto) || 0;
const gananciaUnitaria = pv - pc;
const margenPorcentaje = pv > 0 ? (gananciaUnitaria / pv) * 100 : 0;
```

Se DEBE modificar para que, cuando el descuento esté activo y tenga un valor válido:

1. Calcular `precioEfectivo` = precio con descuento aplicado (misma fórmula del preview ya existente).
2. Calcular `gananciaUnitaria` = `precioEfectivo - pc`.
3. Calcular `margenPorcentaje` = `(gananciaUnitaria / precioEfectivo) * 100`.
4. Si el descuento no está activo o no tiene valor, usar `pv` como precio base (comportamiento actual).

Se DEBE reutilizar la misma lógica de cálculo de precio final que ya existe en el preview (líneas 468-486 en edit, 454-472 en create) para evitar duplicación.

## Áreas Afectadas

| Área                                                            | Impacto    | Descripción                                                                        |
| --------------------------------------------------------------- | ---------- | ---------------------------------------------------------------------------------- |
| `src/app/(...)/productos/components/create-producto-dialog.tsx` | Modificado | Ajustar cálculo de rentabilidad (líneas 142-146) y validación `esGananciaNegativa` |
| `src/app/(...)/productos/components/edit-producto-dialog.tsx`   | Modificado | Ajustar cálculo de rentabilidad (líneas 167-171) y validación `esGananciaNegativa` |

## Riesgos

| Riesgo                                                                                            | Probabilidad | Mitigación                                                                                                                   |
| ------------------------------------------------------------------------------------------------- | ------------ | ---------------------------------------------------------------------------------------------------------------------------- |
| El precio con descuento caiga por debajo del costo → ganancia negativa no detectada correctamente | Baja         | La validación `esGananciaNegativa` se ajusta para usar el precio efectivo, bloqueando el guardado si la ganancia es negativa |
| Comportamiento inconsistente entre create y edit                                                  | Baja         | Se aplica exactamente la misma lógica en ambos componentes                                                                   |
| Confusión del usuario al ver rentabilidad más baja                                                | Media        | Se agrega una etiqueta visual "con descuento" para dejar claro que la rentabilidad refleja el precio descontado              |

## Plan de Reversión (Rollback)

Si el cambio causa confusión o problemas:

1. Revertir el commit (`git revert`).
2. Los archivos modificados son solo 2 componentes cliente; ningún cambio en API, BD ni modelos.
3. Tiempo estimado de rollback: < 2 minutos.

## Dependencias

- Ninguna dependencia externa. El cambio es puramente en la capa de presentación (frontend).

## Criterios de Éxito

- [ ] En el diálogo de creación, al activar un descuento del 20% sobre un producto de $1000 (costo $600), la rentabilidad muestra $200 (20%) en lugar de $400 (40%).
- [ ] En el diálogo de edición, al activar un descuento de monto fijo $300 sobre un producto de $1000 (costo $600), la rentabilidad muestra $100 (14.3%) en lugar de $400 (40%).
- [ ] Si el precio con descuento cae por debajo del costo, el botón de guardar se deshabilita y se muestra la advertencia de ganancia negativa.
- [ ] Si el descuento se desactiva, la rentabilidad vuelve a calcularse sobre el precio original (sin descuento).
- [ ] Se muestra una etiqueta visual que indica "con descuento" cuando el cálculo está afectado por un descuento activo.
