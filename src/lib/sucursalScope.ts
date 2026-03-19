type SucursalAuthUser = {
  rol?: string | null;
  sucursalId?: number | null;
};

export type SucursalAuthContext = {
  user?: SucursalAuthUser | null;
  activeSucursalId?: number | null;
  allowedSucursalIds?: number[] | null;
};

type ResolveEffectiveSucursalInput = {
  user: SucursalAuthUser;
  allowedSucursalIds: number[];
  cookieSucursalId?: string | null;
  jwtSucursalId?: number | null;
  clientRequestedSucursalId?: string | number | null;
};

type ResolvedSucursalContext = {
  activeSucursalId: number;
  allowedSucursalIds: number[];
  ignoredClientSucursalId: number | null;
  isGlobalView: boolean;
  source: "cookie" | "jwt" | "default";
};

function parseSucursalId(value: string | number | null | undefined): number | null {
  if (typeof value === "number") {
    return Number.isInteger(value) && value >= 0 ? value : null;
  }

  if (typeof value !== "string") return null;

  const trimmed = value.trim();
  if (!trimmed) return null;

  const parsed = Number(trimmed);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : null;
}

function normalizeAllowedSucursalIds(ids: number[]): number[] {
  return Array.from(new Set(ids.filter((id) => Number.isInteger(id) && id > 0))).sort((a, b) => a - b);
}

function canUseGlobalView(user: SucursalAuthUser, sucursalId: number | null): boolean {
  return user.rol === "ADMIN" && sucursalId === 0;
}

export function canAccessSucursalId(auth: SucursalAuthContext, sucursalId: number): boolean {
  if (!Number.isInteger(sucursalId) || sucursalId < 0) return false;
  if (canUseGlobalView(auth.user ?? {}, sucursalId)) return true;
  return (auth.allowedSucursalIds ?? []).includes(sucursalId);
}

export function resolveEffectiveSucursalContext(
  input: ResolveEffectiveSucursalInput,
): ResolvedSucursalContext | null {
  const allowedSucursalIds = normalizeAllowedSucursalIds(input.allowedSucursalIds);
  if (allowedSucursalIds.length === 0) return null;

  const ignoredClientSucursalId = parseSucursalId(input.clientRequestedSucursalId);
  const cookieSucursalId = parseSucursalId(input.cookieSucursalId);
  const jwtSucursalId = parseSucursalId(input.jwtSucursalId);

  if (canUseGlobalView(input.user, cookieSucursalId)) {
    return {
      activeSucursalId: 0,
      allowedSucursalIds,
      ignoredClientSucursalId,
      isGlobalView: true,
      source: "cookie",
    };
  }

  if (cookieSucursalId !== null && allowedSucursalIds.includes(cookieSucursalId)) {
    return {
      activeSucursalId: cookieSucursalId,
      allowedSucursalIds,
      ignoredClientSucursalId,
      isGlobalView: false,
      source: "cookie",
    };
  }

  if (jwtSucursalId !== null && allowedSucursalIds.includes(jwtSucursalId)) {
    return {
      activeSucursalId: jwtSucursalId,
      allowedSucursalIds,
      ignoredClientSucursalId,
      isGlobalView: false,
      source: "jwt",
    };
  }

  return {
    activeSucursalId: allowedSucursalIds[0],
    allowedSucursalIds,
    ignoredClientSucursalId,
    isGlobalView: false,
    source: "default",
  };
}

export function resolveRequestedSucursalId(
  auth: SucursalAuthContext,
  requestedSucursalId?: string | number | null,
): number {
  const parsedRequestedSucursalId = parseSucursalId(requestedSucursalId);
  if (parsedRequestedSucursalId === null) {
    return typeof auth.activeSucursalId === "number" ? auth.activeSucursalId : 0;
  }

  if (canAccessSucursalId(auth, parsedRequestedSucursalId)) {
    return parsedRequestedSucursalId;
  }

  return typeof auth.activeSucursalId === "number" ? auth.activeSucursalId : 0;
}

export function isGlobalSucursalView(auth: SucursalAuthContext): boolean {
  return canUseGlobalView(auth?.user ?? {}, auth?.activeSucursalId ?? null);
}

export function buildSucursalWhere(auth: SucursalAuthContext): { sucursalId?: number } {
  if (isGlobalSucursalView(auth)) return {};
  const sucursalId = auth.activeSucursalId;
  return typeof sucursalId === "number" ? { sucursalId } : {};
}

export function canAccessSucursalResource(
  auth: SucursalAuthContext,
  resourceSucursalId: number | null | undefined
): boolean {
  if (isGlobalSucursalView(auth)) return true;
  return resourceSucursalId === auth?.activeSucursalId;
}
