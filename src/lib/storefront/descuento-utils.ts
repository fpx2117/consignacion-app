export type DescuentoEfectivo = {
  tipo: "porcentaje" | "monto";
  porcentaje: number;
  precioOriginal: number;
  precioFinal: number;
  montoDescuento: number;
};

type ProductoConDescuento = {
  descuentoActivo: boolean;
  tipoDescuento?: string | null;
  descuentoPorcentaje: number | null;
  descuentoMonto?: number | null;
  descuentoDesde: string | Date | null;
  descuentoHasta: string | Date | null;
  precioVenta: number;
};

export function calcularDescuentoEfectivo(
  producto: ProductoConDescuento,
  ahora: Date = new Date()
): DescuentoEfectivo | null {
  if (!producto.descuentoActivo) return null;

  const tipo = (producto.tipoDescuento ?? "porcentaje") as "porcentaje" | "monto";
  const tienePorcentaje = tipo === "porcentaje" && producto.descuentoPorcentaje;
  const tieneMonto = tipo === "monto" && producto.descuentoMonto;

  if (!tienePorcentaje && !tieneMonto) return null;

  const desde = producto.descuentoDesde ? new Date(producto.descuentoDesde) : null;
  const hasta = producto.descuentoHasta ? new Date(producto.descuentoHasta) : null;

  if (desde && ahora < desde) return null;
  if (hasta && ahora > hasta) return null;

  const precioOriginal = Number(producto.precioVenta);

  if (tipo === "monto") {
    const montoDescuento = Math.min(Number(producto.descuentoMonto), precioOriginal);
    const precioFinal = precioOriginal - montoDescuento;
    const porcentaje = precioOriginal > 0
      ? Math.round((montoDescuento / precioOriginal) * 100)
      : 0;
    return { tipo: "monto", porcentaje, precioOriginal, precioFinal, montoDescuento };
  }

  // porcentaje
  const porcentaje = Number(producto.descuentoPorcentaje);
  const montoDescuento = precioOriginal * (porcentaje / 100);
  const precioFinal = precioOriginal - montoDescuento;
  return { tipo: "porcentaje", porcentaje, precioOriginal, precioFinal, montoDescuento };
}
