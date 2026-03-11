/* eslint-disable */
// @ts-nocheck
import { NextResponse } from "next/server";
import { getAuthTokenFromCookies, verifyUserJwt } from "@/lib/auth";

/* ============================
   AUTH GUARD
============================ */

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

    // ✅ VERIFICACIÓN DE SESIÓN EN BASE DE DATOS
    const { prisma } = await import("@/lib/prisma");
    const { getSessionHash } = await import("@/lib/sessionHash");

    const sessionToken = getSessionHash(token);
    const session = await prisma.userSession.findUnique({
      where: { token: sessionToken },
      select: { isActive: true }
    });

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
    const { headers } = await import("next/headers");
    const h = await headers();
    const reqHeader = h.get("x-sucursal-id");
    let activeSucursalId = 1;

    if (user.rol === "ADMIN") {
      activeSucursalId = reqHeader ? parseInt(reqHeader, 10) : (user.sucursalId || 1);
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
  return roles.includes(user.rol as any);
}
