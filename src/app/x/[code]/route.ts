// src/app/x/[code]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashCode } from "@/lib/share-links";

export const dynamic = "force-dynamic";

function status(state: "invalid" | "expired" | "limit") {
  // ✅ relativo => mantiene dominio real (railway)
  return NextResponse.redirect(`/x/status?state=${state}`);
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params;
  const codeHash = hashCode(code);

  const link = await prisma.shareLink.findUnique({ where: { codeHash } });

  if (!link) return status("invalid");
  if (new Date() > link.expiresAt) return status("expired");
  if (link.views >= link.maxViews) return status("limit");

  // ✅ Consumimos 1 vista ACÁ (único lugar)
  await prisma.shareLink.update({
    where: { codeHash },
    data: { views: { increment: 1 }, lastViewedAt: new Date() },
  });

  const dest =
    link.type === "TICKET"
      ? `/ver/ticket/${link.targetId}?code=${encodeURIComponent(code)}`
      : `/ver/remito/${link.targetId}?code=${encodeURIComponent(code)}`;

  // ✅ redirect relativo (sin new URL / req.url)
  return NextResponse.redirect(dest);
}
