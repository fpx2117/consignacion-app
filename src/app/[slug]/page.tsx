import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getTiendaGlobalConfig } from "@/lib/storefront/tienda-global";
import { isValidSlugFormat } from "@/lib/storefront/slug";
import { renderCatalogPage } from "@/app/lista/render-catalog-page";

export const dynamic = "force-dynamic";

type SlugPageProps = {
  params: Promise<{ slug: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function getSingleSearchParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function getCheckoutReturnStatus(value: string | undefined) {
  if (value === "success" || value === "failure" || value === "pending") {
    return value;
  }
  return null;
}

export default async function TiendaPorSlugPage({ params, searchParams }: SlugPageProps) {
  const { slug } = await params;

  if (!isValidSlugFormat(slug)) {
    notFound();
  }

  const { modoUnificado } = await getTiendaGlobalConfig();
  if (modoUnificado) {
    // La tienda unificada está activa: no hay tiendas individuales por slug.
    notFound();
  }

  const config = await prisma.configuracion.findUnique({
    where: { tiendaSlug: slug },
    select: {
      sucursalId: true,
      mostrarEnTiendaOnline: true,
      sucursal: { select: { activa: true } },
    },
  });

  if (!config || !config.mostrarEnTiendaOnline || !config.sucursal.activa) {
    notFound();
  }

  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const checkoutReturnStatus = getCheckoutReturnStatus(
    getSingleSearchParam(resolvedSearchParams?.status),
  );

  return renderCatalogPage(config.sucursalId, checkoutReturnStatus);
}
