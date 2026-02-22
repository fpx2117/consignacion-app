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

    if (session && !session.isActive) {
      const response = NextResponse.json(
        { error: "Tu sesión ha sido revocada por un administrador" },
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

    return {
      ok: true as const,
      user,
      token,
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
