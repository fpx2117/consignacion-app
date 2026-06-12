# Diseño: Ajustar Rentabilidad al Aplicar Descuento en Catálogo

## Enfoque Técnico

Se modifican los dos diálogos de producto (`create-producto-dialog.tsx` y `edit-producto-dialog.tsx`) para que la rentabilidad proyectada se calcule sobre el **precio efectivo** (precio con descuento) cuando el descuento está activo. Se reutiliza la misma lógica de cálculo de precio final que ya existe en el preview de descuento de cada diálogo, extrayéndola a una variable compartida (`precioEfectivo`) que alimenta tanto el cálculo de rentabilidad como la validación de ganancia negativa.

La lógica de cálculo existente en el preview (que ya funciona correctamente) no se modifica; simplemente se reutiliza su resultado.

## Decisiones de Arquitectura

### Decisión: Calcular `precioEfectivo` como variable derivada compartida

**Elección**: Extraer el cálculo de `precioEfectivo` a una variable `useMemo` o `const` en el cuerpo del componente, calculada a partir de `pv`, `tipoDescuento`, `descuentoPorcentaje`, `descuentoMonto` y `descuentoActivo`.

**Alternativas consideradas**:
- Crear un custom hook `useRentabilidadConDescuento` — sobreingeniería para un cálculo simple.
- Duplicar la lógica en el bloque de rentabilidad y en el preview — viola DRY.

**Justificación**: El proyecto ya usa variables derivadas simples (`const pv = toNumber(...)`) en el cuerpo del componente. Mantener el mismo patrón es consistente y mínimamente invasivo.

### Decisión: No modificar `descuento-utils.ts`

**Elección**: No usar la función `calcularDescuentoEfectivo` del módulo `descuento-utils.ts` para este cálculo.

**Alternativas consideradas**:
- Importar y usar `calcularDescuentoEfectivo` — requiere construir un objeto producto parcial y manejar fechas, agrega complejidad innecesaria.

**Justificación**: `calcularDescuentoEfectivo` está diseñada para el backend/catálogo y requiere fechas. En el formulario, el usuario está configurando el descuento en tiempo real y las fechas son opcionales. La lógica del preview en el formulario ya es más simple y adecuada para este contexto (solo verifica si hay valor numérico, sin validar fechas).

### Decisión: Etiqueta visual "c/desc." con badge sutil

**Elección**: Agregar un pequeño badge/badge inline con texto "c/desc." o similar, usando un color ambar/warning para indicar que la rentabilidad está afectada por el descuento. En el diálogo de creación se usará "RENTABILIDAD ESTIMADA (c/desc.)" y en edición "Rentabilidad Proyectada (c/desc.)".

**Alternativas consideradas**:
- Tooltip — requiere hover, no visible a simple vista.
- Color diferente para todo el bloque — podría confundirse con el estado de error (ganancia negativa).

**Justificación**: Un badge inline es visible inmediatamente y no interfiere con la señalización de ganancia negativa (rojo). El color ambar/warning es semánticamente correcto para "atención/precaución".

## Flujo de Datos

```
Estados del formulario
  ├── precioVenta (string) ──→ toNumber() ──→ pv (number)
  ├── precioCosto (string) ──→ toNumber() ──→ pc (number)
  ├── descuentoActivo (boolean)
  ├── tipoDescuento ("porcentaje" | "monto")
  ├── descuentoPorcentaje (string) ──→ toNumber() ──→ dpct
  └── descuentoMonto (string)      ──→ toNumber() ──→ dmonto
                │
                ▼
    ┌───────────────────────────┐
    │ Calcular precioEfectivo    │
    │                            │
    │ Si descuentoActivo:        │
    │   Si %: pv*(1-dpct/100)   │
    │   Si $: pv - min(dm,pv)   │
    │ Si no: pv                  │
    └───────────┬───────────────┘
                │
      ┌─────────┴─────────┐
      ▼                   ▼
┌──────────┐       ┌──────────────┐
│Rentabilidad│     │Preview Precio │
│ganancia =  │     │(existente,    │
│ pe - pc    │     │ sin cambios)  │
│margen =    │     └──────────────┘
│ gan/pe*100 │
│            │
│esNegativa =│
│ pe < pc    │
└────────────┘
```

