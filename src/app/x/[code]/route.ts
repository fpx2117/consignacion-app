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

function redirectAbs(req: NextRequest, path: string, cookieToSet?: { name: string, value: string }) {
  const url = new URL(path, getPublicOrigin(req));
  const res = NextResponse.redirect(url);
  
  if (cookieToSet) {
    res.cookies.set(cookieToSet.name, cookieToSet.value, { 
      path: '/', 
      maxAge: 60 * 60 * 24 // 24 horas de validez
    });
  }
  
  return res;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params;
  const codeHash = hashCode(code);

  const link = await prisma.shareLink.findUnique({ where: { codeHash } });

  // 1. Validaciones de existencia y expiración
  if (!link) return redirectAbs(req, `/x/status?state=invalid`);
  if (new Date() > link.expiresAt) return redirectAbs(req, `/x/status?state=expired`);

  // 2. Lógica de control de vistas por Cookie
  const cookieName = `v_${codeHash}`;
  const hasViewedCookie = req.cookies.get(cookieName);

  if (!hasViewedCookie && link.views >= link.maxViews) {
      return redirectAbs(req, `/x/status?state=limit`);
  }

  if (!hasViewedCookie) {
    await prisma.shareLink.update({
      where: { codeHash },
      data: { views: { increment: 1 }, lastViewedAt: new Date() },
    });
  }

  // 3. Mapeo de rutas (Ajustado para evitar conflictos de Next.js)
  let destPath = "";
  const queryParams = `?code=${encodeURIComponent(code)}`;

  switch (link.type) {
    case "TICKET":
      destPath = `/ver/ticket/${link.targetId}`;
      break;
    case "REMITO":
      destPath = `/ver/remito/${link.targetId}`;
      break;
    case "INVENTARIO":
      // ✅ IMPORTANTE: Apuntamos a /pdf para no chocar con page.tsx en la carpeta [id]
      destPath = `/ver/inventario/${link.targetId || '0'}/pdf`;
      break;
    default:
      return redirectAbs(req, `/x/status?state=invalid`);
  }

  const finalUrl = `${destPath}${queryParams}`;

  // 4. Redirección final con seteo de cookie
  return redirectAbs(req, finalUrl, { name: cookieName, value: '1' });
}