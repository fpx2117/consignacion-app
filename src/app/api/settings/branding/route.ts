import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/requireAuth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const DEFAULT_BRANDING = {
  businessName: "",
  logoUrl: null as string | null,
  primaryColor: "#111827",
  footerText: null as string | null,
  phone: null as string | null,
  address: null as string | null,
};

export async function GET() {
  const auth = await requireAuth();
  if (!auth.ok) return auth.res;

  try {
    const branding = await prisma.branding.findUnique({
      where: { sucursalId: auth.activeSucursalId },
      select: { logoData: true, logoMime: true },
    });

    if (!branding) {
      const created = await prisma.branding.create({
        data: {
          ...DEFAULT_BRANDING,
          sucursalId: auth.activeSucursalId,
        },
      });

      return NextResponse.json({ ok: true, branding: created });
    }

    return NextResponse.json({ ok: true, branding });
  } catch (error) {
    console.error("GET BRANDING ERROR:", error);
    return NextResponse.json(
      { ok: false, error: "Error obteniendo branding" },
      { status: 500 }
    );
  }
}

export async function PUT(req: NextRequest) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.res;

  try {
    const body = await req.json();

    const data = {
      businessName: typeof body.businessName === "string" ? body.businessName : undefined,
      logoUrl: body.logoUrl === null || typeof body.logoUrl === "string" ? body.logoUrl : undefined,
      primaryColor: typeof body.primaryColor === "string" ? body.primaryColor : undefined,
      footerText: body.footerText === null || typeof body.footerText === "string" ? body.footerText : undefined,
      phone: body.phone === null || typeof body.phone === "string" ? body.phone : undefined,
      address: body.address === null || typeof body.address === "string" ? body.address : undefined,
    };

    const updated = await prisma.branding.upsert({
      where: { sucursalId: auth.activeSucursalId },
      update: data,
      create: {
        ...DEFAULT_BRANDING,
        ...data,
        sucursalId: auth.activeSucursalId,
        businessName: data.businessName ?? DEFAULT_BRANDING.businessName,
        primaryColor: data.primaryColor ?? DEFAULT_BRANDING.primaryColor,
      },
    });

    return NextResponse.json({ ok: true, branding: updated });
  } catch (error) {
    console.error("PUT BRANDING ERROR:", error);
    return NextResponse.json(
      { ok: false, error: "Error actualizando branding" },
      { status: 500 }
    );
  }
}
