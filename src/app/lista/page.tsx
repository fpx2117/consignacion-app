import { headers } from "next/headers";
import { CatalogClient } from "./catalog-client";
import {
  getPublicCatalogDataCached,
  PublicCatalogError,
  trackPublicCatalogVisit,
} from "@/lib/public-catalog";
import type { PublicCatalogData } from "@/lib/types";

type SearchParams = {
  sucursalId?: string;
  status?: string;
};

export default async function PublicCatalogPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const sucursalIdParam = params?.sucursalId;
  const checkoutReturnStatus = params?.status ?? null;

  let sucursalId: number | null = null;
  if (sucursalIdParam) {
    const parsed = Number(sucursalIdParam);
    if (Number.isFinite(parsed) && parsed > 0) {
      sucursalId = parsed;
    }
  }

  let initialData: PublicCatalogData | null = null;
  let initialError: string | null = null;

  try {
    initialData = await getPublicCatalogDataCached(sucursalId);
    const h = await headers();
    if (initialData?.config?.sucursalId) {
      void trackPublicCatalogVisit(initialData.config.sucursalId, h).catch(() => {});
    }
  } catch (error: unknown) {
    if (error instanceof PublicCatalogError) {
      initialError = error.message;
    } else {
      initialError = "Error al cargar el catálogo";
    }
  }

  return (
    <CatalogClient
      key={`${sucursalId ?? "default"}-${checkoutReturnStatus ?? "none"}`}
      initialData={initialData}
      initialError={initialError}
      sucursalId={sucursalId}
      checkoutReturnStatus={checkoutReturnStatus}
    />
  );
}
