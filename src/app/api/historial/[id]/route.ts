import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { encryptCode, generateShortCode, hashCode, decryptCode } from "@/lib/share-links";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params; // Mes (0-11)
    const { searchParams } = new URL(req.url);

    const mes = Number.parseInt(id, 10);
    const anio = Number.parseInt(searchParams.get("anio") || "2026", 10);

    if (!Number.isFinite(mes) || mes < 0 || mes > 11) {
      return NextResponse.json({ error: "Mes inválido (debe ser 0..11)" }, { status: 400 });
    }
    if (!Number.isFinite(anio) || anio < 2000 || anio > 2100) {
      return NextResponse.json({ error: "Año inválido" }, { status: 400 });
    }

    const periodTargetId = anio * 100 + mes;
    const now = new Date();

    // 1) Intentar reutilizar link activo
    const existing = await prisma.shareLink.findFirst({
      where: {
        type: "HISTORIAL_INVENTARIO",
        targetId: periodTargetId,
        expiresAt: { gt: now },
        views: { lt: 15 },
      },
      orderBy: { createdAt: "desc" },
    });

    if (existing) {
      // existing.codeEnc es el código encriptado; decryptCode devuelve el short-code "visible"
      const code = decryptCode(existing.codeEnc);
      return NextResponse.json({ url: `/x/${code}` });
    }

    // 2) Generar nuevo link si no existe
    for (let i = 0; i < 15; i++) {
      const code = generateShortCode(8);
      const codeHash = hashCode(code);

      const used = await prisma.shareLink.findUnique({ where: { codeHash } });
      if (used) continue;

      await prisma.shareLink.create({
        data: {
          codeHash,
          codeEnc: encryptCode(code),
          type: "HISTORIAL_INVENTARIO",
          targetId: periodTargetId,
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24hs
          maxViews: 15,
        },
      });

      return NextResponse.json({ url: `/x/${code}` });
    }

    return NextResponse.json({ error: "Colisión de códigos" }, { status: 500 });
  } catch (error) {
    console.error("HISTORIAL_INVENTARIO SHARELINK ERROR:", error);
    return NextResponse.json({ error: "Error de servidor" }, { status: 500 });
  }
}
