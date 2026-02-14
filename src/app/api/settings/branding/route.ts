import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

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
  try {
    // Traemos el más reciente (si existe)
    const branding = await prisma.branding.findFirst({
      orderBy: { updatedAt: "desc" },
    });

    // Si no existe, lo creamos una vez (singleton)
    if (!branding) {
      const created = await prisma.branding.create({
        data: DEFAULT_BRANDING,
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
  try {
    const body = await req.json();

    // Tomamos el registro actual (singleton por “último updated”)
    const current = await prisma.branding.findFirst({
      orderBy: { updatedAt: "desc" },
    });

    const data = {
      businessName: typeof body.businessName === "string" ? body.businessName : undefined,
      logoUrl: body.logoUrl === null || typeof body.logoUrl === "string" ? body.logoUrl : undefined,
      primaryColor: typeof body.primaryColor === "string" ? body.primaryColor : undefined,
      footerText: body.footerText === null || typeof body.footerText === "string" ? body.footerText : undefined,
      phone: body.phone === null || typeof body.phone === "string" ? body.phone : undefined,
      address: body.address === null || typeof body.address === "string" ? body.address : undefined,
    };

    const updated = current
      ? await prisma.branding.update({
          where: { id: current.id },
          data,
        })
      : await prisma.branding.create({
          data: {
            ...DEFAULT_BRANDING,
            ...data,
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
