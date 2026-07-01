import { NextResponse } from "next/server";
import { clearAuthCookie, getAuthTokenFromCookies, verifyUserJwt } from "@/lib/auth/core";
import { prisma } from "@/lib/prisma";
import { recordAuditLog } from "@/lib/security/audit";

export async function POST() {
  const token = await getAuthTokenFromCookies();

  if (token) {
    try {
      const payload = await verifyUserJwt(token);
      const userId = parseInt(payload.sub);

      // Desactivar sesión en DB
      const { getSessionHash } = await import("@/lib/security/session-hash");
      const sessionToken = getSessionHash(token);

      await prisma.userSession.updateMany({
        where: {
          userId,
          token: sessionToken,
          isActive: true
        },
        data: { isActive: false }
      });

      // Auditoría
      await recordAuditLog({
        userId,
        action: "LOGOUT",
        module: "AUTH",
      });
    } catch (e) {
      console.error("Logout session cleanup error:", e);
    }
  }

  await clearAuthCookie();
  return NextResponse.json({ ok: true });
}
