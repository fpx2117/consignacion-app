import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const sucursalIdParam = searchParams.get("sucursalId");
  const sucursalId = sucursalIdParam ? Number(sucursalIdParam) : 1;

  if (!Number.isFinite(sucursalId) || sucursalId <= 0) {
    return NextResponse.json({ error: "sucursalId inválido" }, { status: 400 });
  }

  try {
    const [branding, storeSettings] = await Promise.all([
      prisma.branding.findUnique({
        where: { sucursalId },
        select: {
          businessName: true,
          primaryColor: true,
          secondaryColor: true,
          themeIdentifier: true,
          bannerData: true,
          bannerMime: true,
          logoData: true,
          logoMime: true,
          storefrontContent: true,
          footerText: true,
          phone: true,
          address: true,
          whatsappNumber: true,
          whatsappMessage: true,
          facebookUrl: true,
          instagramUrl: true,
          isBannerSlider: true,
        },
      }),
      prisma.storeSettings.findUnique({
        where: { sucursalId },
        select: { themeConfig: true },
      }),
    ]);

    const bannerBase64 = branding?.bannerData
      ? Buffer.from(branding.bannerData).toString("base64")
      : null;

    const logoBase64 = branding?.logoData
      ? Buffer.from(branding.logoData).toString("base64")
      : null;

    return NextResponse.json({
      businessName: branding?.businessName ?? null,
      primaryColor: branding?.primaryColor ?? "#111827",
      secondaryColor: branding?.secondaryColor ?? "#3b82f6",
      themeIdentifier: branding?.themeIdentifier ?? "modern",
      bannerData: bannerBase64,
      bannerMime: branding?.bannerMime ?? null,
      logoData: logoBase64,
      logoMime: branding?.logoMime ?? null,
      storefrontContent: branding?.storefrontContent ?? null,
      footerText: branding?.footerText ?? null,
      phone: branding?.phone ?? null,
      address: branding?.address ?? null,
      whatsappNumber: branding?.whatsappNumber ?? null,
      whatsappMessage: branding?.whatsappMessage ?? null,
      facebookUrl: branding?.facebookUrl ?? null,
      instagramUrl: branding?.instagramUrl ?? null,
      isBannerSlider: branding?.isBannerSlider ?? false,
      storeSettings: storeSettings ?? null,
    }, {
      headers: {
        "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
      },
    });
  } catch (error) {
    console.error("Error al obtener config de storefront:", error);
    return NextResponse.json(
      { error: "Error al obtener configuración del storefront" },
      { status: 500 }
    );
  }
}
