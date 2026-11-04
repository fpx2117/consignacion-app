import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { requireAuth, requireRole } from "@/lib/auth/require-auth";
import { validatePasswordStrength } from "@/lib/validators/password";
import {
  isAllowedRole,
  parseEmail,
  parsePositiveId,
  parseRequiredString,
} from "./user-input";
import {
  canChangeOwnRole,
  canManageSucursal,
  getUserAccessError,
  manageableUsersWhere,
} from "./user-authorization";
import {
  deleteUserAndProtectLastAdmin,
  createUserWithinPlanLimit,
  type UserUpdate,
  updateUserAndRevokeSessions,
} from "./user-update";
import { recordAuditLog } from "@/lib/security/audit";
import {
  userCreated,
  userDeleted,
  userUpdated,
} from "@/lib/security/audit-events";
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
      where: manageableUsersWhere(auth),
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
    if (!canManageSucursal(targetSucursalId, auth.allowedSucursalIds, auth.isGlobalView))
      return NextResponse.json({ ok: false, error: "No autorizado" }, { status: 403 });
    const normalizedEmail = safeEmail;
    const pwCheck = validatePasswordStrength(plaintextPassword);
    if (!pwCheck.valid) {
      return NextResponse.json(
        { ok: false, error: pwCheck.errors.join(". ") },
        { status: 400 },
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
    const creation = await createUserWithinPlanLimit({
      nombre: safeName,
      email: normalizedEmail,
      hash,
      rol,
      sucursalId: targetSucursalId,
      zonaHoraria: typeof zonaHoraria === "string" ? zonaHoraria : null,
      activo: true,
    });
    if ("error" in creation)
      return NextResponse.json(
        { ok: false, error: creation.error, limitReached: true },
        { status: 403 },
      );
    await recordAuditLog(
      userCreated({
        actorId: Number(auth.user.sub),
        userId: creation.user.id,
        email: normalizedEmail,
        rol,
        sucursalId: targetSucursalId,
      }),
    );
    return NextResponse.json({ ok: true, data: creation.user });
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
    if (!canChangeOwnRole(Number(auth.user.sub), numericId, rol))
      return NextResponse.json(
        { ok: false, error: "No puedes cambiar tu propio rol" },
        { status: 400 },
      );
    const accessError = await getUserAccessError(numericId, auth, targetSucursalId);
    if (accessError) return accessError;
    const existe = await prisma.usuario.findUnique({
      where: { email: normalizedEmail },
    });
    if (existe && existe.id !== numericId) {
      return NextResponse.json(
        { ok: false, error: "El correo ya está en uso por otro usuario" },
        { status: 400 },
      );
    }
    const dataToUpdate: UserUpdate = {
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

    const usuarioActualizado = await updateUserAndRevokeSessions(
      numericId,
      dataToUpdate,
      auth,
    );
    if (!usuarioActualizado)
      return NextResponse.json(
        { ok: false, error: "Debe permanecer al menos un administrador activo" },
        { status: 409 },
      );
    await recordAuditLog(
      userUpdated({
        actorId: Number(auth.user.sub),
        userId: numericId,
        email: normalizedEmail,
        rol,
        sucursalId: targetSucursalId,
        passwordChanged: Boolean(dataToUpdate.hash),
      }),
    );
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
    const accessError = await getUserAccessError(numericId, auth);
    if (accessError) return accessError;

    if (!(await deleteUserAndProtectLastAdmin(numericId, auth)))
      return NextResponse.json(
        { ok: false, error: "Debe permanecer al menos un administrador activo" },
        { status: 409 },
      );

    await recordAuditLog(
      userDeleted({ actorId: Number(auth.user.sub), userId: numericId }),
    );

    return NextResponse.json({ ok: true, message: "Usuario eliminado" });
  } catch {
    return NextResponse.json(
      { ok: false, error: "Error al eliminar usuario" },
      { status: 500 },
    );
  }
}
