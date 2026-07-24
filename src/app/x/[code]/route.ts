import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashCode } from "@/lib/sharing/share-links";
import { decodeHistorialShareTarget } from "@/lib/sharing/historial-share-links";

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

  const envBase =
    process.env.NEXT_PUBLIC_APP_URL?.trim() || "http://localhost:3000";
  if (envBase.startsWith("http://") || envBase.startsWith("https://"))
    return envBase.replace(/\/$/, "");
  return `https://${envBase.replace(/\/$/, "")}`;
}

function redirectAbs(
  req: NextRequest,
  path: string,
  cookieToSet?: { name: string; value: string },
) {
  const url = new URL(path, getPublicOrigin(req));
  const res = NextResponse.redirect(url);

  if (cookieToSet) {
    res.cookies.set(cookieToSet.name, cookieToSet.value, {
      path: "/",
      maxAge: 60 * 60 * 24, // 24 horas de validez
    });
  }

  return res;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ code: string }> },
) {
  const { code } = await params;
  const codeHash = hashCode(code);

  const link = await prisma.shareLink.findUnique({ where: { codeHash } });

  if (!link) return redirectAbs(req, `/x/status?state=invalid`);
  if (new Date() > link.expiresAt)
    return redirectAbs(req, `/x/status?state=expired`);

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

  let destPath = "";
  const queryParams = `?code=${encodeURIComponent(code)}`;

  switch (link.type) {
    case "TICKET":
      destPath = `/ver/ticket/${link.targetId}`;
      break;
    case "REMITO":
      destPath = `/ver/remito/${link.targetId}`;
      break;
    case "HISTORIAL_INVENTARIO": {
      const historialTarget = decodeHistorialShareTarget(link.targetId || 0);

      if (!historialTarget) {
        return redirectAbs(req, `/x/status?state=invalid`);
      }

      destPath = `/ver/historial/${historialTarget.mes}`;
      const query = `?code=${encodeURIComponent(code)}&anio=${historialTarget.anio}`;

      return redirectAbs(req, `${destPath}${query}`, {
        name: cookieName,
        value: "1",
      });
    }
    case "INVENTARIO":
      // A diferencia de TICKET/REMITO (que no tienen pantalla de carga propia),
      // inventario sí la tiene: se apunta a esa página, no directo a /pdf, para
      // que el usuario vea el spinner mientras se genera el reporte.
      destPath = `/ver/inventario/${link.targetId || "0"}`;
      break;
    case "REPORTE_DASHBOARD": {
      const fullId = link.targetId || 11; // Default S1 Today
      const sucursalId = Math.floor(fullId / 10);
      const periodId = fullId % 10;
      const PERIOD_MAP: Record<number, string> = {
        1: "today",
        2: "week",
        3: "month",
        4: "all",
      };
      const periodName = PERIOD_MAP[periodId] ?? "month";
      destPath = `/ver/dashboard/${periodName}`;
      destPath += `?code=${encodeURIComponent(code)}&sucursalId=${sucursalId}`;
      return redirectAbs(req, destPath, { name: cookieName, value: "1" });
    }
    case "REPORTE_POS": {
      const fullId = link.targetId || 11;
      const sucursalId = Math.floor(fullId / 10);
      const periodId = fullId % 10;
      const PERIOD_MAP_POS: Record<number, string> = {
        1: "today",
        2: "week",
        3: "month",
        4: "all",
      };
      const periodName = PERIOD_MAP_POS[periodId] ?? "month";
      destPath = `/ver/pos/${periodName}`;
      destPath += `?code=${encodeURIComponent(code)}&sucursalId=${sucursalId}`;
      return redirectAbs(req, destPath, { name: cookieName, value: "1" });
    }
    case "REPORTE_CONSIGNACION": {
      const fullId = link.targetId || 11;
      const sucursalId = Math.floor(fullId / 10);
      const periodId = fullId % 10;
      const PERIOD_MAP_CONSIG: Record<number, string> = {
        1: "today",
        2: "week",
        3: "month",
        4: "all",
      };
      const periodName = PERIOD_MAP_CONSIG[periodId] ?? "month";
      destPath = `/ver/consig/${periodName}`;
      destPath += `?code=${encodeURIComponent(code)}&sucursalId=${sucursalId}`;
      return redirectAbs(req, destPath, { name: cookieName, value: "1" });
    }
    case "COMPROBANTE_GASTO":
      destPath = `/ver/gasto/${link.targetId}`;
      break;
    default:
      return redirectAbs(req, `/x/status?state=invalid`);
  }

  const finalUrl = `${destPath}${queryParams}`;

  return redirectAbs(req, finalUrl, { name: cookieName, value: "1" });
}
