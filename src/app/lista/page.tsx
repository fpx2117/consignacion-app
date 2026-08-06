import { notFound } from "next/navigation";
import { getTiendaGlobalConfig } from "@/lib/storefront/tienda-global";
import { renderCatalogPage } from "./render-catalog-page";
export { generateListaMetadata as generateMetadata } from "@/lib/storefront/store-identity";

export const dynamic = "force-dynamic";
type ListaPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function getSingleSearchParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function getSucursalIdFromSearchParams(value: string | undefined) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 1;
}

function getCheckoutReturnStatus(value: string | undefined) {
  if (value === "success" || value === "failure" || value === "pending") {
    return value;
  }

  return null;
}

export default async function ListaPage({ searchParams }: ListaPageProps) {
  const { modoUnificado } = await getTiendaGlobalConfig();
  if (!modoUnificado) {
    // La tienda unificada está apagada: el negocio eligió que cada sucursal
    // tenga su propia URL (/[slug]) en vez de un catálogo combinado en /lista.
    notFound();
  }

  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const sucursalId = getSucursalIdFromSearchParams(
    getSingleSearchParam(resolvedSearchParams?.sucursalId),
  );
  const checkoutReturnStatus = getCheckoutReturnStatus(
    getSingleSearchParam(resolvedSearchParams?.status),
  );

  return renderCatalogPage(sucursalId, checkoutReturnStatus);
}
