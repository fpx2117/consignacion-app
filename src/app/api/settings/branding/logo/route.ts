import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, requireRole } from "@/lib/auth/require-auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const auth = await requireAuth();
  if (!auth.ok) return auth.res;

  try {
    const branding = await prisma.branding.findUnique({
      where: { sucursalId: auth.activeSucursalId },
      select: { logoData: true, logoMime: true },
    });

    if (!branding?.logoData || !branding.logoMime) {
      return new NextResponse("No logo", { status: 404 });
    }

    return new NextResponse(Buffer.from(branding.logoData), {
      headers: {
        "Content-Type": branding.logoMime,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("GET BRANDING LOGO ERROR:", error);
    return new NextResponse("Error", { status: 500 });
  }
}

export async function DELETE() {
  const auth = await requireAuth();
  if (!auth.ok) return auth.res;
  if (!requireRole(auth.user, ["ADMIN"])) {
    return NextResponse.json(
      { ok: false, error: "No autorizado" },
      { status: 403 },
    );
  }

  try {
    const branding = await prisma.branding.findUnique({
      where: { sucursalId: auth.activeSucursalId },
      select: { id: true },
    });

    if (!branding?.id) {
      return NextResponse.json({ ok: true });
    }

    await prisma.branding.update({
      where: { id: branding.id },
      data: {
        logoData: null,
        logoMime: null,
      },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("DELETE BRANDING LOGO ERROR:", error);
    return NextResponse.json(
      { ok: false, error: "Error eliminando logo" },
      { status: 500 },
    );
  }
}
