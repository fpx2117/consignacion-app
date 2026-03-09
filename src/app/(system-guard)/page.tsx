import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { verifyUserJwt } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function Home() {
  const cookieStore = await cookies();
  const cookieName = process.env.JWT_COOKIE_NAME || "access_token";
  const token = cookieStore.get(cookieName)?.value;

  if (!token) {
    const publicCatalogConfig = await prisma.configuracion.findFirst({
      where: { mostrarListaPrecios: true },
      select: { sucursalId: true, separarListaPorSucursal: true },
      orderBy: { sucursalId: "asc" },
    });

    if (publicCatalogConfig) {
      const query = publicCatalogConfig.separarListaPorSucursal
        ? `?sucursalId=${publicCatalogConfig.sucursalId}`
        : "";
      redirect(`/lista${query}`);
    }

    redirect("/login");
  }

  try {
    await verifyUserJwt(token);
    redirect("/dashboard");
  } catch {
    redirect("/login");
  }
}
