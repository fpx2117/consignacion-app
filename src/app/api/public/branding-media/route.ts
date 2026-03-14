import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const sucursalIdParam = searchParams.get("sucursalId");
  const type = searchParams.get("type");
  const bannerIdParam = searchParams.get("bannerId");

  const sucursalId = sucursalIdParam ? Number(sucursalIdParam) : NaN;
  if (!Number.isFinite(sucursalId) || sucursalId <= 0) {
    return badRequest("sucursalId inválido");
  }

  if (type !== "logo" && type !== "banner" && type !== "slider") {
    return badRequest("type inválido");
  }

  const branding = await prisma.branding.findUnique({
    where: { sucursalId },
    select: {
      logoData: true,
      logoMime: true,
      bannerData: true,
      bannerMime: true,
      banners: {
        select: {
          id: true,
          bannerData: true,
          bannerMime: true,
        },
      },
    },
  });

  if (!branding) {
    return NextResponse.json({ error: "Branding no encontrado" }, { status: 404 });
  }

  let body: Buffer | null = null;
  let contentType: string | null = null;

  if (type === "logo") {
    body = branding.logoData ? Buffer.from(branding.logoData) : null;
    contentType = branding.logoMime || null;
  }

  if (type === "banner") {
    body = branding.bannerData ? Buffer.from(branding.bannerData) : null;
    contentType = branding.bannerMime || null;
  }

  if (type === "slider") {
    const bannerId = bannerIdParam ? Number(bannerIdParam) : NaN;
    if (!Number.isFinite(bannerId) || bannerId <= 0) {
      return badRequest("bannerId inválido");
    }
    const selected = branding.banners.find((b) => b.id === bannerId);
    body = selected?.bannerData ? Buffer.from(selected.bannerData) : null;
    contentType = selected?.bannerMime || null;
  }

  if (!body || !contentType) {
    return NextResponse.json({ error: "Media no encontrada" }, { status: 404 });
  }

  return new NextResponse(new Uint8Array(body), {
    status: 200,
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800",
      "Content-Length": String(body.byteLength),
    },
  });
}
