import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { setAuthCookie, signUserJwt } from "@/lib/auth";

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);

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
  });

  // ✅ IMPORTANTÍSIMO
  await setAuthCookie(token);

  return NextResponse.json({
    data: { id: user.id, nombre: user.nombre, email: user.email, rol: user.rol },
  });
}
