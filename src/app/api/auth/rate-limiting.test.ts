import assert from "node:assert/strict";
import test from "node:test";
import { handlePostLogin } from "@/app/api/auth/login/route";
import { handlePostForgotPassword } from "@/app/api/auth/forgot-password/route";
import { handlePostResetPassword } from "@/app/api/auth/reset-password/route";
import {
  AUTH_THROTTLED_MESSAGE,
  FORGOT_PASSWORD_SAFE_MESSAGE,
  RESET_PASSWORD_INVALID_MESSAGE,
} from "@/lib/security/auth-security-monitor";
import type { AuthRateLimitDecision } from "@/lib/security/auth-rate-limit";

function buildAllowedDecision(endpoint: AuthRateLimitDecision["endpoint"]): AuthRateLimitDecision {
  return {
    allowed: true,
    endpoint,
    ip: "203.0.113.5",
    matchedRules: [],
    blockedRules: [],
    shouldLogSuspiciousActivity: false,
    headers: {},
  };
}

function buildBlockedDecision(endpoint: AuthRateLimitDecision["endpoint"]): AuthRateLimitDecision {
  return {
    allowed: false,
    endpoint,
    ip: "203.0.113.5",
    matchedRules: [],
    blockedRules: [
      {
        name: endpoint === "reset-password" ? "token" : "identity",
        limit: 3,
        remaining: 0,
        resetAt: 1_700_000_000_000,
        retryAfterSeconds: 120,
        count: 4,
        blockedCount: 1,
        keyFingerprint: "abc123",
      },
    ],
    shouldLogSuspiciousActivity: true,
    headers: { "Retry-After": "120" },
  };
}

test("handlePostLogin devuelve 429 seguro cuando el rate limit bloquea el intento", async () => {
  let lookedUpUser = false;

  const response = await handlePostLogin(new Request("http://localhost/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "ana@example.com", password: "secreto" }),
  }), {
    findUserByEmail: async () => {
      lookedUpUser = true;
      return null;
    },
    comparePassword: async () => false,
    signUserJwt: async () => "jwt",
    setAuthCookie: async () => undefined,
    setActiveSucursalCookie: async () => undefined,
    getRateLimitDecision: () => buildBlockedDecision("login"),
    getClientData: async () => ({
      ip: "203.0.113.5",
      userAgent: "test",
      browser: "Chrome",
      os: "Linux",
      device: "Desktop",
    }),
    createUserSession: async () => undefined,
    recordAuditLog: async () => undefined,
  });

  assert.equal(response.status, 429);
  assert.equal(lookedUpUser, false);
  assert.equal((await response.json()).message, AUTH_THROTTLED_MESSAGE);
  assert.equal(response.headers.get("Retry-After"), "120");
});

test("handlePostLogin expone intentos restantes cuando las credenciales son invalidas", async () => {
  const response = await handlePostLogin(new Request("http://localhost/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "ana@example.com", password: "incorrecta" }),
  }), {
    findUserByEmail: async () => ({
      id: 7,
      email: "ana@example.com",
      hash: "hash",
      rol: "ADMIN",
      nombre: "Ana",
      sucursalId: 1,
      activo: true,
    }),
    comparePassword: async () => false,
    signUserJwt: async () => "jwt",
    setAuthCookie: async () => undefined,
    setActiveSucursalCookie: async () => undefined,
    getRateLimitDecision: () => ({
      ...buildAllowedDecision("login"),
      matchedRules: [
        {
          name: "identity",
          limit: 10,
          remaining: 6,
          resetAt: 1_700_000_000_000,
          retryAfterSeconds: 900,
          count: 4,
          blockedCount: 0,
          keyFingerprint: "abc123",
        },
      ],
      headers: {
        "Retry-After": "900",
        "X-RateLimit-Limit": "10",
        "X-RateLimit-Remaining": "6",
        "X-RateLimit-Reset": "1700000000000",
      },
    }),
    getClientData: async () => ({
      ip: "203.0.113.5",
      userAgent: "test",
      browser: "Chrome",
      os: "Linux",
      device: "Desktop",
    }),
    createUserSession: async () => undefined,
    recordAuditLog: async () => undefined,
  });

  assert.equal(response.status, 401);
  assert.equal(response.headers.get("X-Auth-Remaining-Attempts"), "6");
  assert.equal((await response.json()).error, "Credenciales invalidas");
});

test("handlePostForgotPassword mantiene respuesta anti-enumeracion para cuenta inexistente", async () => {
  let tokenRotated = false;

  const response = await handlePostForgotPassword(new Request("http://localhost/api/auth/forgot-password", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "nadie@example.com" }),
  }), {
    findUserByEmail: async () => null,
    replaceResetToken: async () => {
      tokenRotated = true;
    },
    sendResetEmail: async () => undefined,
    getRateLimitDecision: () => buildAllowedDecision("forgot-password"),
    recordAuditLog: async () => undefined,
  });

  assert.equal(response.status, 200);
  assert.equal(tokenRotated, false);
  assert.equal((await response.json()).message, FORGOT_PASSWORD_SAFE_MESSAGE);
});

test("handlePostResetPassword usa mensaje uniforme para token invalido o usuario ausente", async () => {
  const request = new Request("http://localhost/api/auth/reset-password", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token: "plain-token", password: "Valida123!" }),
  });

  const invalidTokenResponse = await handlePostResetPassword(request.clone(), {
    findTokenRecord: async () => null,
    findUserByEmail: async () => ({ id: 7 }),
    updatePasswordAndDeleteToken: async () => undefined,
    hashPassword: async () => "hash",
    getRateLimitDecision: () => buildAllowedDecision("reset-password"),
    recordAuditLog: async () => undefined,
  });

  const missingUserResponse = await handlePostResetPassword(request.clone(), {
    findTokenRecord: async () => ({
      email: "ana@example.com",
      expiresAt: new Date(Date.now() + 60_000),
    }),
    findUserByEmail: async () => null,
    updatePasswordAndDeleteToken: async () => undefined,
    hashPassword: async () => "hash",
    getRateLimitDecision: () => buildAllowedDecision("reset-password"),
    recordAuditLog: async () => undefined,
  });

  assert.equal(invalidTokenResponse.status, 400);
  assert.equal(missingUserResponse.status, 400);
  assert.equal((await invalidTokenResponse.json()).message, RESET_PASSWORD_INVALID_MESSAGE);
  assert.equal((await missingUserResponse.json()).message, RESET_PASSWORD_INVALID_MESSAGE);
});
