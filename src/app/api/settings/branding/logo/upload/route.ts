import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/requireAuth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// límites razonables para DB (ajustá)
const MAX_BYTES = 500 * 1024; // 500KB
const ALLOWED = new Set(["image/png", "image/jpeg", "image/webp"]);

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const file = form.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ ok: false, error: "Falta archivo (field: file)" }, { status: 400 });
    }

    if (!ALLOWED.has(file.type)) {
      return NextResponse.json(
        { ok: false, error: "Formato inválido. Usá PNG/JPG/WEBP." },
        { status: 400 }
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const bytes = Buffer.from(arrayBuffer);

    if (bytes.byteLength > MAX_BYTES) {
      return NextResponse.json(
        { ok: false, error: `Imagen muy pesada. Máx ${Math.floor(MAX_BYTES / 1024)}KB.` },
        { status: 400 }
      );
    }

    const current = await prisma.branding.findFirst({
      orderBy: { updatedAt: "desc" },
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
          primaryColor: "#111827",
          logoData: bytes,
          logoMime: file.type,
        },
      });

    return NextResponse.json({ ok: true, brandingId: updated.id });
  } catch (e) {
    console.error("UPLOAD BRANDING LOGO ERROR:", e);
    return NextResponse.json({ ok: false, error: "Error subiendo logo" }, { status: 500 });
  }
}