## Cambios en Archivos

| Archivo | Acción | Descripción |
|---------|--------|-------------|
| `src/app/(...)/productos/components/create-producto-dialog.tsx` | Modificar | Líneas 142-156: Agregar cálculo de `precioEfectivo` y usarlo para rentabilidad. Líneas 328-349: Badge "c/desc." y mensajes de advertencia dinámicos. |
| `src/app/(...)/productos/components/edit-producto-dialog.tsx` | Modificar | Líneas 167-181: Ídem. Líneas 347-367: Badge "c/desc." y mensajes de advertencia dinámicos. |
| `src/app/(...)/productos/components/productos-view.tsx` | Modificar | `ProductoRow`: Importar `calcularDescuentoEfectivo`, calcular `precioEfectivo` y `margenEfectivo`. Celda de precio ahora muestra: badge "-XX%", precio original tachado, precio final en rojo, y margen recalculado con color warning si hay descuento. |

## Cambios de Código (Referencia)

La modificación en **ambos archivos** sigue este patrón:

```typescript
// ANTES (líneas 142-146 en create, 167-171 en edit):
const pv = toNumber(precioVenta) || 0;
const pc = toNumber(precioCosto) || 0;
const gananciaUnitaria = pv - pc;
const margenPorcentaje = pv > 0 ? (gananciaUnitaria / pv) * 100 : 0;
const esGananciaNegativa = pv > 0 && pc > 0 && gananciaUnitaria < 0;

// DESPUÉS:
const pv = toNumber(precioVenta) || 0;
const pc = toNumber(precioCosto) || 0;
const dpct = descuentoActivo && tipoDescuento === "porcentaje" ? (toNumber(descuentoPorcentaje) ?? 0) : 0;
const dmonto = descuentoActivo && tipoDescuento === "monto" ? (toNumber(descuentoMonto) ?? 0) : 0;
const precioEfectivo = descuentoActivo
  ? tipoDescuento === "porcentaje" && dpct > 0
    ? pv * (1 - dpct / 100)
    : tipoDescuento === "monto" && dmonto > 0
      ? Math.max(0, pv - Math.min(dmonto, pv))
      : pv
  : pv;
const gananciaUnitaria = precioEfectivo - pc;
const margenPorcentaje = precioEfectivo > 0 ? (gananciaUnitaria / precioEfectivo) * 100 : 0;
const esGananciaNegativa = precioEfectivo > 0 && pc > 0 && gananciaUnitaria < 0;
const muestraDescuento = descuentoActivo && ((tipoDescuento === "porcentaje" && dpct > 0) || (tipoDescuento === "monto" && dmonto > 0));
```

## Interfaces / Contratos

No se introducen nuevas interfaces. Los tipos existentes (`Producto`, `UpdateProductoInput`, `CreateProductoInput`) no se modifican. El cambio es puramente en lógica de presentación.

## Estrategia de Pruebas

| Capa | Qué Probar | Enfoque |
|------|------------|---------|
| Manual | Todos los escenarios de la especificación | Probar en UI: crear/editar producto con y sin descuento, verificar valores y etiquetas |
| Manual | Edge case: descuento que lleva precio bajo costo | Verificar que el botón se deshabilita y se muestra advertencia |
| Manual | Toggle de descuento on/off | Verificar que la rentabilidad se recalcula instantáneamente |

**Nota**: El proyecto no tiene framework de testing automatizado configurado. Se realizará verificación manual exhaustiva.

## Migración / Despliegue

No requiere migración de datos ni cambios en base de datos. El cambio es puramente en la capa de presentación (frontend). Despliegue directo.

## Preguntas Abiertas

- Ninguna. El cambio está completamente definido.
