import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/requireAuth";

// GET: Obtener branding de la sucursal activa
export async function GET() {
  const auth = await requireAuth();
  if (!auth.ok) return auth.res;

  try {
    const branding = await prisma.branding.findUnique({
      where: { sucursalId: auth.activeSucursalId },
      include: {
        banners: {
          orderBy: { orden: 'asc' }
        }
      }
    });

    if (!branding) {
      return NextResponse.json({ data: null });
    }

    // Convertir buffers a base64 para el frontend
    const data = {
      ...branding,
      logoData: branding.logoData ? Buffer.from(branding.logoData).toString('base64') : null,
      bannerData: branding.bannerData ? Buffer.from(branding.bannerData).toString('base64') : null,
      banners: branding.banners.map(b => ({
        id: b.id,
        bannerData: Buffer.from(b.bannerData).toString('base64'),
        bannerMime: b.bannerMime,
        orden: b.orden
      }))
    };

    return NextResponse.json({ data });
  } catch (error: any) {
    return NextResponse.json({ error: "Error al obtener branding" }, { status: 500 });
  }
}

// PUT: Actualizar branding
export async function PUT(req: Request) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.res;

  try {
    const body = await req.json();
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
      themeIdentifier,
      logoData, // base64 string
      logoMime,
      bannerData, // base64 string
      bannerMime,
      isBannerSlider,
      banners // array of { bannerData: base64, bannerMime: string }
    } = body;

    const updateData: any = {
      ...(businessName !== undefined && { businessName }),
      ...(primaryColor !== undefined && { primaryColor }),
      ...(secondaryColor !== undefined && { secondaryColor }),
      ...(footerText !== undefined && { footerText }),
      ...(phone !== undefined && { phone }),
      ...(address !== undefined && { address }),
      ...(instagramUrl !== undefined && { instagramUrl }),
      ...(facebookUrl !== undefined && { facebookUrl }),
      ...(whatsappNumber !== undefined && { whatsappNumber }),
      ...(themeIdentifier !== undefined && { themeIdentifier }),
      ...(isBannerSlider !== undefined && { isBannerSlider })
    };

    if (logoData && logoMime) {
      updateData.logoData = Buffer.from(logoData, 'base64');
      updateData.logoMime = logoMime;
    } else if (logoData === null) {
      updateData.logoData = null;
      updateData.logoMime = null;
    }

    if (bannerData && bannerMime) {
      updateData.bannerData = Buffer.from(bannerData, 'base64');
      updateData.bannerMime = bannerMime;
    } else if (bannerData === null) {
      updateData.bannerData = null;
      updateData.bannerMime = null;
    }

    // 1. Upsert branding first
    const brandingActualizado = await prisma.branding.upsert({
      where: { sucursalId: auth.activeSucursalId },
      update: updateData,
      create: {
        ...updateData,
        sucursalId: auth.activeSucursalId,
        businessName: businessName || "Mi Tienda",
      }
    });

    // 2. Sync banners if provided
    if (banners && Array.isArray(banners)) {
      await prisma.brandingBanner.deleteMany({
        where: { brandingId: brandingActualizado.id }
      });
      if (banners.length > 0) {
        await prisma.brandingBanner.createMany({
          data: banners.map((b, idx) => ({
            brandingId: brandingActualizado.id,
            bannerData: Buffer.from(b.bannerData, 'base64'),
            bannerMime: b.bannerMime,
            orden: idx
          }))
        });
      }
    }

    // 3. Re-fetch full object to return to client
    const fullBranding = await prisma.branding.findUnique({
      where: { id: brandingActualizado.id },
      include: { banners: { orderBy: { orden: 'asc' } } }
    });

    return NextResponse.json({
      message: "Branding actualizado correctamente",
      data: {
        ...fullBranding,
        logoData: fullBranding?.logoData ? Buffer.from(fullBranding.logoData).toString('base64') : null,
        bannerData: fullBranding?.bannerData ? Buffer.from(fullBranding.bannerData).toString('base64') : null,
        banners: fullBranding?.banners.map(b => ({
          id: b.id,
          bannerData: Buffer.from(b.bannerData).toString('base64'),
          bannerMime: b.bannerMime,
          orden: b.orden
        }))
      }
    });
  } catch (error: any) {
    console.error("Error actualizando branding:", error);
    return NextResponse.json({ error: "Error al actualizar branding", details: error.message }, { status: 500 });
  }
}

