import type { CatalogCartItem } from "@/lib/types";

type CatalogCartPricingContext = {
  porcentajeAumentoConsignacion?: number;
  /** Recargo por uso de pasarela de pago (Mercado Pago). Solo se aplica si applyCardInterest es true. */
  porcentajeInteresTarjeta?: number;
  /** true cuando el checkout se realiza vía Mercado Pago (el recargo de tarjeta absorbe el costo de la pasarela). */
  applyCardInterest?: boolean;
};

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

export function getCatalogCartUnitPrice(
  item: Pick<CatalogCartItem, "precioVenta" | "descuentoEfectivo" | "pricingMode">,
  context: CatalogCartPricingContext = {},
) {
  let price: number;

  if (item.descuentoEfectivo?.precioFinal != null) {
    price = Number(item.descuentoEfectivo.precioFinal);
  } else {
    const basePrice = Number(item.precioVenta);
    if (item.pricingMode === "consigne") {
      const surcharge = Number(context.porcentajeAumentoConsignacion) || 0;
      price = basePrice * (1 + surcharge / 100);
    } else {
      price = basePrice;
    }
  }

  if (context.applyCardInterest) {
    const interes = Number(context.porcentajeInteresTarjeta) || 0;
    price = price * (1 + interes / 100);
  }

  return roundMoney(price);
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
