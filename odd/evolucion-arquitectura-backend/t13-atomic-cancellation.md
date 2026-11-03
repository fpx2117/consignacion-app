# T13-B — Anulación atómica de ventas

## Objetivo

Garantizar que una venta sólo pueda ser reclamada para anulación una vez, incluso
cuando dos solicitudes concurrentes hayan observado inicialmente `anulada=false`.

## Contrato

- El endpoint conserva autenticación, scoping por sucursal y contratos HTTP
  existentes.
- La venta se reclama dentro de la misma transacción mediante una actualización
  condicional `id + sucursalId + anulada=false` antes de restituir stock.
- Una sola solicitud concurrente responde `200`; la perdedora responde `400` con
  `La venta ya fue anulada`.
- Venta inexistente o ajena conserva `404` con `Venta no encontrada`.
- Sólo la ganadora marca roturas, restituye stock y crea movimientos.
- Cualquier fallo posterior revierte tanto el claim como todos los efectos.

## Pruebas obligatorias

- Contrato HTTP del handler real mediante dependencias inyectables.
- PostgreSQL 16 con dos invocaciones concurrentes del handler: exactamente un
  éxito, una venta anulada, una restitución por detalle y stock final correcto.
- Camino de rotura y rollback siguen dentro de la misma transacción.

## Fuera de alcance

- Corregir el modelo dual de stock o retirar el trigger legacy (T14-T16).
- Cambiar autorización por rol o UX.
- Migraciones, producción, Railway, commit, push o deploy.

## Detenerse si

- La corrección exige cambiar el contrato secuencial existente.
- El claim no puede ocurrir antes de las mutaciones de detalle/stock.
- Aparece una inversión respecto del orden `Venta -> StockSucursal -> Producto`.

## Evidencia de cierre

- RED PostgreSQL observado antes del claim: `[200, 200]`.
- Dos transacciones reales alcanzan un barrier antes de competir por el claim;
  resultado final `[200, 400]` y un solo movimiento de restitución.
- El caso concurrente con `brokenItems` genera una sola `ROTURA`, marca el
  detalle y no modifica stock.
- Un fallo PostgreSQL tardío revierte claim, `VentaDetalle.esRotura`, movimientos,
  `StockSucursal` y `Producto`; el cliente recibe un `500` sanitizado.
