import { Prisma } from "@prisma/client";
import { canManageSucursal } from "./user-authorization";

export type UserUpdate = Prisma.UsuarioUncheckedUpdateInput & {
  rol: "ADMIN" | "EMPLEADO";
  sucursalId: number | null;
};

export function canRemoveUser(
  role: "ADMIN" | "EMPLEADO",
  activeAdminCount: number,
): boolean {
  return role !== "ADMIN" || activeAdminCount > 1;
}

export async function createUserWithinPlanLimit(
  data: Prisma.UsuarioUncheckedCreateInput,
) {
  const { prisma } = await import("@/lib/prisma");
  const { checkUserLimit } = await import("@/lib/subscriptions/require-subscription");
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(72658463821002)`;
    const limit = await checkUserLimit();
    if (!limit.allowed) return { error: limit.message } as const;
    const user = await tx.usuario.create({
      data,
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
    return { user } as const;
  });
}

export async function updateUserAndRevokeSessions(
  userId: number,
  data: UserUpdate,
  scope: { allowedSucursalIds: number[]; isGlobalView: boolean },
) {
  const { prisma } = await import("@/lib/prisma");
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(72658463821002)`;
    const current = await tx.usuario.findUnique({
      where: { id: userId },
      select: { rol: true, sucursalId: true },
    });
    if (
      !current ||
      !canManageSucursal(
        current.sucursalId,
        scope.allowedSucursalIds,
        scope.isGlobalView,
      ) ||
      !canManageSucursal(
        data.sucursalId,
        scope.allowedSucursalIds,
        scope.isGlobalView,
      ) ||
      (
      data.rol !== "ADMIN" &&
      !canRemoveUser(
        current.rol,
        await tx.usuario.count({ where: { rol: "ADMIN", activo: true } }),
      ))
    )
      return null;
    const updated = await tx.usuario.update({
      where: { id: userId },
      data,
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
    await tx.userSession.updateMany({
      where: { userId, isActive: true },
      data: { isActive: false },
    });
    return updated;
  });
}

export async function deleteUserAndProtectLastAdmin(
  userId: number,
  scope: { allowedSucursalIds: number[]; isGlobalView: boolean },
) {
  const { prisma } = await import("@/lib/prisma");
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(72658463821002)`;
    const target = await tx.usuario.findUnique({
      where: { id: userId },
      select: { rol: true, sucursalId: true },
    });
    if (
      !target ||
      !canManageSucursal(
        target.sucursalId,
        scope.allowedSucursalIds,
        scope.isGlobalView,
      )
    )
      return false;
    const adminCount = await tx.usuario.count({
      where: { rol: "ADMIN", activo: true },
    });
    if (!canRemoveUser(target.rol, adminCount)) return false;
    await tx.usuario.delete({ where: { id: userId } });
    return true;
  });
}
