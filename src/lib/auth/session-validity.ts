// src/lib/auth/session-validity.ts
// Una sola regla para decidir si un token de sesión sigue vigente.
//
// La usan el guard HTTP (`requireAuth`) y el handshake de Socket.IO: el socket no
// puede seguir conectado con una sesión revocada o vencida aunque el JWT siga
// firmado. Se aplica sobre `UserSession.token`, que guarda el hash del JWT.

import { getSessionHash } from "@/lib/security/session-hash";

export type SessionValidity = "active" | "missing" | "revoked" | "expired";

export type SessionLookup = {
  findSession: (
    tokenHash: string,
  ) => Promise<{ isActive: boolean; expiresAt: Date } | null>;
};

export async function checkSessionValidity(
  token: string,
  lookup: SessionLookup,
  now: Date = new Date(),
): Promise<SessionValidity> {
  const session = await lookup.findSession(getSessionHash(token));
  if (!session) return "missing";
  if (!session.isActive) return "revoked";
  if (session.expiresAt.getTime() <= now.getTime()) return "expired";
  return "active";
}

/** Lookup contra la base real, con import diferido para no cargar Prisma al importar el módulo. */
export const prismaSessionLookup: SessionLookup = {
  findSession: async (tokenHash) => {
    const { prisma } = await import("@/lib/prisma");
    return prisma.userSession.findUnique({
      where: { token: tokenHash },
      select: { isActive: true, expiresAt: true },
    });
  },
};
