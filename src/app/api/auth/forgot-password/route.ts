import crypto from "crypto";
import { NextResponse } from "next/server";
import { Resend } from "resend";
import { getAuthRateLimitDecision, getRequestIp, normalizeIdentity } from "@/lib/auth-rate-limit";
import {
  buildAuthThrottledResponse,
  FORGOT_PASSWORD_SAFE_MESSAGE,
  reportAuthRateLimitEvent,
} from "@/lib/auth-security-monitor";

type ForgotPasswordUser = {
  nombre: string;
};

type ForgotPasswordRouteDeps = {
  findUserByEmail: (email: string) => Promise<ForgotPasswordUser | null>;
  replaceResetToken: (email: string, tokenHash: string, expiresAt: Date) => Promise<void>;
  sendResetEmail: (input: { email: string; nombre: string; token: string }) => Promise<void>;
  getRateLimitDecision: (req: Request, email: string | null) => ReturnType<typeof getAuthRateLimitDecision>;
  recordAuditLog: (input: {
    userId?: number;
    action: string;
    module: string;
    details?: Record<string, unknown>;
    ipAddress?: string;
    userAgent?: string;
  }) => Promise<unknown>;
};

const defaultDeps: ForgotPasswordRouteDeps = {
  findUserByEmail: async (email) => {
    const { prisma } = await import("@/lib/prisma");
    return prisma.usuario.findUnique({
      where: { email },
      select: { nombre: true },
    });
  },
  replaceResetToken: async (email, tokenHash, expiresAt) => {
    const { prisma } = await import("@/lib/prisma");
    await prisma.$transaction([
      prisma.resetPasswordToken.deleteMany({ where: { email } }),
      prisma.resetPasswordToken.create({
        data: {
          email,
          token: tokenHash,
          expiresAt,
        },
      }),
    ]);
  },
  sendResetEmail: async ({ email, nombre, token }) => {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const resetLink = `${baseUrl}/reset-password?token=${token}`;

    if (!process.env.RESEND_API_KEY) {
      console.warn("No RESEND_API_KEY found. Password reset email could not be sent for:", email);
      return;
    }

    const resend = new Resend(process.env.RESEND_API_KEY);

    await resend.emails.send({
      from: "Sistema <onboarding@resend.dev>",
      to: email,
      subject: "Recuperacion de contrasena",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden;">
          <div style="background-color: #f5f5f5; padding: 20px; text-align: center;">
            <h1 style="color: #111827; margin: 0; font-size: 24px;">Recuperacion de contrasena</h1>
          </div>
          <div style="padding: 20px;">
            <p style="color: #111827; font-size: 16px;">Hola ${nombre},</p>
            <p style="color: #111827; font-size: 16px;">Recibimos una solicitud para restablecer tu contrasena. Hace clic en el siguiente boton para crear una nueva:</p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${resetLink}" style="background-color: #111827; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">Restablecer contrasena</a>
            </div>
            <p style="color: #6b7280; font-size: 14px;">Si no solicitaste este cambio, podes ignorar este correo. El enlace expirara en 1 hora.</p>
          </div>
        </div>
      `,
    });
  },
  getRateLimitDecision: (req, email) => getAuthRateLimitDecision({
    endpoint: "forgot-password",
    ip: getRequestIp(req),
    identity: email,
  }),
  recordAuditLog: async (input) => {
    const { recordAuditLog } = await import("@/lib/audit");
    await recordAuditLog(input);
  },
};

export async function handlePostForgotPassword(req: Request, deps: ForgotPasswordRouteDeps = defaultDeps) {
  try {
    const body = await req.json().catch(() => null) as { email?: string } | null;
    const email = normalizeIdentity(body?.email);

    const rateLimitDecision = deps.getRateLimitDecision(req, email);
    await reportAuthRateLimitEvent({
      decision: rateLimitDecision,
      identity: email,
      recordAuditLog: deps.recordAuditLog,
    });

    if (!rateLimitDecision.allowed) {
      return buildAuthThrottledResponse(rateLimitDecision.headers);
    }

    if (!email) {
      return NextResponse.json(
        { message: "El email es requerido" },
        { status: 400 },
      );
    }

    const user = await deps.findUserByEmail(email);
    if (!user) {
      return NextResponse.json({ message: FORGOT_PASSWORD_SAFE_MESSAGE }, { status: 200 });
    }

    const token = crypto.randomBytes(32).toString("hex");
    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

    await deps.replaceResetToken(email, tokenHash, expiresAt);
    await deps.sendResetEmail({
      email,
      nombre: user.nombre,
      token,
    });

    return NextResponse.json({ message: FORGOT_PASSWORD_SAFE_MESSAGE }, { status: 200 });
  } catch (error) {
    console.error("Error en forgot-password:", error);
    return NextResponse.json(
      { message: "Ocurrio un error al procesar la solicitud" },
      { status: 500 },
    );
  }
}

export async function POST(req: Request) {
  return handlePostForgotPassword(req);
}
