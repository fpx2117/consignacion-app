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
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(72658463821002)`;
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
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(72658463821002)`;
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
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(72658463821002)`;
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

    // La suscripción pertenece a la instalación, no al usuario: `userId` es solo
    // el contacto de facturación. Si se elimina ese contacto, se reasigna a otro
    // administrador activo en la misma transacción, en lugar de dejar que la FK
    // (`ON DELETE RESTRICT`) rompa el borrado con un 500 opaco.
    // Ver odd/mejoras-arquitectura/adrs/002-suscripcion-de-la-instalacion.md.
    const ownsSubscription = await tx.subscription.findUnique({
      where: { userId },
      select: { id: true },
    });

    if (ownsSubscription) {
      const replacement = await tx.usuario.findFirst({
        where: {
          rol: "ADMIN",
          activo: true,
          id: { not: userId },
          // `userId` es único en Subscription: el nuevo contacto no puede tener
          // ya una suscripción propia.
          subscription: { is: null },
        },
        orderBy: { id: "asc" },
        select: { id: true },
      });
      if (!replacement) return false;
      await tx.subscription.update({
        where: { userId },
        data: { userId: replacement.id },
      });
    }

    await tx.usuario.delete({ where: { id: userId } });
    return true;
  });
}
