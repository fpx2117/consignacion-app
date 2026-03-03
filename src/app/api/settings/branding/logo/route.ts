/* eslint-disable */
// @ts-nocheck
// src/app/api/settings/branding/logo/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/requireAuth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  try {
    const branding = await prisma.branding.findFirst({
      orderBy: { updatedAt: "desc" },
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
  } catch (e) {
    console.error("GET BRANDING LOGO ERROR:", e);
    return new NextResponse("Error", { status: 500 });
  }
}

export async function DELETE() {
  try {
    // Buscamos el último branding (el que usás como vigente)
    const branding = await prisma.branding.findFirst({
      orderBy: { updatedAt: "desc" },
      select: { id: true },
    });

    // Si no hay registro, lo tratamos como "ya está borrado"
    if (!branding?.id) {
      return NextResponse.json({ ok: true });
    }

    // Limpia logo + actualiza updatedAt
    await prisma.branding.update({
      where: { id: branding.id },
      data: {
        logoData: null,
        logoMime: null,
      },
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("DELETE BRANDING LOGO ERROR:", e);
    return NextResponse.json(
      { ok: false, error: "Error eliminando logo" },
      { status: 500 }
    );
  }
}
