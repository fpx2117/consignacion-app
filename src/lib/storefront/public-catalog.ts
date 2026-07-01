import { Prisma } from "@prisma/client";
import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";
import { registerCatalogVisit } from "@/lib/analytics/catalog-visit";
import { normalizeStorefrontContent } from "@/lib/storefront/storefront-content";
import type { PublicCatalogData, OnlineStoreSettings } from "@/lib/types";
import { calcularDescuentoEfectivo } from "@/lib/storefront/descuento-utils";

function readOptionalString(record: Record<string, unknown> | null | undefined, key: string) {
  const value = record?.[key];
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

export class PublicCatalogError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "PublicCatalogError";
    this.status = status;
  }
}

export async function getPublicCatalogDataRaw(sucursalId: number | null): Promise<PublicCatalogData> {
  const resolvedId = sucursalId || 1;
  const config = await prisma.configuracion.findUnique({
    where: { sucursalId: resolvedId },
    include: {
      sucursal: {
        include: {
          branding: {
            include: {
              banners: {
                orderBy: { orden: "asc" },
              },
            },
          },
        },
      },
    },
  });

  // Obtener StoreSettings con onlineStoreConfig
  const storeSettings = await prisma.storeSettings.findUnique({
    where: { sucursalId: resolvedId },
    select: { onlineStoreConfig: true },
  });

  if (!config || !config.mostrarListaPrecios) {
    throw new PublicCatalogError("La lista de precios no está habilitada", 403);
  }

  const where: Prisma.ProductoWhereInput = { activo: true };
  if (config.separarListaPorSucursal) {
    where.sucursalId = config.sucursalId;
  }

  const [productos, categorias] = await Promise.all([
    prisma.producto.findMany({
      where,
      select: {
        id: true,
        nombre: true,
        precioVenta: true,
        imagenUrl: true,
        categoriaId: true,
        subcategoriaId: true,
        stockDisponibleUnits: true,
        descuentoActivo: true,
        tipoDescuento: true,
        descuentoPorcentaje: true,
        descuentoMonto: true,
        descuentoDesde: true,
        descuentoHasta: true,
        categoria: {
          select: {
            id: true,
            nombre: true,
          },
        },
        subcategoria: {
          select: {
            id: true,
            nombre: true,
          },
        },
      },
      orderBy: { nombre: "asc" },
    }),
    prisma.categoria.findMany({
      include: {
        subcategorias: {
          orderBy: { nombre: "asc" },
        },
      },
      orderBy: { nombre: "asc" },
    }),
  ]);

  const brandingExtra = config.sucursal.branding as Record<string, unknown> | null | undefined;

  const ahora = new Date();

  // Modo de pago de la tienda: el usuario elige explícitamente WhatsApp o Mercado Pago en
  // settings (tiendaMetodoPago), mutuamente excluyente. Las credenciales de MP se conservan
  // guardadas aunque el método activo sea WhatsApp, así no se pierden al cambiar de modo.
  const hasMpCredentials = Boolean(
    config.mpAccessTokenTienda?.trim() && config.mpPublicKeyTienda?.trim(),
  );
  const hasWhatsappNumber = Boolean(config.sucursal.branding?.whatsappNumber?.trim());
  const tiendaPaymentMode: "mercadopago" | "whatsapp" | null = !config.convertirTienda
    ? null
    : config.tiendaMetodoPago === "mercadopago" && hasMpCredentials
      ? "mercadopago"
      : config.tiendaMetodoPago === "whatsapp" && hasWhatsappNumber
        ? "whatsapp"
        : null;

  const productosConDescuento = productos.map((p) => ({
    ...p,
    descuentoEfectivo: calcularDescuentoEfectivo({
      descuentoActivo: p.descuentoActivo,
      tipoDescuento: p.tipoDescuento,
      descuentoPorcentaje: p.descuentoPorcentaje ? Number(p.descuentoPorcentaje) : null,
      descuentoMonto: p.descuentoMonto ? Number(p.descuentoMonto) : null,
      descuentoDesde: p.descuentoDesde,
      descuentoHasta: p.descuentoHasta,
      precioVenta: Number(p.precioVenta),
    }, ahora),
  }));

  const payload: PublicCatalogData = {
    productos: productosConDescuento,
    categorias,
    config: {
      sucursalId: config.sucursalId,
      businessName: config.sucursal.branding?.businessName || config.sucursal.nombre,
      primaryColor: config.sucursal.branding?.primaryColor || "var(--theme-modern-primary)",
      secondaryColor: config.sucursal.branding?.secondaryColor || "var(--theme-ocean-primary)",
      logoMime: config.sucursal.branding?.logoMime,
      logoData: null,
      logoUrl: config.sucursal.branding?.logoData
        ? `/api/public/branding-media?type=logo&sucursalId=${config.sucursalId}`
        : null,
      bannerMime: config.sucursal.branding?.bannerMime,
      bannerData: null,
      bannerUrl: config.sucursal.branding?.bannerData
        ? `/api/public/branding-media?type=banner&sucursalId=${config.sucursalId}`
        : null,
      isBannerSlider: config.sucursal.branding?.isBannerSlider || false,
      banners: config.sucursal.branding?.banners
          ? config.sucursal.branding.banners.map((b) => ({
              id: b.id,
            bannerData: null,
            bannerMime: b.bannerMime,
            orden: b.orden,
            url: `/api/public/branding-media?type=slider&sucursalId=${config.sucursalId}&bannerId=${b.id}`,
          }))
        : [],
      instagramUrl: config.sucursal.branding?.instagramUrl,
      tiktokUrl: readOptionalString(brandingExtra, "tiktokUrl"),
      facebookUrl: config.sucursal.branding?.facebookUrl,
      youtubeUrl: readOptionalString(brandingExtra, "youtubeUrl"),
      whatsappNumber: config.sucursal.branding?.whatsappNumber,
      whatsappMessage: config.sucursal.branding?.whatsappMessage,
      phone: config.sucursal.branding?.phone,
      address: config.sucursal.branding?.address,
      googleMapsUrl: readOptionalString(brandingExtra, "googleMapsUrl"),
      footerText: config.sucursal.branding?.footerText,
      typography: readOptionalString(brandingExtra, "typography"),
      themeIdentifier: config.sucursal.branding?.themeIdentifier || "modern",
      tiendaLayout: config.tiendaLayout,
      mostrarCategoriasEnHeader: config.mostrarCategoriasEnHeader,
      convertirTienda: config.convertirTienda,
      mostrarPreciosConsignacion: config.mostrarPreciosConsignacion,
      porcentajeAumentoConsignacion: config.porcentajeAumentoConsignacion,
      porcentajeInteresTarjeta: config.porcentajeInteresTarjeta,
      mpPublicKeyTienda: config.mpPublicKeyTienda,
      tiendaPaymentMode,
      storefrontContent: normalizeStorefrontContent(brandingExtra?.storefrontContent, {
        storeName: config.sucursal.branding?.businessName || config.sucursal.nombre,
      }),
      onlineStoreConfig: (storeSettings?.onlineStoreConfig as unknown as OnlineStoreSettings | undefined) ?? null,
    },
  };

  return JSON.parse(JSON.stringify(payload));
}

export const getPublicCatalogDataCached = unstable_cache(
  async (sucursalId: number | null) => getPublicCatalogDataRaw(sucursalId),
  ["public-catalog-data"],
  {
    revalidate: 120,
    tags: ["public-catalog"],
  },
);

export async function trackPublicCatalogVisit(sucursalId: number, requestHeaders: Headers) {
  await registerCatalogVisit({
    sucursalId,
    headers: requestHeaders,
  });
}
