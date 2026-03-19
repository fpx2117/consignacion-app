import { NextResponse } from "next/server";
import { hashValue, type AuthRateLimitDecision } from "@/lib/auth-rate-limit";

export const AUTH_THROTTLED_MESSAGE = "Demasiadas solicitudes. Espera unos minutos antes de volver a intentarlo.";
export const FORGOT_PASSWORD_SAFE_MESSAGE = "Si existe una cuenta con ese correo, recibiras un enlace de recuperacion.";
export const RESET_PASSWORD_INVALID_MESSAGE = "El enlace es invalido o ya no se puede usar.";

type AuthRateLimitEventInput = {
  decision: AuthRateLimitDecision;
  identity?: string | null;
  token?: string | null;
  userId?: number;
  recordAuditLog?: (input: {
    userId?: number;
    action: string;
    module: string;
    details?: Record<string, unknown>;
    ipAddress?: string;
    userAgent?: string;
  }) => Promise<unknown>;
};

export async function reportAuthRateLimitEvent({
  decision,
  identity,
  token,
  userId,
  recordAuditLog: recordAuditLogImpl,
}: AuthRateLimitEventInput) {
  if (decision.allowed && !decision.shouldLogSuspiciousActivity) {
    return;
  }

  const rules = (decision.allowed ? decision.matchedRules : decision.blockedRules)
    .filter((rule) => !decision.allowed || rule.blockedCount > 0)
    .map((rule) => ({
      name: rule.name,
      limit: rule.limit,
      remaining: rule.remaining,
      retryAfterSeconds: rule.retryAfterSeconds,
      blockedCount: rule.blockedCount,
      keyFingerprint: rule.keyFingerprint,
    }));

  const details = {
    endpoint: decision.endpoint,
    outcome: decision.allowed ? "threshold-warning" : "blocked",
    identityHash: identity ? hashValue(identity) : undefined,
    tokenHash: token ? hashValue(token) : undefined,
    rules,
  } satisfies Record<string, unknown>;

  if (recordAuditLogImpl) {
    await recordAuditLogImpl({
      userId,
      action: decision.allowed ? "AUTH_RATE_LIMIT_WARNING" : "AUTH_RATE_LIMIT_BLOCK",
      module: "AUTH",
      details,
      ipAddress: decision.ip,
    });
  }

  if (!decision.allowed || rules.some((rule) => Number(rule.blockedCount) > 1)) {
    console.warn(`[AUTH_RATE_LIMIT] endpoint=${decision.endpoint} ip=${decision.ip} outcome=${decision.allowed ? "warning" : "blocked"}`);
  }
}

export function buildAuthThrottledResponse(headers: HeadersInit) {
  return NextResponse.json(
    { message: AUTH_THROTTLED_MESSAGE },
    { status: 429, headers },
  );
}
