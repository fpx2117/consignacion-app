# Especificación: Consistencia Dashboard PDF vs UI

## Propósito

Garantizar que los KPIs financieros y operativos mostrados en el reporte PDF del dashboard sean **exactamente idénticos** a los mostrados en el Dashboard UI para cualquier período seleccionado, usando la misma fuente de datos y las mismas fórmulas de cálculo.

## Requisitos

### Requisito 1: Período Correcto en PDF

El sistema DEBE pasar el período seleccionado por el usuario **sin transformaciones** a `getDashboardKpis()` al generar el reporte PDF.

#### Escenario: Período "Histórico" genera datos acumulados

- DADO QUE el usuario selecciona el período "all" (Histórico) en el Dashboard
- CUANDO el usuario genera el reporte PDF
- ENTONCES el PDF DEBE mostrar los KPIs acumulados desde el inicio de los datos
- Y los valores DEBEN coincidir exactamente con los del Dashboard UI en modo Histórico

#### Escenario: Período "Este mes" genera datos del mes actual

- DADO QUE el usuario selecciona el período "month" (Este mes)
- CUANDO el usuario genera el reporte PDF
- ENTONCES el PDF DEBE mostrar los KPIs del mes calendario actual
- Y los valores DEBEN coincidir exactamente con los del Dashboard UI en modo Este mes

#### Escenario: Período "Esta semana" genera datos de la semana

- DADO QUE el usuario selecciona el período "week" (Esta semana)
- CUANDO el usuario genera el reporte PDF
- ENTONCES el PDF DEBE mostrar los KPIs de la semana calendario actual
- Y los valores DEBEN coincidir exactamente con los del Dashboard UI

#### Escenario: Período "Hoy" genera datos del día

- DADO QUE el usuario selecciona el período "today" (Hoy)
- CUANDO el usuario genera el reporte PDF
- ENTONCES el PDF DEBE mostrar los KPIs del día actual
- Y los valores DEBEN coincidir exactamente con los del Dashboard UI

---

### Requisito 2: Fuente de Datos Unificada

El sistema DEBE usar `getDashboardKpis()` como **única fuente de verdad** para todos los KPIs financieros en el PDF. NO DEBE existir una segunda consulta Prisma independiente para calcular los totales de gastos.

#### Escenario: Total de gastos coincide con la fuente de KPIs

- DADO QUE se genera un reporte PDF del dashboard
- CUANDO el sistema calcula el total de gastos para el KPI
- ENTONCES el valor DEBE provenir de `kpis.gastos.total`
- Y NO DEBE existir un cálculo paralelo de gastos que pueda divergir

#### Escenario: Tabla de detalle de gastos usa datos consistentes

- DADO QUE el PDF muestra una tabla de detalle de gastos
- CUANDO se renderiza el total al pie de la tabla
- ENTONCES el total DEBE coincidir con `kpis.gastos.total`
- Y la suma de los montos individuales en la tabla DEBERÍA aproximarse al total (tolerancia: diferencia por redondeo de proporcional en gastos compartidos)

---

### Requisito 3: KPIs Financieros Idénticos

Los valores de los KPIs financieros en el PDF DEBEN ser numéricamente idénticos a los del Dashboard UI para el mismo período.

#### Escenario: Ganancia Bruta coincide

- DADO QUE el Dashboard UI muestra "Ganancia Bruta: $X"
- CUANDO se genera el PDF con el mismo período
- ENTONCES el PDF DEBE mostrar "Ganancia Bruta: $X"
- Y la diferencia DEBE ser $0.00

#### Escenario: Utilidad Neta coincide

- DADO QUE el Dashboard UI muestra "Ganancia Neta: $X" (con fórmula: Bruta - Gastos - Pérdida Rotura)
- CUANDO se genera el PDF con el mismo período
- ENTONCES el PDF DEBE mostrar "Ganancia Neta: $X"

#### Escenario: Ingresos en Caja / Movimiento Total coincide

- DADO QUE el Dashboard UI muestra el monto de pagos totales: $X
- CUANDO se genera el PDF con el mismo período
- ENTONCES el PDF DEBE mostrar "Ingresos en Caja: $X"

#### Escenario: Ganancia por Consignación coincide

- DADO QUE el Dashboard UI muestra la ganancia por consignación: $X
- CUANDO se genera el PDF con el mismo período
- ENTONCES el PDF DEBE mostrar "Por Consignación: $X"

#### Escenario: Ganancia por Ventas Directas coincide

- DADO QUE el Dashboard UI muestra la ganancia por ventas directas: $X
- CUANDO se genera el PDF con el mismo período
- ENTONCES el PDF DEBE mostrar "Ventas Directas: $X"

---

### Requisito 4: KPIs Operativos Idénticos

Los valores de los KPIs operativos en el PDF DEBEN ser numéricamente idénticos a los del Dashboard UI.

#### Escenario: Stock coincide

- DADO QUE el Dashboard UI muestra "En Calle: N unidades" y "Stock Local: M unidades"
- CUANDO se genera el PDF con el mismo período
- ENTONCES el PDF DEBE mostrar "Stock en Calle: N u." y "Stock Disponible: M u."

#### Escenario: Consignaciones abiertas coincide

- DADO QUE el Dashboard UI muestra "Consignaciones: N abiertas"
- CUANDO se genera el PDF
- ENTONCES el PDF DEBE mostrar "Abiertas: N"

#### Escenario: Unidades pendientes coincide

- DADO QUE el Dashboard UI muestra "Pendientes: N units en clientes"
- CUANDO se genera el PDF
- ENTONCES el PDF DEBE mostrar "Unidades Pendientes: N u."

---

### Requisito 5: KPIs Faltantes en PDF

El sistema DEBE incluir en el PDF los KPIs que el Dashboard UI muestra pero el PDF actualmente omite.

#### Escenario: "En Catálogo" aparece en el PDF

- DADO QUE el Dashboard UI muestra "En Catálogo: N productos activos con stock"
- CUANDO se genera el PDF
- ENTONCES el PDF DEBE incluir una sección o tarjeta con "En Catálogo: N"

#### Escenario: "Saldo Global" aparece en el PDF

- DADO QUE el Dashboard UI muestra "Saldo Global: $X deuda acumulada"
- CUANDO se genera el PDF
- ENTONCES el PDF DEBE incluir una sección o tarjeta con "Saldo Global: $X"

---

### Requisito 6: Nomenclatura Homologada

Los títulos de los KPIs en el PDF DEBERÍAN coincidir con los del Dashboard UI para minimizar confusión.

#### Escenario: Título de movimiento unificado

- DADO QUE el Dashboard UI muestra "Movimiento Total" o "Movimiento Total (POS)" o "Movimiento Total (Consig)"
- CUANDO se genera el PDF
- ENTONCES el PDF DEBERÍA usar el mismo título "Movimiento Total" con el mismo sufijo de canal

---

## Requisitos No Afectados (Referencia)

Los siguientes comportamientos existentes NO se modifican:

- La fórmula de cálculo de ganancia en `kpi-logic.ts` (Σ subtotal - costo×units - descuentoGlobal)
- La fórmula de gastos (propios + participación proporcional en compartidos)
- El sistema de `unstable_cache` de 60 segundos en `getDashboardKpis`
- La consulta de detalle de gastos para la tabla del PDF (se mantiene para el desglose)
- El Dashboard UI y sus componentes
