import { createHash } from "crypto";

export type AuthRateLimitEndpoint = "login" | "forgot-password" | "reset-password";

type RateLimitRuleName = "ip" | "identity" | "token";

type RateLimitRule = {
  name: RateLimitRuleName;
  max: number;
  windowMs: number;
  value: string | null;
};

type RateLimitBucket = {
  count: number;
  blockedCount: number;
  resetAt: number;
};

export type RateLimitStore = {
  get: (key: string) => RateLimitBucket | undefined;
  set: (key: string, value: RateLimitBucket) => void;
  delete: (key: string) => void;
};

export type AuthRateLimitDecisionRule = {
  name: RateLimitRuleName;
  limit: number;
  remaining: number;
  resetAt: number;
  retryAfterSeconds: number;
  count: number;
  blockedCount: number;
  keyFingerprint: string;
};

export type AuthRateLimitDecision = {
  allowed: boolean;
  endpoint: AuthRateLimitEndpoint;
  ip: string;
  matchedRules: AuthRateLimitDecisionRule[];
  blockedRules: AuthRateLimitDecisionRule[];
  shouldLogSuspiciousActivity: boolean;
  headers: HeadersInit;
};

export type AuthRateLimitInput = {
  endpoint: AuthRateLimitEndpoint;
  ip: string;
  identity?: string | null;
  token?: string | null;
  now?: number;
  store?: RateLimitStore;
};

const DEFAULT_WINDOW_MINUTES = 15;
const NEAR_LIMIT_REMAINING_THRESHOLD = 1;
const DEFAULT_LOGIN_IP_MAX = 30;
const DEFAULT_LOGIN_IDENTITY_MAX = 10;

const FALLBACK_IP = "127.0.0.1";

const globalRateLimitStore = (() => {
  const globalScope = globalThis as typeof globalThis & {
    __consignacionAuthRateLimitStore__?: Map<string, RateLimitBucket>;
  };

  if (!globalScope.__consignacionAuthRateLimitStore__) {
    globalScope.__consignacionAuthRateLimitStore__ = new Map<string, RateLimitBucket>();
  }

  return globalScope.__consignacionAuthRateLimitStore__;
})();

const defaultStore: RateLimitStore = {
  get: (key) => globalRateLimitStore.get(key),
  set: (key, value) => {
    globalRateLimitStore.set(key, value);
  },
  delete: (key) => {
    globalRateLimitStore.delete(key);
  },
};

export function getAuthRateLimitDecision(input: AuthRateLimitInput): AuthRateLimitDecision {
  const now = input.now ?? Date.now();
  const ip = normalizeIp(input.ip);
  const identity = normalizeIdentity(input.identity);
  const token = normalizeOpaqueValue(input.token);
  const rules = buildRules(input.endpoint, ip, identity, token);
  const store = input.store ?? defaultStore;

  const matchedRules: AuthRateLimitDecisionRule[] = [];
  const blockedRules: AuthRateLimitDecisionRule[] = [];

  for (const rule of rules) {
    if (!rule.value) {
      continue;
    }

    const storeKey = buildStoreKey(input.endpoint, rule.name, rule.value);
    const bucket = getFreshBucket(store, storeKey, rule.windowMs, now);
    bucket.count += 1;

    if (bucket.count > rule.max) {
      bucket.blockedCount += 1;
    }

    store.set(storeKey, bucket);

    const decisionRule: AuthRateLimitDecisionRule = {
      name: rule.name,
      limit: rule.max,
      remaining: Math.max(rule.max - Math.min(bucket.count, rule.max), 0),
      resetAt: bucket.resetAt,
      retryAfterSeconds: Math.max(Math.ceil((bucket.resetAt - now) / 1000), 1),
      count: bucket.count,
      blockedCount: bucket.blockedCount,
      keyFingerprint: hashValue(rule.value),
    };

    matchedRules.push(decisionRule);

    if (bucket.count > rule.max) {
      blockedRules.push(decisionRule);
    }
  }

  const allowed = blockedRules.length === 0;
  const shouldLogSuspiciousActivity = matchedRules.some((rule) => (
    rule.blockedCount > 0
    || rule.remaining <= NEAR_LIMIT_REMAINING_THRESHOLD
  ));

  return {
    allowed,
    endpoint: input.endpoint,
    ip,
    matchedRules,
    blockedRules,
    shouldLogSuspiciousActivity,
    headers: buildRateLimitHeaders(allowed ? matchedRules : blockedRules),
  };
}

export function getRequestIp(req: Pick<Request, "headers">): string {
  return normalizeIp(
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
      || req.headers.get("x-real-ip")
      || req.headers.get("cf-connecting-ip")
      || FALLBACK_IP,
  );
}

export function normalizeIdentity(value?: string | null): string | null {
  const normalized = String(value ?? "").trim().toLowerCase();
  return normalized || null;
}

