// src/app/x/[code]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashCode } from "@/lib/share-links";

export const dynamic = "force-dynamic";
export const runtime = "nodejs"; // recomendable (Prisma)

function abs(req: NextRequest, path: string) {
  return new URL(path, req.url); // ✅ convierte /algo en absoluta con el host real
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params;
  const codeHash = hashCode(code);

  const link = await prisma.shareLink.findUnique({ where: { codeHash } });

  if (!link) return NextResponse.redirect(abs(req, `/x/status?state=invalid`));
  if (new Date() > link.expiresAt) return NextResponse.redirect(abs(req, `/x/status?state=expired`));
  if (link.views >= link.maxViews) return NextResponse.redirect(abs(req, `/x/status?state=limit`));

  // ✅ Consumimos 1 vista ACÁ (único lugar)
  await prisma.shareLink.update({
    where: { codeHash },
    data: { views: { increment: 1 }, lastViewedAt: new Date() },
  });

  const dest =
    link.type === "TICKET"
      ? `/ver/ticket/${link.targetId}?code=${encodeURIComponent(code)}`
      : `/ver/remito/${link.targetId}?code=${encodeURIComponent(code)}`;

  return NextResponse.redirect(abs(req, dest));
}
