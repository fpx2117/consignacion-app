import { NextResponse } from "next/server";
import {
  getPublicCatalogDataCached,
  PublicCatalogError,
  trackPublicCatalogVisit,
} from "@/lib/public-catalog";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const sucursalIdParam = searchParams.get("sucursalId");
  const sucursalIdParsed = sucursalIdParam ? Number(sucursalIdParam) : null;

  if (sucursalIdParam && (sucursalIdParsed === null || !Number.isFinite(sucursalIdParsed) || sucursalIdParsed <= 0)) {
    return NextResponse.json({ error: "sucursalId inválido" }, { status: 400 });
  }

  const sucursalId = sucursalIdParsed;

  try {
    const data = await getPublicCatalogDataCached(sucursalId);

    if (data?.config?.sucursalId) {
      void trackPublicCatalogVisit(data.config.sucursalId, req.headers).catch((visitError) => {
        console.warn("Catalog visit tracking failed:", visitError);
      });
    }

    return NextResponse.json({ data }, {
      headers: {
        "Cache-Control": "public, s-maxage=60, stale-while-revalidate=60",
      },
    });
  } catch (error: unknown) {
    if (error instanceof PublicCatalogError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("Error public lista-precios:", error);
    return NextResponse.json({ error: "Error al obtener los productos" }, { status: 500 });
  }
}
