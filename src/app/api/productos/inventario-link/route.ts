/* eslint-disable */
// @ts-nocheck

//src/app/api/productos/inventario-link/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { decryptCode, encryptCode, generateShortCode, hashCode } from "@/lib/share-links";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  // Obtenemos sucursalId de la query si existe
  const { searchParams } = new URL(req.url);
  const sucursalId = searchParams.get("sucursalId");
  const targetId = sucursalId ? Number(sucursalId) : 0;

  // Configuraciones del link
  const expiresInDays = 1;
  const maxViews = 20;

  const now = new Date();

  // ✅ 1. Reutilizar link activo para evitar duplicados en la DB
  const existing = await prisma.shareLink.findFirst({
    where: {
      type: "INVENTARIO",
      targetId,
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
    // ✅ 2. Generar nuevo link si no hay uno válido
    const expiresAt = new Date(Date.now() + expiresInDays * 86400000);

    let created = false;
    code = "";

    for (let i = 0; i < 15; i++) {
      code = generateShortCode(8);
      const codeHash = hashCode(code);

      const used = await prisma.shareLink.findUnique({ where: { codeHash } });
      if (used) continue;

      await prisma.shareLink.create({
        data: {
          codeHash,
          codeEnc: encryptCode(code),
          type: "INVENTARIO",
          targetId,
          expiresAt,
          maxViews,
        },
      });

      created = true;
      break;
    }

    if (!created) {
      return NextResponse.json({ error: "No se pudo generar link de inventario" }, { status: 500 });
    }
  }

  // ✅ SIEMPRE JSON
  return NextResponse.json({ url: `/x/${code}` });
}