/* eslint-disable */
// @ts-nocheck
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { checkUserLimit } from "@/lib/requireSubscription";
import { requireAuth, requireRole } from "@/lib/requireAuth";
import { validatePasswordStrength } from "@/lib/validators/password";

// --- GET: Listar usuarios ---
export async function GET() {
  // Auth: Solo ADMIN puede listar usuarios
  const auth = await requireAuth();
  if (!auth.ok) return auth.res;
  if (!requireRole(auth.user, ["ADMIN"])) {
    return NextResponse.json({ ok: false, error: "No autorizado" }, { status: 403 });
  }

  try {
    const usuarios = await prisma.usuario.findMany({
      select: {
        id: true,
        nombre: true,
        email: true,
        rol: true,
        activo: true,
        sucursalId: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ ok: true, data: usuarios });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: "Error al obtener usuarios" }, { status: 500 });
  }
}

// --- POST: Crear usuario ---
export async function POST(req: Request) {
  // Auth: Solo ADMIN puede crear usuarios
  const auth = await requireAuth();
  if (!auth.ok) return auth.res;
  if (!requireRole(auth.user, ["ADMIN"])) {
    return NextResponse.json({ ok: false, error: "No autorizado" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const { nombre, email, password, rol, sucursalId } = body;

    if (!nombre || !email || !password || !rol) {
      return NextResponse.json({ ok: false, error: "Faltan campos obligatorios" }, { status: 400 });
    }

    const normalizedEmail = String(email).trim().toLowerCase();

    // Validate password strength server-side
    const pwCheck = validatePasswordStrength(password);
    if (!pwCheck.valid) {
      return NextResponse.json({ ok: false, error: pwCheck.errors.join(". ") }, { status: 400 });
    }

    // Guard: Verificar límite de usuarios del plan
    const userCheck = await checkUserLimit();
    if (!userCheck.allowed) {
      return NextResponse.json({ ok: false, error: userCheck.message, limitReached: true }, { status: 403 });
    }

    const existe = await prisma.usuario.findUnique({ where: { email: normalizedEmail } });
    if (existe) {
      return NextResponse.json({ ok: false, error: "Ya existe un usuario con este correo" }, { status: 400 });
    }

    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash(password, salt);

    const nuevoUsuario = await prisma.usuario.create({
      data: {
        nombre,
        email: normalizedEmail,
        hash,
        rol,
        sucursalId: sucursalId ? Number(sucursalId) : 1,
        activo: true
      },
      select: { id: true, nombre: true, email: true, rol: true, sucursalId: true, activo: true, createdAt: true },
    });

    return NextResponse.json({ ok: true, data: nuevoUsuario });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: "Error al crear usuario" }, { status: 500 });
  }
}

// --- PUT: Editar usuario ---
export async function PUT(req: Request) {
  // Auth: Solo ADMIN puede editar usuarios
  const auth = await requireAuth();
  if (!auth.ok) return auth.res;
  if (!requireRole(auth.user, ["ADMIN"])) {
    return NextResponse.json({ ok: false, error: "No autorizado" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const { id, nombre, email, password, rol, sucursalId } = body;

    if (!id || !nombre || !email || !rol) {
      return NextResponse.json({ ok: false, error: "Faltan campos obligatorios" }, { status: 400 });
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const numericId = Number(id);

    const existe = await prisma.usuario.findUnique({ where: { email: normalizedEmail } });
    if (existe && existe.id !== numericId) {
      return NextResponse.json({ ok: false, error: "El correo ya está en uso por otro usuario" }, { status: 400 });
    }

    const dataToUpdate: any = {
      nombre,
      email: normalizedEmail,
      rol,
      sucursalId: sucursalId ? Number(sucursalId) : null
    };

    if (password && password.trim() !== "") {
      // Validate password strength server-side
      const pwCheck = validatePasswordStrength(password);
      if (!pwCheck.valid) {
        return NextResponse.json({ ok: false, error: pwCheck.errors.join(". ") }, { status: 400 });
      }
      const salt = await bcrypt.genSalt(10);
      dataToUpdate.hash = await bcrypt.hash(password, salt);
    }

    const usuarioActualizado = await prisma.usuario.update({
      where: { id: numericId },
      data: dataToUpdate,
      select: { id: true, nombre: true, email: true, rol: true, sucursalId: true, activo: true, createdAt: true },
    });

    return NextResponse.json({ ok: true, data: usuarioActualizado });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: "Error al actualizar usuario" }, { status: 500 });
  }
}

// --- DELETE: Eliminar usuario ---
export async function DELETE(req: Request) {
  // Auth: Solo ADMIN puede eliminar usuarios
  const auth = await requireAuth();
  if (!auth.ok) return auth.res;
  if (!requireRole(auth.user, ["ADMIN"])) {
    return NextResponse.json({ ok: false, error: "No autorizado" }, { status: 403 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ ok: false, error: "Falta el ID del usuario" }, { status: 400 });
    }

    await prisma.usuario.delete({
      where: { id: parseInt(id) },
    });

    return NextResponse.json({ ok: true, message: "Usuario eliminado" });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: "Error al eliminar usuario" }, { status: 500 });
  }
}
