// Rutas reservadas por segmentos reales de src/app (más genéricos comunes),
// para evitar que un tiendaSlug choque con una ruta existente del sitio.
export const RESERVED_SLUGS = [
  "lista",
  "login",
  "forgot-password",
  "reset-password",
  "clientes",
  "consignaciones",
  "pedidos-esperados",
  "productos",
  "settings",
  "dashboard",
  "gastos",
  "proveedores",
  "setup",
  "api",
  "admin",
  "static",
  "public",
  "favicon",
  "robots",
  "sitemap",
  "_next",
] as const;

const SLUG_FORMAT = /^[a-z0-9](?:[a-z0-9-]{1,38}[a-z0-9])?$/;

export function isValidSlugFormat(slug: string): boolean {
  return SLUG_FORMAT.test(slug);
}

export function isReservedSlug(slug: string): boolean {
  return (RESERVED_SLUGS as readonly string[]).includes(slug.toLowerCase());
}

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export type SlugValidationError = "empty" | "invalid-format" | "reserved";

export function validateSlug(
  rawSlug: string,
): { ok: true; slug: string } | { ok: false; error: SlugValidationError } {
  const slug = slugify(rawSlug);
  if (!slug) return { ok: false, error: "empty" };
  if (!isValidSlugFormat(slug)) return { ok: false, error: "invalid-format" };
  if (isReservedSlug(slug)) return { ok: false, error: "reserved" };
  return { ok: true, slug };
}
