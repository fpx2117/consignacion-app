import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth/require-auth";
import { resolveTimezoneForAuth } from "@/lib/get-configured-tz";

type SucursalPermitida = {
  id: number;
  nombre: string;
  esPrincipal: boolean;
  activa: boolean;
};

type AuthMeUser = {
  id: number;
  nombre: string;
  email: string;
  rol: string;
  activo: boolean;
  createdAt: Date;
  sucursalId: number | null;
  zonaHoraria: string | null;
  subscription: unknown;
};

type AuthMeRouteDeps = {
  requireAuth: typeof requireAuth;
  findUserById: (userId: number) => Promise<AuthMeUser | null>;
  resolveTimezoneForAuth: typeof resolveTimezoneForAuth;
  findAdminBranches: () => Promise<SucursalPermitida[]>;
  findEmployeeBranches: (sucursalId: number) => Promise<SucursalPermitida[]>;
};

const defaultDeps: AuthMeRouteDeps = {
  requireAuth,
  findUserById: (userId) =>
    prisma.usuario.findUnique({
      where: { id: userId },
      include: {
        subscription: {
          include: {
            plan: {
              include: {
                limits: true,
              },
            },
          },
        },
      },
    }) as Promise<AuthMeUser | null>,
  resolveTimezoneForAuth,
  findAdminBranches: () =>
    prisma.sucursal.findMany({
      where: { activa: true },
      select: { id: true, nombre: true, esPrincipal: true, activa: true },
      orderBy: { id: "asc" },
    }),
  findEmployeeBranches: (sucursalId) =>
    prisma.sucursal.findMany({
      where: { id: sucursalId },
      select: { id: true, nombre: true, esPrincipal: true, activa: true },
    }),
};

export async function handleGetMe(deps: AuthMeRouteDeps = defaultDeps) {
  const auth = await deps.requireAuth();
  if (!auth.ok) return auth.res;

  try {
    const userId = Number(auth.user.sub);

    if (!userId) {
      return NextResponse.json({ error: "Token inválido" }, { status: 401 });
    }

    const user = await deps.findUserById(userId);

    if (!user || !user.activo) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const timezone = await deps.resolveTimezoneForAuth(auth);

    // Lógica de Sucursales permitidas
    let sucursalesPermitidas: SucursalPermitida[] = [];

    if (user.rol === "ADMIN") {
      // ADMIN siempre puede ver todas las sucursales activas para visualizarlas
      sucursalesPermitidas = await deps.findAdminBranches();
    } else {
      // EMPLEADO -> solo ve su sucursal asignada (o la principal si no tiene)
      const empSucursalId = user.sucursalId || 1;
      sucursalesPermitidas = await deps.findEmployeeBranches(empSucursalId);
    }

    return NextResponse.json({
      data: {
        ...user,
        zonaHorariaSucursal: timezone.zonaHorariaSucursal,
        zonaHorariaResuelta: timezone.tz,
        timezoneSource: timezone.source,
        sucursalesPermitidas,
      },
    }, {
      status: 200,
      headers: {
        "Cache-Control": "private, max-age=30, stale-while-revalidate=90",
      },
    });
  } catch {
    return NextResponse.json({ error: "Token inválido" }, { status: 401 });
  }
}

export async function GET() {
  return handleGetMe();
}
