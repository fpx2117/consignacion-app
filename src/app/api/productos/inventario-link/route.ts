/* eslint-disable */
// @ts-nocheck

//src/app/api/productos/inventario-link/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { decryptCode, encryptCode, generateShortCode, hashCode } from "@/lib/share-links";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(_req: NextRequest) {
  // Configuraciones del link
  const expiresInDays = 1; // El inventario suele ser más volátil, 24hs está bien
  const maxViews = 10;     // Permitimos más aperturas que en un ticket

  const now = new Date();

  // ✅ 1. Reutilizar link activo para evitar duplicados en la DB
  // Buscamos un link de tipo INVENTARIO que no haya expirado y tenga vistas disponibles
  const existing = await prisma.shareLink.findFirst({
    where: {
      type: "INVENTARIO",
      targetId: 0, // Usamos 0 para el inventario general
      expiresAt: { gt: now },
      views: { lt: maxViews },
      maxViews,
    },
    orderBy: { createdAt: "desc" },
  });

  let code: string;

  if (existing) {
    // Si existe, desencriptamos el código para devolverlo
    code = decryptCode(existing.codeEnc);
  } else {
    // ✅ 2. Generar nuevo link si no hay uno válido
    const expiresAt = new Date(Date.now() + expiresInDays * 86400000);

    let created = false;
    code = "";

    // Intento de generación (mismo loop de colisiones que ticket-link)
    for (let i = 0; i < 15; i++) {
      code = generateShortCode(8); // Un poco más largo para inventario
      const codeHash = hashCode(code);

      const used = await prisma.shareLink.findUnique({ where: { codeHash } });
      if (used) continue;

      await prisma.shareLink.create({
        data: {
          codeHash,
          codeEnc: encryptCode(code), // Usamos tu función de encriptación
          type: "INVENTARIO",
          targetId: 0, 
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

  // ✅ SIEMPRE JSON (Para que el apiService lo procese y normalice la URL)
  return NextResponse.json({ url: `/x/${code}` });
}