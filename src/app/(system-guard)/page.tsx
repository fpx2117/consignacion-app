import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { verifyUserJwt } from "@/lib/auth/core";
import { prisma } from "@/lib/prisma";
import { getTiendaGlobalConfig } from "@/lib/storefront/tienda-global";

export const dynamic = "force-dynamic";

async function getPublicCatalogRedirect() {
  const { modoUnificado } = await getTiendaGlobalConfig();

  if (modoUnificado) {
    const principal = await prisma.sucursal.findFirst({ where: { esPrincipal: true }, select: { id: true } });
    const config = await prisma.configuracion.findUnique({
      where: { sucursalId: principal?.id ?? 1 },
      select: { mostrarListaPrecios: true },
    });
    return config?.mostrarListaPrecios ? "/lista" : null;
  }

  // Modo "por sucursal": redirige a la primera sucursal que optó in y ya definió su slug.
  const config = await prisma.configuracion.findFirst({
    where: { mostrarListaPrecios: true, mostrarEnTiendaOnline: true, tiendaSlug: { not: null } },
    select: { tiendaSlug: true },
    orderBy: { sucursalId: "asc" },
  });

  return config?.tiendaSlug ? `/${config.tiendaSlug}` : null;
}

export default async function Home() {
  const cookieStore = await cookies();
  const cookieName = process.env.JWT_COOKIE_NAME || "access_token";
  const token = cookieStore.get(cookieName)?.value;

  if (!token) {
    const publicCatalogPath = await getPublicCatalogRedirect();
    if (publicCatalogPath) redirect(publicCatalogPath);

    redirect("/login");
  }

  try {
    await verifyUserJwt(token);
    redirect("/dashboard");
  } catch {
    const publicCatalogPath = await getPublicCatalogRedirect();
    if (publicCatalogPath) redirect(publicCatalogPath);

    redirect("/login");
  }
}
