import { cache } from "react";
import { NextResponse } from "next/server";
import { getAuthTokenFromCookies, verifyUserJwt } from "@/lib/auth/core";
import { resolveEffectiveSucursalContext } from "@/lib/security/sucursalScope";

/* ============================
   AUTH GUARD
============================ */

/**
 * validateSession - per-request memoized (React.cache)
 * Múltiples llamadas con el mismo token dentro del mismo render tree
 * sólo ejecutan 1 query a la DB. Seguro para multi-tenant.
 */
const validateSession = cache(async (token: string) => {
  const { prisma } = await import("@/lib/prisma");
  const { getSessionHash } = await import("@/lib/security/session-hash");
  const sessionToken = getSessionHash(token);
  return prisma.userSession.findUnique({
    where: { token: sessionToken },
    select: { isActive: true, expiresAt: true },
  });
});

const getAllowedSucursalIdsForUser = cache(async (userId: number, rol: "ADMIN" | "EMPLEADO", fallbackSucursalId: number | null) => {
  const { prisma } = await import("@/lib/prisma");

  if (rol === "ADMIN") {
    const sucursales = await prisma.sucursal.findMany({
      where: { activa: true },
      select: { id: true },
      orderBy: { id: "asc" },
    });

    return sucursales.map((sucursal) => sucursal.id);
  }

  if (typeof fallbackSucursalId !== "number" || !Number.isInteger(fallbackSucursalId) || fallbackSucursalId <= 0) {
    return [];
  }

  const sucursal = await prisma.sucursal.findFirst({
    where: { id: fallbackSucursalId, activa: true },
    select: { id: true },
  });

  return sucursal ? [sucursal.id] : [];
});

export async function requireAuth() {
  const token = await getAuthTokenFromCookies();

  if (!token) {
    return {
      ok: false as const,
      res: NextResponse.json(
        { error: "No autorizado" },
        { status: 401 }
      ),
    };
  }

  try {
    const user = await verifyUserJwt(token);

    // ✅ VERIFICACIÓN DE SESIÓN EN BASE DE DATOS (memoizada por request)
    const session = await validateSession(token);

    if (!session || !session.isActive || session.expiresAt < new Date()) {
      const response = NextResponse.json(
        { error: "Sesión inválida o revocada" },
        { status: 401 }
      );

      // ✅ Limpiamos la cookie inmediatamente para que no queden bloqueados
      const cookieName = process.env.JWT_COOKIE_NAME || "access_token";
      response.cookies.set(cookieName, "", { maxAge: 0, path: "/" });

      return {
        ok: false as const,
        res: response,
      };
    }

    const authUserId = Number(user.sub);
    const allowedSucursalIds = await getAllowedSucursalIdsForUser(
      Number.isFinite(authUserId) ? authUserId : 0,
      user.rol,
      user.sucursalId,
    );

    const { cookies, headers } = await import("next/headers");
    const cookieStore = await cookies();
    const headerStore = await headers();
    const reqCookie = cookieStore.get("active_sucursal_id")?.value;
    const reqHeader = headerStore.get("x-sucursal-id");
    const resolvedSucursalContext = resolveEffectiveSucursalContext({
      user,
      allowedSucursalIds,
      cookieSucursalId: reqCookie,
      jwtSucursalId: user.sucursalId,
      clientRequestedSucursalId: reqHeader,
    });

    if (!resolvedSucursalContext) {
      const response = NextResponse.json(
        { error: "Sucursal activa no autorizada" },
        { status: 403 },
      );

      response.cookies.set("active_sucursal_id", "", {
        maxAge: 0,
        path: "/",
        sameSite: "lax",
      });

      return {
        ok: false as const,
        res: response,
      };
    }

    return {
      ok: true as const,
      user,
      token,
      activeSucursalId: resolvedSucursalContext.activeSucursalId,
      allowedSucursalIds: resolvedSucursalContext.allowedSucursalIds,
      isGlobalView: resolvedSucursalContext.isGlobalView,
    };
  } catch {
    return {
      ok: false as const,
      res: NextResponse.json(
        { error: "Token inválido" },
        { status: 401 }
      ),
    };
  }
}

/* ============================
   ROLE GUARD
============================ */

export function requireRole(
  user: { rol: string },
  roles: Array<"ADMIN" | "EMPLEADO">
) {
  return roles.includes(user.rol as "ADMIN" | "EMPLEADO");
}
