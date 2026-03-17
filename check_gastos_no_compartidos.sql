SELECT g.id, g.esCompartido, g.monto, gs.sucursalId, gs.montoProporcional FROM gasto g LEFT JOIN gastoSucursal gs ON g.id = gs.gastoId WHERE g.esCompartido = false AND gs.id IS NOT NULL LIMIT 10;
