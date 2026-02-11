import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { encryptCode, generateShortCode, hashCode, decryptCode } from "@/lib/share-links";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest, 
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params; // Mes (0-11)
    const { searchParams } = new URL(req.url);
    const mes = parseInt(id);
    const anio = parseInt(searchParams.get("anio") || "2026");

    const periodTargetId = (anio * 100) + mes;
    const now = new Date();

    // 1. Intentar reutilizar link activo
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
      return NextResponse.json({ url: `/x/${decryptCode(existing.codeEnc)}` });
    }

    // 2. Generar nuevo link si no existe
    let code = "";
    let created = false;

    for (let i = 0; i < 15; i++) {
      code = generateShortCode(8);
      const codeHash = hashCode(code);
      const used = await prisma.shareLink.findUnique({ where: { codeHash } });
      if (used) continue;

      await prisma.shareLink.create({
        data: {
          codeHash,
          codeEnc: encryptCode(code),
          type: "HISTORIAL_INVENTARIO",
          targetId: periodTargetId,
          expiresAt: new Date(Date.now() + 86400000), // 24hs
          maxViews: 15,
        },
      });
      created = true;
      break;
    }

    return created 
      ? NextResponse.json({ url: `/x/${code}` })
      : NextResponse.json({ error: "Colisión de códigos" }, { status: 500 });

  } catch (error) {
    return NextResponse.json({ error: "Error de servidor" }, { status: 500 });
  }
}