export function hashValue(value: string): string {
  return createHash("sha256").update(value).digest("hex").slice(0, 16);
}

export function resetAuthRateLimitStore() {
  globalRateLimitStore.clear();
}

function buildRules(
  endpoint: AuthRateLimitEndpoint,
  ip: string,
  identity: string | null,
  token: string | null,
): RateLimitRule[] {
  switch (endpoint) {
    case "login":
      return [
        {
          name: "ip",
          value: ip,
          max: readEnvInt("AUTH_RATE_LIMIT_LOGIN_IP_MAX", DEFAULT_LOGIN_IP_MAX),
          windowMs: readEnvInt("AUTH_RATE_LIMIT_LOGIN_IP_WINDOW_MS", DEFAULT_WINDOW_MINUTES * 60_000),
        },
        {
          name: "identity",
          value: identity ? `${ip}:${identity}` : null,
          max: readEnvInt("AUTH_RATE_LIMIT_LOGIN_IDENTITY_MAX", DEFAULT_LOGIN_IDENTITY_MAX),
          windowMs: readEnvInt("AUTH_RATE_LIMIT_LOGIN_IDENTITY_WINDOW_MS", DEFAULT_WINDOW_MINUTES * 60_000),
        },
      ];
    case "forgot-password":
      return [
        {
          name: "ip",
          value: ip,
          max: readEnvInt("AUTH_RATE_LIMIT_FORGOT_IP_MAX", 10),
          windowMs: readEnvInt("AUTH_RATE_LIMIT_FORGOT_IP_WINDOW_MS", DEFAULT_WINDOW_MINUTES * 60_000),
        },
        {
          name: "identity",
          value: identity ? `${ip}:${identity}` : null,
          max: readEnvInt("AUTH_RATE_LIMIT_FORGOT_IDENTITY_MAX", 3),
          windowMs: readEnvInt("AUTH_RATE_LIMIT_FORGOT_IDENTITY_WINDOW_MS", 30 * 60_000),
        },
      ];
    case "reset-password":
      return [
        {
          name: "ip",
          value: ip,
          max: readEnvInt("AUTH_RATE_LIMIT_RESET_IP_MAX", 10),
          windowMs: readEnvInt("AUTH_RATE_LIMIT_RESET_IP_WINDOW_MS", DEFAULT_WINDOW_MINUTES * 60_000),
        },
        {
          name: "token",
          value: token,
          max: readEnvInt("AUTH_RATE_LIMIT_RESET_TOKEN_MAX", 5),
          windowMs: readEnvInt("AUTH_RATE_LIMIT_RESET_TOKEN_WINDOW_MS", 30 * 60_000),
        },
        {
          name: "identity",
          value: token ? `${ip}:${token}` : null,
          max: readEnvInt("AUTH_RATE_LIMIT_RESET_IP_TOKEN_MAX", 3),
          windowMs: readEnvInt("AUTH_RATE_LIMIT_RESET_IP_TOKEN_WINDOW_MS", 30 * 60_000),
        },
      ];
  }
}

function getFreshBucket(store: RateLimitStore, key: string, windowMs: number, now: number): RateLimitBucket {
  const current = store.get(key);
  if (!current || current.resetAt <= now) {
    if (current) {
      store.delete(key);
    }

    return {
      count: 0,
      blockedCount: 0,
      resetAt: now + windowMs,
    };
  }

  return current;
}

function buildStoreKey(endpoint: AuthRateLimitEndpoint, rule: RateLimitRuleName, value: string) {
  return `auth-rate-limit:${endpoint}:${rule}:${value}`;
}

function buildRateLimitHeaders(rules: AuthRateLimitDecisionRule[]): HeadersInit {
  if (rules.length === 0) {
    return {};
  }

  const strictestRule = rules.reduce((current, candidate) => {
    if (!current) {
      return candidate;
    }

    if (candidate.retryAfterSeconds > current.retryAfterSeconds) {
      return candidate;
    }

    if (candidate.retryAfterSeconds === current.retryAfterSeconds && candidate.remaining < current.remaining) {
      return candidate;
    }

    return current;
  }, rules[0]);

  return {
    "Retry-After": String(strictestRule.retryAfterSeconds),
    "X-RateLimit-Limit": String(strictestRule.limit),
    "X-RateLimit-Remaining": String(strictestRule.remaining),
    "X-RateLimit-Reset": String(strictestRule.resetAt),
  };
}

function readEnvInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) {
    return fallback;
  }

  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }

  return parsed;
}

function normalizeIp(value?: string | null): string {
  const normalized = String(value ?? "").trim();
  return normalized || FALLBACK_IP;
}

function normalizeOpaqueValue(value?: string | null): string | null {
  const normalized = String(value ?? "").trim();
  return normalized || null;
}
