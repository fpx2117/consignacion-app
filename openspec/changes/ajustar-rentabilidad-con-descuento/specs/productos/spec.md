# Delta para Productos — Rentabilidad con Descuento

## Requisitos MODIFICADOS

### Requisito: Cálculo de Rentabilidad en Formulario de Producto

El sistema DEBE calcular la rentabilidad proyectada utilizando el precio efectivo de venta (precio con descuento aplicado, si el descuento está activo y es válido) en lugar del precio de venta original. Si el descuento no está activo o no tiene un valor válido, el sistema DEBE mantener el cálculo sobre el precio de venta original.

(Anteriormente: El sistema calculaba la rentabilidad únicamente como `precioVenta - precioCosto`, ignorando cualquier descuento configurado en el formulario.)

#### Escenario: Rentabilidad con descuento porcentual activo

- DADO QUE el usuario está en el formulario de creación o edición de producto
- Y el producto tiene `precioVenta = $1000` y `precioCosto = $600`
- Y el descuento en catálogo está ACTIVO con tipo "porcentaje" y valor `20%`
- CUANDO el sistema calcula la rentabilidad proyectada
- ENTONCES la ganancia unitaria DEBE ser `$200` (precioEfectivo $800 − costo $600)
- Y el margen porcentual DEBE ser `25.0%` ($200 / $800)
- Y la etiqueta DEBE indicar "Rentabilidad (c/desc.)" o similar para diferenciarla

#### Escenario: Rentabilidad con descuento de monto fijo activo

- DADO QUE el usuario está en el formulario de creación o edición de producto
- Y el producto tiene `precioVenta = $1000` y `precioCosto = $600`
- Y el descuento en catálogo está ACTIVO con tipo "monto" y valor `$300`
- CUANDO el sistema calcula la rentabilidad proyectada
- ENTONCES la ganancia unitaria DEBE ser `$100` (precioEfectivo $700 − costo $600)
- Y el margen porcentual DEBE ser `14.3%` ($100 / $700)

#### Escenario: Rentabilidad sin descuento (comportamiento actual)

- DADO QUE el usuario está en el formulario de creación o edición de producto
- Y el producto tiene `precioVenta = $1000` y `precioCosto = $600`
- Y el descuento en catálogo está DESACTIVADO
- CUANDO el sistema calcula la rentabilidad proyectada
- ENTONCES la ganancia unitaria DEBE ser `$400` (precioVenta $1000 − costo $600)
- Y el margen porcentual DEBE ser `40.0%` ($400 / $1000)
- Y la etiqueta NO DEBE mostrar indicador de descuento

#### Escenario: Descuento activo pero sin valor configurado

- DADO QUE el usuario activó el switch de descuento en catálogo
- PERO no ha ingresado ningún valor de porcentaje ni monto
- CUANDO el sistema calcula la rentabilidad proyectada
- ENTONCES DEBE comportarse como si el descuento no estuviera activo
- Y DEBE usar el precio de venta original para el cálculo

#### Escenario: Descuento activado y luego desactivado

- DADO QUE el usuario tenía un descuento activo del 20%
- Y la rentabilidad se mostraba sobre el precio con descuento
- CUANDO el usuario desactiva el switch de descuento
- ENTONCES la rentabilidad DEBE recalcularse inmediatamente sobre el precio original
- Y la etiqueta DEBE volver al formato sin indicador de descuento

### Requisito: Validación de Ganancia Negativa con Descuento

El sistema DEBE deshabilitar el botón de guardar cuando el precio efectivo (con descuento, si aplica) sea menor al costo, resultando en una ganancia negativa. El sistema DEBE mostrar una advertencia visual cuando esto ocurra.

(Anteriormente: La validación solo consideraba `precioVenta - precioCosto`, ignorando el impacto del descuento.)

#### Escenario: Precio con descuento cae por debajo del costo

- DADO QUE el producto tiene `precioVenta = $1000` y `precioCosto = $600`
- Y el descuento en catálogo está ACTIVO con tipo "porcentaje" y valor `50%`
- Y el precio efectivo es `$500` (menor al costo de $600)
- CUANDO el sistema evalúa la validez del formulario
- ENTONCES `esGananciaNegativa` DEBE ser `true`
- Y el botón de guardar DEBE estar deshabilitado
- Y DEBE mostrarse una advertencia visual de "Atención: Precio con descuento bajo el costo"

#### Escenario: Precio original bajo costo, descuento inactivo

- DADO QUE el producto tiene `precioVenta = $500` y `precioCosto = $600`
- Y el descuento está DESACTIVADO
- CUANDO el sistema evalúa la validez del formulario
- ENTONCES `esGananciaNegativa` DEBE ser `true` (comportamiento actual, sin cambios)
- Y el botón de guardar DEBE estar deshabilitado

## Requisitos AÑADIDOS

### Requisito: Etiqueta Visual de Rentabilidad con Descuento

El sistema DEBERÁ mostrar una etiqueta visual diferenciadora (ej. "Rentabilidad c/desc." o "Proyectada c/desc.") cuando el cálculo de rentabilidad esté basado en el precio con descuento, para que el usuario comprenda que la cifra refleja el impacto del descuento.

#### Escenario: Etiqueta diferenciadora con descuento activo

- DADO QUE el descuento en catálogo está ACTIVO y tiene un valor válido
- CUANDO se renderiza el bloque de rentabilidad en el formulario
- ENTONCES la etiqueta DEBE incluir el texto "c/desc." o similar
- Y DEBE ser visualmente distinguible (ej. color, badge, sufijo)

#### Escenario: Etiqueta estándar sin descuento

- DADO QUE el descuento en catálogo está DESACTIVADO o sin valor
- CUANDO se renderiza el bloque de rentabilidad en el formulario
- ENTONCES la etiqueta DEBE mostrar el texto estándar "RENTABILIDAD ESTIMADA" o "Rentabilidad Proyectada" (sin modificadores)
