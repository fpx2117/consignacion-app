import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { decryptCode, encryptCode, generateShortCode, hashCode } from "@/lib/share-links";
import { requireAuth } from "@/lib/requireAuth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Auth: Requiere usuario autenticado
  const auth = await requireAuth();
  if (!auth.ok) return auth.res;
  const { id: idParam } = await params;
  const id = Number(idParam);

  if (!Number.isFinite(id) || id <= 0) {
    return NextResponse.json({ error: "ID inválido" }, { status: 400 });
  }

  const expiresInDays = 7;
  const maxViews = 3;

  const consignacion = await prisma.consignacion.findFirst({
    where: {
      id,
      sucursalId: auth.activeSucursalId,
    },
    select: { id: true },
  });
  if (!consignacion) {
    return NextResponse.json({ error: "Consignación no encontrada" }, { status: 404 });
  }

  const now = new Date();

  // ✅ Reutilizar link activo
  const existing = await prisma.shareLink.findFirst({
    where: {
      type: "REMITO",
      targetId: id,
      expiresAt: { gt: now },
      views: { lt: maxViews },
      maxViews,
    },
    orderBy: { createdAt: "desc" },
  });

  let code: string;

  if (existing) {
    code = decryptCode(existing.codeEnc);
  } else {
    const expiresAt = new Date(Date.now() + expiresInDays * 86400000);

    let created = false;
    code = "";

    for (let i = 0; i < 15; i++) {
      code = generateShortCode(6);
      const codeHash = hashCode(code);

      const used = await prisma.shareLink.findUnique({ where: { codeHash } });
      if (used) continue;

      await prisma.shareLink.create({
        data: {
          codeHash,
          codeEnc: encryptCode(code),
          type: "REMITO",
          targetId: id,
          expiresAt,
          maxViews,
        },
      });

      created = true;
      break;
    }

    if (!created) {
      return NextResponse.json({ error: "No se pudo generar link" }, { status: 500 });
    }
  }

  // ✅ SIEMPRE JSON (sin redirects)
  return NextResponse.json({ url: `/x/${code}` });
}
