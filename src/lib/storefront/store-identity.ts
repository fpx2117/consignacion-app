import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { getTiendaGlobalConfig } from "@/lib/storefront/tienda-global";
import { LOGOS } from "@/theme/know-design-system";

/** En modo unificado el branding/pagos de la tienda combinada salen de la
 * sucursal principal; en modo por-slug, cada sucursal es su propia tienda.
 * Misma resolución que ya usaba `getPublicCatalogDataRaw`, extraída para
 * no duplicarla en el resolver de metadata del storefront. */
export async function resolveStorefrontSucursalId(
  sucursalId: number | null,
): Promise<{ resolvedId: number; modoUnificado: boolean }> {
  const { modoUnificado } = await getTiendaGlobalConfig();
  if (!modoUnificado) return { resolvedId: sucursalId || 1, modoUnificado };

  const principal = await prisma.sucursal.findFirst({
    where: { esPrincipal: true },
    select: { id: true },
  });
  return { resolvedId: principal?.id || sucursalId || 1, modoUnificado };
}

export type StoreIdentity = {
  name: string;
  hasLogo: boolean;
};

export async function getStoreIdentity(
  sucursalId: number,
): Promise<StoreIdentity> {
  const sucursal = await prisma.sucursal.findUnique({
    where: { id: sucursalId },
    select: {
      nombre: true,
      branding: { select: { businessName: true, logoData: true } },
    },
  });

  return {
    name:
      sucursal?.branding?.businessName || sucursal?.nombre || "Tienda online",
    hasLogo: Boolean(sucursal?.branding?.logoData),
  };
}

/** Metadata (title/favicon) para `generateMetadata` de `lista/page.tsx` y
 * `[slug]/page.tsx`. Resuelve el `sucursalId` igual que `getPublicCatalogDataRaw`
 * (no-op cuando `modoUnificado` es falso, como en la ruta por slug). */
export async function buildStorefrontMetadata(
  sucursalId: number | null,
): Promise<Metadata> {
  const { resolvedId } = await resolveStorefrontSucursalId(sucursalId);
  const { name, hasLogo } = await getStoreIdentity(resolvedId);
  return {
    title: name,
    icons: {
      icon: hasLogo
        ? `/api/public/branding-media?type=logo&sucursalId=${resolvedId}`
        : LOGOS.favicon,
    },
  };
}

type StorefrontSearchParams =
  Promise<Record<string, string | string[] | undefined>> | undefined;

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

/** `generateMetadata` de `lista/page.tsx` — re-exportado ahí como
 * `generateMetadata` para no crecer ese archivo (ratchet de visual-guard). */
export async function generateListaMetadata({
  searchParams,
}: {
  searchParams?: StorefrontSearchParams;
}): Promise<Metadata> {
  const resolved = searchParams ? await searchParams : undefined;
  const parsed = Number(firstParam(resolved?.sucursalId));
  const sucursalId = Number.isInteger(parsed) && parsed > 0 ? parsed : 1;
  return buildStorefrontMetadata(sucursalId);
}

/** `generateMetadata` de `[slug]/page.tsx`, mismo motivo que la de arriba. */
export async function generateSlugMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const config = await prisma.configuracion.findUnique({
    where: { tiendaSlug: slug },
    select: { sucursalId: true },
  });
  return config ? buildStorefrontMetadata(config.sucursalId) : {};
}
