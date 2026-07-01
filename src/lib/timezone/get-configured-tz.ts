import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";
import { TECHNICAL_FALLBACK_TZ } from "@/lib/timezone/timezone-constants";

export { TECHNICAL_FALLBACK_TZ } from "@/lib/timezone/timezone-constants";

export type TimezoneSource = "user" | "branch" | "fallback";

export type ResolveTimezoneInput = {
  userId?: number | null;
  sucursalId?: number | null;
};

export type ResolvedTimezone = {
  tz: string;
  source: TimezoneSource;
  userId: number | null;
  sucursalId: number | null;
  zonaHorariaUsuario: string | null;
  zonaHorariaSucursal: string | null;
};

type AuthTimezoneInput = {
  user: { sub: string };
  activeSucursalId: number;
};

type UserTimezoneRecord = {
  id: number;
  zonaHoraria: string | null;
};

type BranchTimezoneRecord = {
  sucursalId: number;
  zonaHoraria: string | null;
};

export type TimezoneResolverDeps = {
  getUserTimezoneRecord: (userId: number | null | undefined) => Promise<UserTimezoneRecord | null>;
  getBranchTimezoneRecord: (sucursalId: number | null | undefined) => Promise<BranchTimezoneRecord | null>;
  logFallbackTimezone?: (resolved: ResolvedTimezone) => void;
};

export function isValidTimezone(value: string | null | undefined): value is string {
  if (!value) return false;

  try {
    new Intl.DateTimeFormat(undefined, { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

async function getUserTimezoneRecord(userId: number | null | undefined): Promise<UserTimezoneRecord | null> {
  if (!userId || !Number.isFinite(userId)) {
    return null;
  }

  return prisma.usuario.findUnique({
    where: { id: userId },
    select: { id: true, zonaHoraria: true },
  });
}

async function getBranchTimezoneRecord(sucursalId: number | null | undefined): Promise<BranchTimezoneRecord | null> {
  if (typeof sucursalId === "number" && sucursalId > 0) {
    const branch = await prisma.configuracion.findUnique({
      where: { sucursalId },
      select: { sucursalId: true, zonaHoraria: true },
    });

    if (branch) {
      return branch;
    }
  }

  const fallbackBranch = await prisma.sucursal.findFirst({
    where: { activa: true },
    orderBy: [{ esPrincipal: "desc" }, { id: "asc" }],
    select: {
      id: true,
      configuracion: {
        select: { zonaHoraria: true },
      },
    },
  });

  if (!fallbackBranch) {
    return null;
  }

  return {
    sucursalId: fallbackBranch.id,
    zonaHoraria: fallbackBranch.configuracion?.zonaHoraria ?? null,
  };
}

function logFallbackTimezone(resolved: ResolvedTimezone) {
  console.warn(
    `[timezone] Usando fallback tecnico para userId=${resolved.userId ?? "null"} sucursalId=${resolved.sucursalId ?? "null"}`,
  );
}

const defaultResolverDeps: TimezoneResolverDeps = {
  getUserTimezoneRecord,
  getBranchTimezoneRecord,
  logFallbackTimezone,
};

export async function resolveTimezoneWithDeps(
  input: ResolveTimezoneInput,
  deps: TimezoneResolverDeps = defaultResolverDeps,
): Promise<ResolvedTimezone> {
  const userId = input.userId ?? null;
  const requestedSucursalId = input.sucursalId ?? null;

  const [userRecord, branchRecord] = await Promise.all([
    deps.getUserTimezoneRecord(userId),
    deps.getBranchTimezoneRecord(requestedSucursalId),
  ]);

  const zonaHorariaUsuario = isValidTimezone(userRecord?.zonaHoraria)
    ? userRecord.zonaHoraria
    : null;
  const zonaHorariaSucursal = isValidTimezone(branchRecord?.zonaHoraria)
    ? branchRecord.zonaHoraria
    : null;
  const resolvedSucursalId = branchRecord?.sucursalId ?? null;

  if (zonaHorariaUsuario) {
    return {
      tz: zonaHorariaUsuario,
      source: "user",
      userId: userRecord?.id ?? userId,
      sucursalId: resolvedSucursalId,
      zonaHorariaUsuario,
      zonaHorariaSucursal,
    };
  }

  if (zonaHorariaSucursal) {
    return {
      tz: zonaHorariaSucursal,
      source: "branch",
      userId: userRecord?.id ?? userId,
      sucursalId: resolvedSucursalId,
      zonaHorariaUsuario,
      zonaHorariaSucursal,
    };
  }

  const resolved: ResolvedTimezone = {
    tz: TECHNICAL_FALLBACK_TZ,
    source: "fallback",
    userId: userRecord?.id ?? userId,
    sucursalId: resolvedSucursalId,
    zonaHorariaUsuario,
    zonaHorariaSucursal,
  };

  deps.logFallbackTimezone?.(resolved);

  return resolved;
}

export async function resolveTimezone(input: ResolveTimezoneInput): Promise<ResolvedTimezone> {
  return resolveTimezoneWithDeps(input);
}

export async function resolveTimezoneForAuth(auth: AuthTimezoneInput): Promise<ResolvedTimezone> {
  const userId = Number(auth.user.sub);

  return resolveTimezone({
    userId: Number.isFinite(userId) ? userId : null,
    sucursalId: auth.activeSucursalId,
  });
}

const getConfiguredTzCached = unstable_cache(
  async (sucursalId: number): Promise<string> => {
    const resolved = await resolveTimezone({ sucursalId });
    return resolved.tz;
  },
  ["configured-tz"],
  { revalidate: 60, tags: ["config"] },
);

export async function getConfiguredTz(sucursalId: number): Promise<string> {
  return getConfiguredTzCached(sucursalId);
}
