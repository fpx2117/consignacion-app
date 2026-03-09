import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  // Guard: Solo permitir si el sistema NO tiene usuarios (primera inicialización)
  const userCount = await prisma.usuario.count();
  if (userCount > 0) {
    return NextResponse.json(
      { error: "El sistema ya fue inicializado. No se pueden crear usuarios por esta vía." },
      { status: 403 }
    );
  }

  const body = await req.json().catch(() => null);

  const email = String(body?.email || "").toLowerCase().trim();
  const password = String(body?.password || "");
  const nombre = String(body?.nombre || "Admin");

  if (!email || !password) {
    return NextResponse.json({ error: "Email y password requeridos" }, { status: 400 });
  }

  const exists = await prisma.usuario.findUnique({ where: { email } });
  if (exists) return NextResponse.json({ error: "Ya existe un usuario con ese email" }, { status: 409 });

  const hash = await bcrypt.hash(password, 10);

  const admin = await prisma.usuario.create({
    data: { email, nombre, hash, rol: "ADMIN", activo: true },
    select: { id: true, email: true, nombre: true, rol: true },
  });

  return NextResponse.json({ data: admin }, { status: 201 });
}
