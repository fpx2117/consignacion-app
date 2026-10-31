import { NextResponse } from "next/server";

type UserScope = {
  allowedSucursalIds: number[];
  isGlobalView: boolean;
};

export function canManageSucursal(
  sucursalId: number | null,
  allowedSucursalIds: number[],
  canManageGlobal: boolean,
): boolean {
  return sucursalId === null
    ? canManageGlobal
    : allowedSucursalIds.includes(sucursalId);
}

export function canChangeOwnRole(
  currentUserId: number,
  targetUserId: number,
  nextRole: "ADMIN" | "EMPLEADO",
): boolean {
  return currentUserId !== targetUserId || nextRole === "ADMIN";
}

type FindUserSucursal = (
  userId: number,
) => Promise<{ sucursalId: number | null } | null>;

const findUserSucursal: FindUserSucursal = async (userId) => {
  const { prisma } = await import("@/lib/prisma");
  return prisma.usuario.findUnique({
    where: { id: userId },
    select: { sucursalId: true },
  });
};

export function manageableUsersWhere(scope: UserScope) {
  return {
    OR: [
      { sucursalId: { in: scope.allowedSucursalIds } },
      ...(scope.isGlobalView ? [{ sucursalId: null }] : []),
    ],
  };
}

export async function getUserAccessError(
  userId: number,
  scope: UserScope,
  targetSucursalId?: number | null,
  findTarget: FindUserSucursal = findUserSucursal,
) {
  const target = await findTarget(userId);
  if (!target)
    return NextResponse.json(
      { ok: false, error: "Usuario no encontrado" },
      { status: 404 },
    );
  if (
    !canManageSucursal(
      target.sucursalId,
      scope.allowedSucursalIds,
      scope.isGlobalView,
    ) ||
    (targetSucursalId !== undefined &&
      !canManageSucursal(
        targetSucursalId,
        scope.allowedSucursalIds,
        scope.isGlobalView,
      ))
  )
    return NextResponse.json(
      { ok: false, error: "No autorizado" },
      { status: 403 },
    );
  return null;
}
