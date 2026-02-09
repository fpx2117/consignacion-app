import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashCode } from "@/lib/share-links";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function getPublicOrigin(req: NextRequest): string {
  const xfProto = req.headers.get("x-forwarded-proto");
  const xfHost = req.headers.get("x-forwarded-host");
  const host = xfHost || req.headers.get("host");

  if (host) {
    const proto = xfProto || "https";
    return `${proto}://${host}`;
  }

  const envBase = process.env.NEXT_PUBLIC_APP_URL?.trim() || "http://localhost:3000";
  if (envBase.startsWith("http://") || envBase.startsWith("https://")) return envBase.replace(/\/$/, "");
  return `https://${envBase.replace(/\/$/, "")}`;
}

function redirectAbs(req: NextRequest, path: string) {
  return NextResponse.redirect(new URL(path, getPublicOrigin(req)));
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params;
  const codeHash = hashCode(code);

  const link = await prisma.shareLink.findUnique({ where: { codeHash } });

  if (!link) return redirectAbs(req, `/x/status?state=invalid`);
  if (new Date() > link.expiresAt) return redirectAbs(req, `/x/status?state=expired`);
  if (link.views >= link.maxViews) return redirectAbs(req, `/x/status?state=limit`);

  // ✅ Consumimos 1 vista ACÁ (único lugar)
  await prisma.shareLink.update({
    where: { codeHash },
    data: { views: { increment: 1 }, lastViewedAt: new Date() },
  });

  const dest =
    link.type === "TICKET"
      ? `/ver/ticket/${link.targetId}?code=${encodeURIComponent(code)}`
      : `/ver/remito/${link.targetId}?code=${encodeURIComponent(code)}`;

  return redirectAbs(req, dest);
}
