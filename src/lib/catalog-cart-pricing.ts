import type { CatalogCartItem } from "@/lib/types";

type CatalogCartPricingContext = {
  porcentajeAumentoConsignacion?: number;
};

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

export function getCatalogCartUnitPrice(
  item: Pick<CatalogCartItem, "precioVenta" | "descuentoEfectivo" | "pricingMode">,
  context: CatalogCartPricingContext = {},
) {
  if (item.descuentoEfectivo?.precioFinal != null) {
    return roundMoney(Number(item.descuentoEfectivo.precioFinal));
  }

  const basePrice = Number(item.precioVenta);
  if (item.pricingMode === "consigne") {
    const surcharge = Number(context.porcentajeAumentoConsignacion) || 0;
    return roundMoney(basePrice * (1 + surcharge / 100));
  }

  return roundMoney(basePrice);
}

export function getCatalogCartLineSubtotal(
  item: Pick<CatalogCartItem, "precioVenta" | "descuentoEfectivo" | "pricingMode" | "quantity">,
  context: CatalogCartPricingContext = {},
) {
  return roundMoney(getCatalogCartUnitPrice(item, context) * item.quantity);
}

export function getCatalogCartSubtotal(
  cart: CatalogCartItem[],
  context: CatalogCartPricingContext = {},
) {
  return roundMoney(
    cart.reduce((total, item) => total + getCatalogCartLineSubtotal(item, context), 0),
  );
}
