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

// Modificamos redirectAbs para aceptar cookies opcionalmente
function redirectAbs(req: NextRequest, path: string, cookieToSet?: { name: string, value: string }) {
  const url = new URL(path, getPublicOrigin(req));
  const res = NextResponse.redirect(url);
  
  if (cookieToSet) {
    res.cookies.set(cookieToSet.name, cookieToSet.value, { 
      path: '/', 
      maxAge: 60 * 60 * 24 // 24 horas de validez para la cookie
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

  if (!link) return redirectAbs(req, `/x/status?state=invalid`);
  if (new Date() > link.expiresAt) return redirectAbs(req, `/x/status?state=expired`);

  // --- NUEVA LÓGICA ---
  
  // 1. Verificamos si este usuario YA vio este link (tiene la cookie)
  const cookieName = `v_${codeHash}`; // Nombre corto para la cookie
  const hasViewedCookie = req.cookies.get(cookieName);

  // 2. Solo bloqueamos si NO tiene la cookie Y alcanzó el límite
  if (!hasViewedCookie && link.views >= link.maxViews) {
      return redirectAbs(req, `/x/status?state=limit`);
  }

  // 3. Solo incrementamos el contador si NO tiene la cookie
  if (!hasViewedCookie) {
    await prisma.shareLink.update({
      where: { codeHash },
      data: { views: { increment: 1 }, lastViewedAt: new Date() },
    });
  }

  const dest =
    link.type === "TICKET"
      ? `/ver/ticket/${link.targetId}?code=${encodeURIComponent(code)}`
      : `/ver/remito/${link.targetId}?code=${encodeURIComponent(code)}`;

  // 4. Redirigimos Y seteamos la cookie para que la próxima vez pase gratis
  return redirectAbs(req, dest, { name: cookieName, value: '1' });
}