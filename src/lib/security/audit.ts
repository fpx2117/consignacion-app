import { prisma } from "../prisma";

export type AuditAction =
  | "LOGIN"
  | "LOGOUT"
  | "CREATE"
  | "UPDATE"
  | "DELETE"
  | "REVOKE_SESSION"
  | "SETTINGS_CHANGE"
  | "STOCK_ADJUSTMENT";

export type AuditModule =
  | "AUTH"
  | "USERS"
  | "INVENTORY"
  | "SALES"
  | "CONSIGNMENTS"
  | "SETTINGS"
  | "CLIENTS";

interface AuditParams {
  userId?: number;
  action: AuditAction | string;
  module: AuditModule | string;
  details?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
}

/**
 * Registra un evento en el log de auditoría
 */
export async function recordAuditLog({
  userId,
  action,
  module,
  details,
  ipAddress,
  userAgent,
}: AuditParams) {
  try {
    // ✅ Automáticamente capturar IP y User Agent si no se proveen
    // Esto soluciona el problema de logs con "Desconocida/No registrado"
    let finalIp = ipAddress;
    let finalUa = userAgent;

    if (!finalIp || !finalUa) {
      try {
        const { getRealClientData } = await import("../clientData");
        const clientData = await getRealClientData();
        if (!finalIp) finalIp = clientData.ip;
        if (!finalUa) finalUa = clientData.userAgent;
      } catch (headerError) {
        // Probablemente fuera de un contexto de request de Next.js
        console.warn(
          "Could not auto-capture audit metadata:",
          (headerError as Error).message,
        );
      }
    }

    // Limpiar datos sensibles antes de guardar
    const safeDetails = details ? { ...details } : {};
    if (safeDetails.token) delete safeDetails.token;
    if (safeDetails.hash) delete safeDetails.hash;
    if (safeDetails.password) delete safeDetails.password;

    await prisma.auditLog.create({
      data: {
        userId,
        action,
        module,
        details:
          Object.keys(safeDetails).length > 0
            ? JSON.parse(JSON.stringify(safeDetails))
            : undefined,
        ipAddress: finalIp,
        userAgent: finalUa,
      },
    });
  } catch (error) {
    console.error("Failed to record audit log:", error);
  }
}
