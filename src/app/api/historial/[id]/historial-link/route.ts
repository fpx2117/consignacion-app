import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { decryptCode, encryptCode, generateShortCode, hashCode } from "@/lib/share-links";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const mes = parseInt(id);
  const anio = parseInt(new URL(req.url).searchParams.get("anio") || "2026");
  const targetId = (anio * 100) + mes;

  const periodTargetId = anio * 100 + mes; // Ej: 202602

const existing = await prisma.shareLink.findFirst({
  where: {
    type: "HISTORIAL_INVENTARIO", // Coincide con tu Enum ShareLinkType
    expiresAt: {
      gt: new Date()
    },
    views: {
      lt: 15 // O el límite que tengas definido
    },
    // 👇 ESTO ES LO QUE TE FALTA AGREGAR:
    targetId: periodTargetId, 
  },
  orderBy: {
    createdAt: "desc"
  }
});

  if (existing) return NextResponse.json({ url: `/x/${decryptCode(existing.codeEnc)}` });

  const code = generateShortCode(8);
  await prisma.shareLink.create({
    data: {
      codeHash: hashCode(code),
      codeEnc: encryptCode(code),
      type: "HISTORIAL_INVENTARIO",
      targetId,
      expiresAt: new Date(Date.now() + 86400000), // 24hs
      maxViews: 15
    }
  });

  return NextResponse.json({ url: `/x/${code}` });
}