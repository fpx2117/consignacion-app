import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";
import { registerCatalogVisit } from "@/lib/analytics/catalog-visit";
import type { PublicCatalogData } from "@/lib/types";

export class PublicCatalogError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "PublicCatalogError";
    this.status = status;
  }
}

export async function getPublicCatalogDataRaw(sucursalId: number | null): Promise<PublicCatalogData> {
  const config = (await prisma.configuracion.findUnique({
    where: { sucursalId: sucursalId || 1 },
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
  })) as any;

  if (!config || !config.mostrarListaPrecios) {
    throw new PublicCatalogError("La lista de precios no está habilitada", 403);
  }

  const where: any = { activo: true };
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

  const payload: PublicCatalogData = {
    productos,
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
        ? config.sucursal.branding.banners.map((b: any) => ({
            id: b.id,
            bannerData: null,
            bannerMime: b.bannerMime,
            orden: b.orden,
            url: `/api/public/branding-media?type=slider&sucursalId=${config.sucursalId}&bannerId=${b.id}`,
          }))
        : [],
      instagramUrl: config.sucursal.branding?.instagramUrl,
      tiktokUrl: config.sucursal.branding?.tiktokUrl,
      facebookUrl: config.sucursal.branding?.facebookUrl,
      youtubeUrl: config.sucursal.branding?.youtubeUrl,
      whatsappNumber: config.sucursal.branding?.whatsappNumber,
      whatsappMessage: config.sucursal.branding?.whatsappMessage,
      phone: config.sucursal.branding?.phone,
      address: config.sucursal.branding?.address,
      googleMapsUrl: config.sucursal.branding?.googleMapsUrl,
      footerText: config.sucursal.branding?.footerText,
      typography: config.sucursal.branding?.typography,
      themeIdentifier: config.sucursal.branding?.themeIdentifier || "modern",
      tiendaLayout: config.tiendaLayout,
      mostrarCategoriasEnHeader: config.mostrarCategoriasEnHeader,
      convertirTienda: config.convertirTienda,
      mostrarPreciosConsignacion: config.mostrarPreciosConsignacion,
      porcentajeAumentoConsignacion: config.porcentajeAumentoConsignacion,
      porcentajeInteresTarjeta: config.porcentajeInteresTarjeta,
      mpPublicKeyTienda: config.mpPublicKeyTienda,
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
