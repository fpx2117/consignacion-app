import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, requireRole } from "@/lib/auth/require-auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MAX_BYTES = 500 * 1024;
const ALLOWED = new Set(["image/png", "image/jpeg", "image/webp"]);

export async function POST(req: NextRequest) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.res;
  if (!requireRole(auth.user, ["ADMIN"])) {
    return NextResponse.json(
      { ok: false, error: "No autorizado" },
      { status: 403 },
    );
  }

  try {
    const form = await req.formData();
    const file = form.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json(
        { ok: false, error: "Falta archivo (field: file)" },
        { status: 400 },
      );
    }

    if (!ALLOWED.has(file.type)) {
      return NextResponse.json(
        { ok: false, error: "Formato invalido. Usa PNG/JPG/WEBP." },
        { status: 400 },
      );
    }

    const bytes = Buffer.from(await file.arrayBuffer());

    if (bytes.byteLength > MAX_BYTES) {
      return NextResponse.json(
        {
          ok: false,
          error: `Imagen muy pesada. Max ${Math.floor(MAX_BYTES / 1024)}KB.`,
        },
        { status: 400 },
      );
    }

    const current = await prisma.branding.findUnique({
      where: { sucursalId: auth.activeSucursalId },
      select: { id: true },
    });

    const updated = current
      ? await prisma.branding.update({
          where: { id: current.id },
          data: { logoData: bytes, logoMime: file.type },
        })
      : await prisma.branding.create({
          data: {
            businessName: "",
            primaryColor: "var(--theme-modern-primary)",
            logoData: bytes,
            logoMime: file.type,
            sucursalId: auth.activeSucursalId,
          },
        });

    return NextResponse.json({ ok: true, brandingId: updated.id });
  } catch (error) {
    console.error("UPLOAD BRANDING LOGO ERROR:", error);
    return NextResponse.json(
      { ok: false, error: "Error subiendo logo" },
      { status: 500 },
    );
  }
}
