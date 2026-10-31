import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

function getSecret(explicitSecret?: string): string {
  const secret = explicitSecret || process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET no está configurado");
  return secret;
}

function signature(payload: string, secret: string): string {
  const installation = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || "local";
  return createHmac("sha256", secret)
    .update(`${installation}:${payload}`)
    .digest("base64url");
}

function emailHash(email: string): string {
  return createHash("sha256").update(email.trim().toLowerCase()).digest("base64url");
}

export function createSetupPaymentReference(
  planId: number,
  adminEmail: string,
  explicitSecret?: string,
): string {
  if (!Number.isSafeInteger(planId) || planId <= 0)
    throw new Error("planId inválido");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(adminEmail))
    throw new Error("Email de administrador inválido");
  const payload = `setup:${planId}:${emailHash(adminEmail)}:${randomBytes(16).toString("base64url")}`;
  return `${payload}:${signature(payload, getSecret(explicitSecret))}`;
}

export function verifySetupPaymentReference(
  reference: unknown,
  expectedPlanId: number,
  adminEmail: string,
  explicitSecret?: string,
): boolean {
  if (typeof reference !== "string") return false;
  const [flow, planId, boundEmail, nonce, received, extra] = reference.split(":");
  if (
    flow !== "setup" ||
    extra ||
    Number(planId) !== expectedPlanId ||
    boundEmail !== emailHash(adminEmail) ||
    !/^[A-Za-z0-9_-]{20,}$/.test(nonce || "") ||
    !received
  )
    return false;
  const expected = signature(
    `setup:${expectedPlanId}:${boundEmail}:${nonce}`,
    getSecret(explicitSecret),
  );
  const receivedBuffer = Buffer.from(received);
  const expectedBuffer = Buffer.from(expected);
  return (
    receivedBuffer.length === expectedBuffer.length &&
    timingSafeEqual(receivedBuffer, expectedBuffer)
  );
}

type SetupPlan = { id: number; paypalId: string };

export function isPayPalSubscriptionId(value: string): boolean {
  return /^I-[A-Z0-9]+$/i.test(value);
}

export function isVerifiedPayPalSubscription(
  value: unknown,
  plan: SetupPlan,
  adminEmail: string,
): boolean {
  if (!value || typeof value !== "object") return false;
  const data = value as Record<string, unknown>;
  return (
    data.status === "ACTIVE" &&
    data.plan_id === plan.paypalId &&
    verifySetupPaymentReference(data.custom_id, plan.id, adminEmail)
  );
}

export function isVerifiedMercadoPagoActivation(
  value: unknown,
  expectedStatus: "approved" | "authorized",
  planId: number,
  adminEmail: string,
): boolean {
  if (!value || typeof value !== "object") return false;
  const data = value as Record<string, unknown>;
  return (
    data.status === expectedStatus &&
    verifySetupPaymentReference(data.external_reference, planId, adminEmail)
  );
}
