import assert from "node:assert/strict";
import test from "node:test";
import {
  getAuthRateLimitDecision,
  getRequestIp,
  hashValue,
  normalizeIdentity,
  resetAuthRateLimitStore,
} from "@/lib/auth-rate-limit";

test.afterEach(() => {
  resetAuthRateLimitStore();
});

test("getAuthRateLimitDecision bloquea login por combinacion IP e identidad", () => {
  const now = 1_700_000_000_000;

  for (let attempt = 1; attempt <= 10; attempt += 1) {
    const decision = getAuthRateLimitDecision({
      endpoint: "login",
      ip: "203.0.113.10",
      identity: "ana@example.com",
      now,
    });

    assert.equal(decision.allowed, true);
  }

  const blocked = getAuthRateLimitDecision({
    endpoint: "login",
    ip: "203.0.113.10",
    identity: "ana@example.com",
    now,
  });

  assert.equal(blocked.allowed, false);
  assert.equal(blocked.blockedRules[0]?.name, "identity");
  assert.equal((blocked.headers as Record<string, string>)["Retry-After"], "900");
});

test("getAuthRateLimitDecision aplica politicas separadas para forgot y reset", () => {
  const now = 1_700_000_000_000;

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    assert.equal(getAuthRateLimitDecision({
      endpoint: "forgot-password",
      ip: "198.51.100.8",
      identity: "ana@example.com",
      now,
    }).allowed, true);
  }

  assert.equal(getAuthRateLimitDecision({
    endpoint: "forgot-password",
    ip: "198.51.100.8",
    identity: "ana@example.com",
    now,
  }).allowed, false);

  assert.equal(getAuthRateLimitDecision({
    endpoint: "reset-password",
    ip: "198.51.100.8",
    token: "reset-token-1",
    now,
  }).allowed, true);
});

test("getAuthRateLimitDecision considera token e IP en reset-password", () => {
  const now = 1_700_000_000_000;

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    assert.equal(getAuthRateLimitDecision({
      endpoint: "reset-password",
      ip: "192.0.2.44",
      token: "shared-token",
      now,
    }).allowed, true);
  }

  const blocked = getAuthRateLimitDecision({
    endpoint: "reset-password",
    ip: "192.0.2.44",
    token: "shared-token",
    now,
  });

  assert.equal(blocked.allowed, false);
  assert.equal(blocked.blockedRules.some((rule) => rule.name === "identity"), true);
  assert.equal(blocked.blockedRules.some((rule) => rule.name === "token"), false);
});

test("utilidades de auth rate limit normalizan identidad, hash e IP", () => {
  assert.equal(normalizeIdentity("  ANA@Example.com "), "ana@example.com");
  assert.equal(normalizeIdentity("   "), null);
  assert.equal(hashValue("ana@example.com").length, 16);

  const ip = getRequestIp(new Request("http://localhost/api/auth/login", {
    headers: {
      "x-forwarded-for": "198.51.100.10, 10.0.0.1",
    },
  }));

  assert.equal(ip, "198.51.100.10");
});
