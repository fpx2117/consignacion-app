import bcrypt from "bcryptjs";
import crypto from "crypto";
import { NextResponse } from "next/server";
import { getAuthRateLimitDecision, getRequestIp } from "@/lib/auth-rate-limit";
import {
  buildAuthThrottledResponse,
  reportAuthRateLimitEvent,
  RESET_PASSWORD_INVALID_MESSAGE,
} from "@/lib/auth-security-monitor";
import { validatePasswordStrength } from "@/lib/validators/password";

type ResetPasswordTokenRecord = {
  email: string;
  expiresAt: Date;
};

type ResetPasswordUser = {
  id: number;
};

type ResetPasswordRouteDeps = {
  findTokenRecord: (tokenHash: string) => Promise<ResetPasswordTokenRecord | null>;
  findUserByEmail: (email: string) => Promise<ResetPasswordUser | null>;
  updatePasswordAndDeleteToken: (input: { userId: number; hash: string; tokenHash: string }) => Promise<void>;
  hashPassword: (password: string) => Promise<string>;
  getRateLimitDecision: (req: Request, token: string | null) => ReturnType<typeof getAuthRateLimitDecision>;
  recordAuditLog: (input: {
    userId?: number;
    action: string;
    module: string;
    details?: Record<string, unknown>;
    ipAddress?: string;
    userAgent?: string;
  }) => Promise<unknown>;
};

const defaultDeps: ResetPasswordRouteDeps = {
  findTokenRecord: async (tokenHash) => {
    const { prisma } = await import("@/lib/prisma");
    return prisma.resetPasswordToken.findUnique({
      where: { token: tokenHash },
      select: {
        email: true,
        expiresAt: true,
      },
    });
  },
  findUserByEmail: async (email) => {
    const { prisma } = await import("@/lib/prisma");
    return prisma.usuario.findUnique({
      where: { email },
      select: { id: true },
    });
  },
  updatePasswordAndDeleteToken: async ({ userId, hash, tokenHash }) => {
    const { prisma } = await import("@/lib/prisma");
    await prisma.$transaction([
      prisma.usuario.update({
        where: { id: userId },
        data: { hash },
      }),
      prisma.resetPasswordToken.delete({
        where: { token: tokenHash },
      }),
    ]);
  },
  hashPassword: async (password) => bcrypt.hash(password, 10),
  getRateLimitDecision: (req, token) => getAuthRateLimitDecision({
    endpoint: "reset-password",
    ip: getRequestIp(req),
    token,
  }),
  recordAuditLog: async (input) => {
    const { recordAuditLog } = await import("@/lib/audit");
    await recordAuditLog(input);
  },
};

export async function handlePostResetPassword(req: Request, deps: ResetPasswordRouteDeps = defaultDeps) {
  try {
    const body = await req.json().catch(() => null) as { token?: string; password?: string } | null;
    const token = String(body?.token || "").trim() || null;
    const password = String(body?.password || "");

    const rateLimitDecision = deps.getRateLimitDecision(req, token);
    await reportAuthRateLimitEvent({
      decision: rateLimitDecision,
      token,
      recordAuditLog: deps.recordAuditLog,
    });

    if (!rateLimitDecision.allowed) {
      return buildAuthThrottledResponse(rateLimitDecision.headers);
    }

    if (!token || !password) {
      return NextResponse.json(
        { message: "Token o nueva contrasena faltante" },
        { status: 400 },
      );
    }

    const passwordCheck = validatePasswordStrength(password);
    if (!passwordCheck.valid) {
      return NextResponse.json(
        { message: passwordCheck.errors.join(". ") },
        { status: 400 },
      );
    }

    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
    const tokenRecord = await deps.findTokenRecord(tokenHash);

    if (!tokenRecord || tokenRecord.expiresAt < new Date()) {
      return NextResponse.json(
        { message: RESET_PASSWORD_INVALID_MESSAGE },
        { status: 400 },
      );
    }

    const user = await deps.findUserByEmail(tokenRecord.email);
    if (!user) {
      return NextResponse.json(
        { message: RESET_PASSWORD_INVALID_MESSAGE },
        { status: 400 },
      );
    }

    const hash = await deps.hashPassword(password);
    await deps.updatePasswordAndDeleteToken({
      userId: user.id,
      hash,
      tokenHash,
    });

    return NextResponse.json(
      { message: "Contrasena actualizada con exito" },
      { status: 200 },
    );
  } catch (error) {
    console.error("Error en reset-password:", error);
    return NextResponse.json(
      { message: "Ocurrio un error al procesar la solicitud" },
      { status: 500 },
    );
  }
}

export async function POST(req: Request) {
  return handlePostResetPassword(req);
}
