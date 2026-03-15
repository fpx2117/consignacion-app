import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { setAuthCookie, signUserJwt } from "@/lib/auth/core";

type LoginBody = {
  email?: string;
  password?: string;
};

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as LoginBody | null;

  const email = String(body?.email || "").toLowerCase().trim();
  const password = String(body?.password || "");

  if (!email || !password) {
    return NextResponse.json(
      { error: "Email y password requeridos" },
      { status: 400 }
    );
  }

  const user = await prisma.usuario.findUnique({ where: { email } });

  if (!user || !user.activo) {
    return NextResponse.json({ error: "Credenciales inválidas" }, { status: 401 });
  }

  const ok = await bcrypt.compare(password, user.hash);
  if (!ok) {
    return NextResponse.json({ error: "Credenciales inválidas" }, { status: 401 });
  }

  const token = await signUserJwt({
    sub: String(user.id),
    email: user.email,
    rol: user.rol,
    nombre: user.nombre,
    sucursalId: user.sucursalId,
  });

  // ✅ IMPORTANTÍSIMO
  await setAuthCookie(token);

  // Setear cookie de sucursal activa al login
  const { cookies: cookiesApi } = await import("next/headers");
  const cookieStore = await cookiesApi();
  cookieStore.set("active_sucursal_id", String(user.sucursalId || 1), {
    path: "/",
    maxAge: 30 * 24 * 60 * 60,
    sameSite: "lax",
  });

  // --- NUEVO: Seguimiento de Sesión y Auditoría ---
  try {
    const { getRealClientData } = await import("@/lib/clientData");
    const { getSessionHash } = await import("@/lib/security/session-hash");
    const clientData = await getRealClientData();
    const sessionToken = getSessionHash(token);

    // Crear sesión en DB
    await prisma.userSession.create({
      data: {
        userId: user.id,
        token: sessionToken,
        userAgent: clientData.userAgent,
        ipAddress: clientData.ip,
        browser: clientData.browser,
        os: clientData.os,
        device: clientData.device,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 días
      },
    });

    // Registrar en auditoría
    const { recordAuditLog } = await import("@/lib/audit");
    await recordAuditLog({
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
      error instanceof Error ? error.message : error
    );
  }

  return NextResponse.json({
    data: { id: user.id, nombre: user.nombre, email: user.email, rol: user.rol },
  });
}
