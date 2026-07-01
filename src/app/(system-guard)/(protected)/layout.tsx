import { redirect } from "next/navigation";
import { requireAuth } from "@/lib/auth/require-auth";
import { prisma } from "@/lib/prisma";
import { SidebarDock, type SidebarUserData } from "@/components/layout/sidebar-dock";
import { SubscriptionGuard } from "@/components/auth/SubscriptionGuard";
import { TopBar } from "@/components/layout/top-bar";
import { GlobalReadonlyGuard } from "@/components/auth/global-readonly-guard";
import { SocketProvider } from "@/providers/socket-provider";
import { SocketToaster } from "@/providers/socket-toaster";
import { getActivePlanLimits } from "@/lib/subscriptions/require-subscription";

async function getSidebarUserData(): Promise<SidebarUserData | null> {
  const auth = await requireAuth();
  if (!auth.ok) return null;

  const userId = Number(auth.user.sub);
  if (!userId) return null;

  const user = await prisma.usuario.findUnique({
    where: { id: userId },
    select: {
      rol: true,
      activo: true,
      sucursalId: true,
    },
  });

  if (!user || !user.activo) return null;

  const sucursalesPermitidas =
    user.rol === "ADMIN"
      ? await prisma.sucursal.findMany({
          where: { activa: true },
          select: { id: true, nombre: true, esPrincipal: true, activa: true },
          orderBy: { id: "asc" },
        })
      : await prisma.sucursal.findMany({
          where: { id: user.sucursalId || 1 },
          select: { id: true, nombre: true, esPrincipal: true, activa: true },
        });

  const planLimits = await getActivePlanLimits();

  return {
    rol: user.rol,
    sucursalesPermitidas,
    allowConsignaciones: planLimits?.allowConsignaciones !== false,
    activeSucursalId: auth.activeSucursalId,
    planLimits,
  };
}

export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const userData = await getSidebarUserData();
  if (!userData) redirect("/login");

  return (
    <SocketProvider>
      <SocketToaster />
      <div className="min-h-screen bg-background text-foreground transition-colors duration-300 relative overflow-hidden">
        <div className="fixed inset-0 -z-10 h-full w-full [background:radial-gradient(125%_125%_at_50%_10%,var(--background)_42%,oklch(0.58_0.2_295)_100%)] dark:[background:radial-gradient(125%_125%_at_50%_10%,#000_42%,#63e_100%)] opacity-[0.13] pointer-events-none" />

        <SubscriptionGuard planLimits={userData.planLimits}>
          <GlobalReadonlyGuard />
          <SidebarDock initialUserData={userData} />
          <TopBar />
          <main className="min-h-screen p-4 pt-24 pb-24 md:ml-[84px] md:p-8 md:pt-24 md:pb-6 relative z-0">
            {children}
          </main>
        </SubscriptionGuard>
      </div>
    </SocketProvider>
  );
}
