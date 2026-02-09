import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashCode } from "@/lib/share-links";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params;
  const codeHash = hashCode(code);

  const link = await prisma.shareLink.findUnique({ where: { codeHash } });

  if (!link) return NextResponse.redirect(new URL(`/x/status?state=invalid`, req.url));

  if (new Date() > link.expiresAt) return NextResponse.redirect(new URL(`/x/status?state=expired`, req.url));

  if (link.views >= link.maxViews) return NextResponse.redirect(new URL(`/x/status?state=limit`, req.url));

  const dest =
    link.type === "TICKET"
      ? `/ver/ticket/${link.targetId}?code=${encodeURIComponent(code)}`
      : `/ver/remito/${link.targetId}?code=${encodeURIComponent(code)}`;

  return NextResponse.redirect(new URL(dest, req.url));
}
