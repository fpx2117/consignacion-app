const ALLOWED_ROLES = new Set(["ADMIN", "EMPLEADO"]);

export function parsePositiveId(value: unknown): number | null {
  const id = typeof value === "number" ? value : Number(value);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

export function parseRequiredString(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized && normalized.length <= max ? normalized : null;
}

export function parseEmail(value: unknown): string | null {
  const email = parseRequiredString(value, 254)?.toLowerCase();
  return email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null;
}

export function isAllowedRole(value: unknown): value is "ADMIN" | "EMPLEADO" {
  return typeof value === "string" && ALLOWED_ROLES.has(value);
}
