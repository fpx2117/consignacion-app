import { cache } from "react";
import { NextResponse } from "next/server";
import { getAuthTokenFromCookies, verifyUserJwt } from "@/lib/auth/core";

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
    select: { isActive: true },
  });
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

    if (!session || !session.isActive) {
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

    // Resolviendo la sucursal activa
    const { headers, cookies } = await import("next/headers");
    const h = await headers();
    const cookieStore = await cookies();
    const reqHeader = h.get("x-sucursal-id");
    const reqCookie = cookieStore.get("active_sucursal_id")?.value;
    let activeSucursalId = 1;

    if (user.rol === "ADMIN") {
      const parsedHeader = reqHeader ? parseInt(reqHeader, 10) : NaN;
      const parsedCookie = reqCookie ? parseInt(reqCookie, 10) : NaN;
      if (Number.isFinite(parsedHeader) && parsedHeader >= 0) {
        activeSucursalId = parsedHeader;
      } else if (Number.isFinite(parsedCookie) && parsedCookie >= 0) {
        activeSucursalId = parsedCookie;
      } else {
        activeSucursalId = user.sucursalId || 1;
      }
    } else {
      activeSucursalId = user.sucursalId || 1;
    }

    return {
      ok: true as const,
      user,
      token,
      activeSucursalId
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
