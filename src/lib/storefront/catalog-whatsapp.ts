import type {
  CatalogCartItem,
  PublicCatalogConfig,
  PublicCheckoutCustomerData,
  PublicCheckoutShippingData,
} from "@/lib/types";
import { getCatalogCartLineSubtotal, getCatalogCartSubtotal, getCatalogCartUnitPrice } from "@/lib/storefront/catalog-cart-pricing";

type CatalogWhatsappContext = {
  config: Pick<PublicCatalogConfig, "businessName" | "whatsappNumber" | "porcentajeAumentoConsignacion">;
  cart: CatalogCartItem[];
  clienteData: PublicCheckoutCustomerData;
  envioData: PublicCheckoutShippingData;
  tiendaUrl?: string | null;
};

function formatMoney(value: number) {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })
    .format(value)
    .replace(/\$\s+/u, "$");
}

export function normalizeWhatsAppNumber(value?: string | null) {
  if (!value) return "";
  return String(value).replace(/\D/g, "");
}

export function buildWhatsAppUrl(phone: string | null | undefined, message: string) {
  const normalizedPhone = normalizeWhatsAppNumber(phone);
  if (!normalizedPhone) return null;
  return `https://wa.me/${normalizedPhone}?text=${encodeURIComponent(message)}`;
}

export function buildCatalogProductInquiryUrl(phone: string | null | undefined, template: string | null | undefined, productName: string) {
  const messageTemplate = template?.trim() || "Hola, estoy buscando {nombre_producto}";
  const message = messageTemplate.replaceAll("{nombre_producto}", productName);
  return buildWhatsAppUrl(phone, message);
}

function resolveDeliveryLabel(envioData: PublicCheckoutShippingData) {
  switch (envioData.metodoEnvio) {
    case "UBER_FLASH":
      return "Envio por Uber Flash";
    case "ENCOMIENDA":
      return "Envio por encomienda";
    case "RETIRO_LOCAL":
      return "Retiro por el local";
    default:
      return "A definir";
  }
}

export function buildCatalogCartWhatsappMessage({
  config,
  cart,
  clienteData,
  envioData,
  tiendaUrl,
}: CatalogWhatsappContext) {
  const pricingContext = {
    porcentajeAumentoConsignacion: config.porcentajeAumentoConsignacion,
  };

  const total = getCatalogCartSubtotal(cart, pricingContext);
  const itemsText = cart
    .map((item) => {
      const unitPrice = getCatalogCartUnitPrice(item, pricingContext);
      const subtotal = getCatalogCartLineSubtotal(item, pricingContext);
      return `- ${item.quantity} x ${item.nombre} - ${formatMoney(unitPrice)} c/u = ${formatMoney(subtotal)}`;
    })
    .join("\n");

  const lines = [
    `Hola! Quiero hacer un pedido desde ${config.businessName || "la tienda"}.`,
    "",
    `Cliente: ${clienteData.nombre.trim()}`,
  ];

  if (clienteData.telefono?.trim()) {
    lines.push(`Telefono: ${clienteData.telefono.trim()}`);
  }

  lines.push(`Entrega: ${resolveDeliveryLabel(envioData)}`);

  if (envioData.metodoEnvio === "UBER_FLASH" || envioData.metodoEnvio === "ENCOMIENDA") {
    if (clienteData.direccion?.trim()) {
      lines.push(`Direccion: ${clienteData.direccion.trim()}`);
    }
    if (clienteData.altura?.trim()) {
      lines.push(`Altura: ${clienteData.altura.trim()}`);
    }
    if (clienteData.localidad?.trim()) {
      lines.push(`Localidad: ${clienteData.localidad.trim()}`);
    }
    if (clienteData.provincia?.trim()) {
      lines.push(`Provincia: ${clienteData.provincia.trim()}`);
    }
    lines.push("", "Aclaracion: El costo del envio se cobra aparte del producto. Espero indicaciones por WhatsApp para coordinar el despacho.");
  }

  lines.push("", "Productos:", itemsText, "", `Total estimado: ${formatMoney(total)}`);

  if (tiendaUrl) {
    lines.push("", `Tienda: ${tiendaUrl}`);
  }

  return lines.join("\n");
}

export function buildCatalogCartWhatsappUrl(input: CatalogWhatsappContext) {
  const message = buildCatalogCartWhatsappMessage(input);
  return buildWhatsAppUrl(input.config.whatsappNumber, message);
}
