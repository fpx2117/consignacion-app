type SucursalAuthContext = {
  user?: { rol?: string | null } | null;
  activeSucursalId?: number | null;
};

export function isGlobalSucursalView(auth: SucursalAuthContext): boolean {
  return auth?.user?.rol === "ADMIN" && auth?.activeSucursalId === 0;
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
