import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { Prisma } from "@prisma/client";
import { checkUserLimit } from "@/lib/subscriptions/require-subscription";
import { requireAuth, requireRole } from "@/lib/auth/require-auth";
import { validatePasswordStrength } from "@/lib/validators/password";
import {
  isAllowedRole,
  parseEmail,
  parsePositiveId,
  parseRequiredString,
} from "./user-input";

export async function GET() {
  const auth = await requireAuth();
  if (!auth.ok) return auth.res;
  if (!requireRole(auth.user, ["ADMIN"])) {
    return NextResponse.json(
      { ok: false, error: "No autorizado" },
      { status: 403 },
    );
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
        zonaHoraria: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ ok: true, data: usuarios });
  } catch {
    return NextResponse.json(
      { ok: false, error: "Error al obtener usuarios" },
      { status: 500 },
    );
  }
}

export async function POST(req: Request) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.res;
  if (!requireRole(auth.user, ["ADMIN"])) {
    return NextResponse.json(
      { ok: false, error: "No autorizado" },
      { status: 403 },
    );
  }

  try {
    const body = await req.json();
    if (!body || typeof body !== "object" || Array.isArray(body))
      return NextResponse.json({ ok: false, error: "Body inválido" }, { status: 400 });
    const {
      nombre,
      email,
      password: plaintextPassword,
      rol,
      sucursalId,
      zonaHoraria,
    } = body;

    const safeName = parseRequiredString(nombre, 120);
    const safeEmail = parseEmail(email);
    const targetSucursalId = parsePositiveId(sucursalId ?? auth.activeSucursalId);
    if (
      !safeName ||
      !safeEmail ||
      typeof plaintextPassword !== "string" ||
      !isAllowedRole(rol) ||
      !targetSucursalId
    ) {
      return NextResponse.json(
        { ok: false, error: "Faltan campos obligatorios" },
        { status: 400 },
      );
    }

    const normalizedEmail = safeEmail;

    const pwCheck = validatePasswordStrength(plaintextPassword);
    if (!pwCheck.valid) {
      return NextResponse.json(
        { ok: false, error: pwCheck.errors.join(". ") },
        { status: 400 },
      );
    }

    // Guard: Verificar límite de usuarios del plan
    const userCheck = await checkUserLimit();
    if (!userCheck.allowed) {
      return NextResponse.json(
        { ok: false, error: userCheck.message, limitReached: true },
        { status: 403 },
      );
    }

    const existe = await prisma.usuario.findUnique({
      where: { email: normalizedEmail },
    });
    if (existe) {
      return NextResponse.json(
        { ok: false, error: "Ya existe un usuario con este correo" },
        { status: 400 },
      );
    }

    const hash = await bcrypt.hash(plaintextPassword, 12);

    const nuevoUsuario = await prisma.usuario.create({
      data: {
        nombre: safeName,
        email: normalizedEmail,
        hash,
        rol,
        sucursalId: targetSucursalId,
        zonaHoraria: typeof zonaHoraria === "string" ? zonaHoraria : null,
        activo: true,
      },
      select: {
        id: true,
        nombre: true,
        email: true,
        rol: true,
        sucursalId: true,
        zonaHoraria: true,
        activo: true,
        createdAt: true,
      },
    });

    return NextResponse.json({ ok: true, data: nuevoUsuario });
  } catch {
    return NextResponse.json(
      { ok: false, error: "Error al crear usuario" },
      { status: 500 },
    );
  }
}

export async function PUT(req: Request) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.res;
  if (!requireRole(auth.user, ["ADMIN"])) {
    return NextResponse.json(
      { ok: false, error: "No autorizado" },
      { status: 403 },
    );
  }

  try {
    const body = await req.json();
    if (!body || typeof body !== "object" || Array.isArray(body))
      return NextResponse.json({ ok: false, error: "Body inválido" }, { status: 400 });
    const {
      id,
      nombre,
      email,
      password: plaintextPassword,
      rol,
      sucursalId,
      zonaHoraria,
    } = body;

    const numericId = parsePositiveId(id);
    const safeName = parseRequiredString(nombre, 120);
    const safeEmail = parseEmail(email);
    const targetSucursalId =
      sucursalId === null ? null : parsePositiveId(sucursalId);
    if (
      !numericId ||
      !safeName ||
      !safeEmail ||
      !isAllowedRole(rol) ||
      (sucursalId !== null && !targetSucursalId)
    ) {
      return NextResponse.json(
        { ok: false, error: "Faltan campos obligatorios" },
        { status: 400 },
      );
    }

    const normalizedEmail = safeEmail;

    const existe = await prisma.usuario.findUnique({
      where: { email: normalizedEmail },
    });
    if (existe && existe.id !== numericId) {
      return NextResponse.json(
        { ok: false, error: "El correo ya está en uso por otro usuario" },
        { status: 400 },
      );
    }

    const dataToUpdate: Prisma.UsuarioUncheckedUpdateInput = {
      nombre: safeName,
      email: normalizedEmail,
      rol,
      sucursalId: targetSucursalId,
      ...(zonaHoraria !== undefined ? { zonaHoraria } : {}),
    };

    if (plaintextPassword !== undefined && plaintextPassword !== "") {
      if (typeof plaintextPassword !== "string") {
        return NextResponse.json(
          { ok: false, error: "Contraseña inválida" },
          { status: 400 },
        );
      }
      const pwCheck = validatePasswordStrength(plaintextPassword);
      if (!pwCheck.valid) {
        return NextResponse.json(
          { ok: false, error: pwCheck.errors.join(". ") },
          { status: 400 },
        );
      }
      dataToUpdate.hash = await bcrypt.hash(plaintextPassword, 12);
    }

    const usuarioActualizado = await prisma.usuario.update({
      where: { id: numericId },
      data: dataToUpdate,
      select: {
        id: true,
        nombre: true,
        email: true,
        rol: true,
        sucursalId: true,
        zonaHoraria: true,
        activo: true,
        createdAt: true,
      },
    });

    return NextResponse.json({ ok: true, data: usuarioActualizado });
  } catch {
    return NextResponse.json(
      { ok: false, error: "Error al actualizar usuario" },
      { status: 500 },
    );
  }
}

export async function DELETE(req: Request) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.res;
  if (!requireRole(auth.user, ["ADMIN"])) {
    return NextResponse.json(
      { ok: false, error: "No autorizado" },
      { status: 403 },
    );
  }

  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    const numericId = parsePositiveId(id);
    if (!numericId) {
      return NextResponse.json(
        { ok: false, error: "Falta el ID del usuario" },
        { status: 400 },
      );
    }

    if (numericId === Number(auth.user.sub)) {
      return NextResponse.json(
        { ok: false, error: "No puedes eliminar tu propio usuario" },
        { status: 400 },
      );
    }

    await prisma.usuario.delete({
      where: { id: numericId },
    });

    return NextResponse.json({ ok: true, message: "Usuario eliminado" });
  } catch {
    return NextResponse.json(
      { ok: false, error: "Error al eliminar usuario" },
      { status: 500 },
    );
  }
}
