import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { getAuthRateLimitDecision, getRequestIp, normalizeIdentity } from "@/lib/security/auth-rate-limit";
import { buildAuthThrottledResponse, reportAuthRateLimitEvent } from "@/lib/security/auth-security-monitor";
import { getRealClientData } from "@/lib/clientData";
import { getSessionHash } from "@/lib/security/session-hash";

type LoginBody = {
  email?: string;
  password?: string;
  remember?: boolean;
};

type LoginUser = {
  id: number;
  email: string;
  hash: string;
  rol: "ADMIN" | "EMPLEADO";
  nombre: string;
  sucursalId: number | null;
  activo: boolean;
};

type ClientData = Awaited<ReturnType<typeof getRealClientData>>;

type LoginRouteDeps = {
  findUserByEmail: (email: string) => Promise<LoginUser | null>;
  comparePassword: (password: string, hash: string) => Promise<boolean>;
  signUserJwt: (payload: {
    sub: string;
    email: string;
    rol: "ADMIN" | "EMPLEADO";
    nombre: string;
    sucursalId: number | null;
  }) => Promise<string>;
  setAuthCookie: (token: string, remember?: boolean) => Promise<unknown>;
  setActiveSucursalCookie: (sucursalId: number | null) => Promise<void>;
  getRateLimitDecision: (req: Request, email: string | null) => ReturnType<typeof getAuthRateLimitDecision>;
  getClientData: () => Promise<ClientData>;
  createUserSession: (input: { user: LoginUser; token: string; clientData: ClientData; remember: boolean }) => Promise<void>;
  recordAuditLog: (input: {
    userId?: number;
    action: string;
    module: string;
    details?: Record<string, unknown>;
    ipAddress?: string;
    userAgent?: string;
  }) => Promise<unknown>;
};

const INVALID_LOGIN_MESSAGE = "Credenciales invalidas";
const REMAINING_ATTEMPTS_HEADER = "X-Auth-Remaining-Attempts";

const defaultDeps: LoginRouteDeps = {
  findUserByEmail: async (email) => {
    const { prisma } = await import("@/lib/prisma");
    return prisma.usuario.findUnique({ where: { email } });
  },
  comparePassword: async (password, hash) => bcrypt.compare(password, hash),
  signUserJwt: async (payload) => {
    const { signUserJwt } = await import("@/lib/auth/core");
    return signUserJwt(payload);
  },
  setAuthCookie: async (token, remember) => {
    const { setAuthCookie } = await import("@/lib/auth/core");
    await setAuthCookie(token, remember);
  },
  setActiveSucursalCookie: async (sucursalId) => {
    const { cookies: cookiesApi } = await import("next/headers");
    const cookieStore = await cookiesApi();
    cookieStore.set("active_sucursal_id", String(sucursalId || 1), {
      path: "/",
      maxAge: 30 * 24 * 60 * 60,
      sameSite: "lax",
    });
  },
  getRateLimitDecision: (req, email) => getAuthRateLimitDecision({
    endpoint: "login",
    ip: getRequestIp(req),
    identity: email,
  }),
  getClientData: getRealClientData,
  createUserSession: async ({ user, token, clientData, remember }) => {
    const { prisma } = await import("@/lib/prisma");
    // remember=true → 7 días; remember=false → 1 día (sesión corta, sin persistencia)
    const sessionDurationMs = remember
      ? 7 * 24 * 60 * 60 * 1000
      : 24 * 60 * 60 * 1000;
    await prisma.userSession.create({
      data: {
        userId: user.id,
        token: getSessionHash(token),
        userAgent: clientData.userAgent,
        ipAddress: clientData.ip,
        browser: clientData.browser,
        os: clientData.os,
        device: clientData.device,
        expiresAt: new Date(Date.now() + sessionDurationMs),
      },
    });
  },
  recordAuditLog: async (input) => {
    const { recordAuditLog } = await import("@/lib/security/audit");
    await recordAuditLog(input);
  },
};

export async function handlePostLogin(req: Request, deps: LoginRouteDeps = defaultDeps) {
  const body = (await req.json().catch(() => null)) as LoginBody | null;
  const email = normalizeIdentity(body?.email);
  const password = String(body?.password || "");
  const remember = body?.remember !== false; // por defecto true si no viene

  const rateLimitDecision = deps.getRateLimitDecision(req, email);
  await reportAuthRateLimitEvent({
    decision: rateLimitDecision,
    identity: email,
    recordAuditLog: deps.recordAuditLog,
  });

  if (!rateLimitDecision.allowed) {
    return buildAuthThrottledResponse(rateLimitDecision.headers);
  }

  if (!email || !password) {
    return NextResponse.json(
      { error: "Email y password requeridos" },
      { status: 400 },
    );
  }

  const user = await deps.findUserByEmail(email);
  if (!user || !user.activo) {
    return buildInvalidLoginResponse(rateLimitDecision);
  }

  const passwordMatches = await deps.comparePassword(password, user.hash);
  if (!passwordMatches) {
    return buildInvalidLoginResponse(rateLimitDecision);
  }

  const token = await deps.signUserJwt({
    sub: String(user.id),
    email: user.email,
    rol: user.rol,
    nombre: user.nombre,
    sucursalId: user.sucursalId,
  });

  await deps.setAuthCookie(token, remember);
  await deps.setActiveSucursalCookie(user.sucursalId);

  try {
    const clientData = await deps.getClientData();

    await deps.createUserSession({
      user,
      token,
      clientData,
      remember,
    });

    await deps.recordAuditLog({
      userId: user.id,
      action: "LOGIN",
      module: "AUTH",
      details: { email: user.email },
      ipAddress: clientData.ip,
      userAgent: clientData.userAgent,
    });
  } catch (error) {
    console.error(
      "Error logging session:",
      error instanceof Error ? error.message : error,
    );
  }

  return NextResponse.json({
    data: {
      id: user.id,
      nombre: user.nombre,
      email: user.email,
      rol: user.rol,
    },
  });
}

export async function POST(req: Request) {
  return handlePostLogin(req);
}

function buildInvalidLoginResponse(rateLimitDecision: ReturnType<LoginRouteDeps["getRateLimitDecision"]>) {
  const headers = new Headers(rateLimitDecision.headers);
  const remainingAttempts = rateLimitDecision.matchedRules.find((rule) => rule.name === "identity")?.remaining;

  if (typeof remainingAttempts === "number") {
    headers.set(REMAINING_ATTEMPTS_HEADER, String(remainingAttempts));
  }

  return NextResponse.json(
    { error: INVALID_LOGIN_MESSAGE },
    { status: 401, headers },
  );
}
