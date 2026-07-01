import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAuth, requireRole } from "@/lib/auth/require-auth";
import type { StorefrontContent } from "@/lib/storefront/storefront-content";

type BrandingBannerInput = {
  bannerData?: string;
  bannerMime?: string;
};

type BrandingBody = {
  businessName?: string;
  primaryColor?: string;
  secondaryColor?: string;
  footerText?: string | null;
  phone?: string | null;
  address?: string | null;
  instagramUrl?: string | null;
  facebookUrl?: string | null;
  whatsappNumber?: string | null;
  whatsappMessage?: string | null;
  themeIdentifier?: string;
  logoData?: string | null;
  logoMime?: string | null;
  bannerData?: string | null;
  bannerMime?: string | null;
  isBannerSlider?: boolean;
  banners?: BrandingBannerInput[];
  storefrontContent?: StorefrontContent | null;
};

type BrandingWithBanners = Prisma.BrandingGetPayload<{ include: { banners: true } }>;

function toBase64(data: Uint8Array | null | undefined) {
  return data ? Buffer.from(data).toString("base64") : null;
}

function serializeBranding(branding: BrandingWithBanners | null) {
  if (!branding) {
    return null;
  }

  return {
    ...branding,
    logoData: toBase64(branding.logoData),
    bannerData: toBase64(branding.bannerData),
    banners: branding.banners
      .slice()
      .sort((a, b) => a.orden - b.orden)
      .map((banner) => ({
        id: banner.id,
        bannerData: toBase64(banner.bannerData),
        bannerMime: banner.bannerMime,
        orden: banner.orden,
      })),
  };
}

function hasBannerPayload(banner: BrandingBannerInput): banner is { bannerData: string; bannerMime: string } {
  return typeof banner.bannerData === "string" && typeof banner.bannerMime === "string";
}

export async function GET() {
  const auth = await requireAuth();
  if (!auth.ok) return auth.res;

  try {
    const branding = await prisma.branding.findUnique({
      where: { sucursalId: auth.activeSucursalId },
      include: {
        banners: {
          orderBy: { orden: "asc" },
        },
      },
    });

    return NextResponse.json({ data: serializeBranding(branding) });
  } catch {
    return NextResponse.json({ error: "Error al obtener branding" }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.res;
  if (!requireRole(auth.user, ["ADMIN"])) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  try {
    const body = (await req.json()) as BrandingBody;
    const {
      businessName,
      primaryColor,
      secondaryColor,
      footerText,
      phone,
      address,
      instagramUrl,
      facebookUrl,
      whatsappNumber,
      whatsappMessage,
      themeIdentifier,
      logoData,
      logoMime,
      bannerData,
      bannerMime,
      isBannerSlider,
      banners,
      storefrontContent,
    } = body;

    const updateData: Record<string, unknown> = {
      ...(businessName !== undefined && { businessName }),
      ...(primaryColor !== undefined && { primaryColor }),
      ...(secondaryColor !== undefined && { secondaryColor }),
      ...(footerText !== undefined && { footerText }),
      ...(phone !== undefined && { phone }),
      ...(address !== undefined && { address }),
      ...(instagramUrl !== undefined && { instagramUrl }),
      ...(facebookUrl !== undefined && { facebookUrl }),
      ...(whatsappNumber !== undefined && { whatsappNumber }),
      ...(whatsappMessage !== undefined && { whatsappMessage }),
      ...(themeIdentifier !== undefined && { themeIdentifier }),
      ...(isBannerSlider !== undefined && { isBannerSlider }),
      ...(storefrontContent !== undefined && { storefrontContent: storefrontContent ?? Prisma.JsonNull }),
    };

    if (typeof logoData === "string" && typeof logoMime === "string") {
      updateData.logoData = Buffer.from(logoData, "base64");
      updateData.logoMime = logoMime;
    } else if (logoData === null) {
      updateData.logoData = null;
      updateData.logoMime = null;
    }

    if (typeof bannerData === "string" && typeof bannerMime === "string") {
      updateData.bannerData = Buffer.from(bannerData, "base64");
      updateData.bannerMime = bannerMime;
    } else if (bannerData === null) {
      updateData.bannerData = null;
      updateData.bannerMime = null;
    }

    const brandingActualizado = await prisma.branding.upsert({
      where: { sucursalId: auth.activeSucursalId },
      update: updateData as Prisma.BrandingUncheckedUpdateInput,
      create: {
        sucursalId: auth.activeSucursalId,
        businessName: businessName ?? "Mi Tienda",
        primaryColor: primaryColor ?? "#111827",
        secondaryColor: secondaryColor ?? "#3b82f6",
        footerText: footerText ?? null,
        phone: phone ?? null,
        address: address ?? null,
        instagramUrl: instagramUrl ?? null,
        facebookUrl: facebookUrl ?? null,
        whatsappNumber: whatsappNumber ?? null,
        whatsappMessage: whatsappMessage ?? "Hola, estoy buscando {nombre_producto}",
        themeIdentifier: themeIdentifier ?? "modern",
        isBannerSlider: isBannerSlider ?? false,
        storefrontContent: storefrontContent ?? Prisma.JsonNull,
        ...(typeof logoData === "string" && typeof logoMime === "string"
          ? { logoData: Buffer.from(logoData, "base64"), logoMime }
          : {}),
        ...(typeof bannerData === "string" && typeof bannerMime === "string"
          ? { bannerData: Buffer.from(bannerData, "base64"), bannerMime }
          : {}),
      } as Prisma.BrandingUncheckedCreateInput,
    });

    if (Array.isArray(banners)) {
      await prisma.brandingBanner.deleteMany({
        where: { brandingId: brandingActualizado.id },
      });

      const normalizedBanners = banners.filter(hasBannerPayload);
      if (normalizedBanners.length > 0) {
        await prisma.brandingBanner.createMany({
          data: normalizedBanners.map((banner, index) => ({
            brandingId: brandingActualizado.id,
            bannerData: Buffer.from(banner.bannerData, "base64"),
            bannerMime: banner.bannerMime,
            orden: index,
          })),
        });
      }
    }

    const fullBranding = await prisma.branding.findUnique({
      where: { id: brandingActualizado.id },
      include: {
        banners: {
          orderBy: { orden: "asc" },
        },
      },
    });

    revalidateTag("public-catalog", "default");

    return NextResponse.json({
      message: "Branding actualizado correctamente",
      data: serializeBranding(fullBranding),
    });
  } catch (error) {
    console.error("Error actualizando branding:", error);
    return NextResponse.json({ error: "Error al actualizar branding" }, { status: 500 });
  }
}
