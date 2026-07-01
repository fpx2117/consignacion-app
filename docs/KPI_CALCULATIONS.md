# Documentación de Cálculos de KPIs - Dashboards y Reportes

Este documento detalla los cálculos y la lógica detrás de cada indicador clave de desempeño (KPI) utilizado en la plataforma, actualizado para garantizar la precisión incluyendo todos los tipos de descuentos.

## 1. Rentabilidad y Finanzas (Precisión con Descuentos)

### Ganancia POS (Venta Directa)
Refleja la utilidad neta después de descontar el costo de mercadería y **todos los descuentos aplicados**.
*   **Lógica:** Se itera por cada venta `CASUAL`. Para cada ítem, se toma el `subtotal` (que ya resta el descuento por ítem o categoría) y se le resta el `costo * unidades`. Al final de la venta, se resta el `descuentoGlobal` del ticket.
*   **Fórmula:** `Sumatoria(VentaDetalle.subtotal - (Producto.precioCosto * units)) - Sumatoria(Venta.descuentoGlobal)`

### Ganancia por Consignación
Refleja la utilidad neta de las mercaderías liquidadas, considerando recargos y descuentos.
*   **Lógica:** Similar a la venta directa, se utiliza el `subtotal` de los ítems de ventas tipo `LIQUIDACION` (provenientes de liquidaciones) y se resta el costo de reposición.
*   **Fórmula:** `Sumatoria(VentaDetalle.subtotal - (Producto.precioCosto * units))`

### Ganancia Bruta
Es la utilidad operativa total del período antes de gastos generales.
*   **Fórmula:** `Ganancia por Consignación + Ganancia POS`

### Ganancia Neta
Utilidad final después de restar los gastos operativos cargados al sistema.
*   **Fórmula:** `Ganancia Bruta - Gastos Totales (Pagados)`

### Ventas (Facturación Neta)
Monto total cobrado/facturado al cliente, **neto de descuentos**.
*   **POS:** Sumatoria de `Venta.total` (tipo `CASUAL`).
*   **Consignación:** Sumatoria de `Venta.total` (tipo `LIQUIDACION`).
*   Representa lo que efectivamente ingresó como deuda o efectivo, no el precio de lista.

---

## 2. Inventario y Operación

### Unidades Pendientes (En Calle)
Stock que los clientes tienen en su poder pero no han pagado ni devuelto.
*   **Fórmula:** `Unidades Entregadas - (Unidades Liquidadas + Unidades Devueltas)`

### Stock Local vs Consignado
*   **Disponible:** Mercadería lista en estantería para vender.
*   **Consignado:** Mercadería físicamente fuera del local en manos de terceros.

---

## 3. Rankings y Análisis

### Top Productos (Ranking de Valor Real)
Los productos se ordenan por su contribución real a la facturación, usando el **subtotal neto de descuentos**.
*   Esto asegura que un producto con mucho descuento no aparezca artificialmente alto en el ranking si su valor real de venta fue bajo.

---

## Notas Técnicas
*   **Precio Costo:** Se utiliza el `precioCosto` actual del producto en el momento de generar el reporte/dashboard.
*   **Sincronización:** Los cambios en `sucursalId` aseguran que los KPIs solo muestran datos de la sede activa en la que se encuentra el usuario.
