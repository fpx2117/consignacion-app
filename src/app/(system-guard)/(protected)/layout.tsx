import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { SidebarDock } from "@/components/sidebar-dock";
import { SubscriptionGuard } from "@/components/SubscriptionGuard";
import { TopBar } from "@/components/top-bar";
import { GlobalReadonlyGuard } from "@/components/global-readonly-guard";

export const dynamic = "force-dynamic";

async function triggerCheckVencidos(origin: string, cookieHeader: string) {
  try {
    await fetch(`${origin}/api/pedidos-esperados/check-vencidos`, {
      method: "POST",
      cache: "no-store",
      headers: { cookie: cookieHeader },
    });
  } catch {
    // fire-and-forget: no bloquea el render si falla
  }
}

async function checkAuth() {
  const h = await headers();

  const cookieHeader = h.get("cookie") ?? "";

  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? (host?.includes("localhost") ? "http" : "https");

  if (!host) {
    console.error("Error verificando auth: no se pudo determinar host");
    return false;
  }

  const origin = `${proto}://${host}`;

  try {
    const res = await fetch(`${origin}/api/auth/me`, {
      method: "GET",
      cache: "no-store",
      headers: { cookie: cookieHeader },
    });

    if (!res.ok) return false;

    // tu endpoint responde { data: user }
    const json = await res.json();
    return Boolean(json?.data?.id);
  } catch (error) {
    console.error("Error verificando auth:", error);
    return false;
  }
}

export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const h = await headers();
  const cookieHeader = h.get("cookie") ?? "";
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? (host?.includes("localhost") ? "http" : "https");
  const origin = host ? `${proto}://${host}` : "";

  const ok = await checkAuth();

  if (!ok) redirect("/login");

  // Check de pedidos vencidos: fire-and-forget, no bloquea el render
  if (origin) {
    triggerCheckVencidos(origin, cookieHeader).catch(() => {});
  }

  return (
    <div className="min-h-screen bg-background text-foreground transition-colors duration-300 relative overflow-hidden">
      {/* Global Obsidian/Violet Glow Background */}
      <div className="fixed inset-0 -z-10 h-full w-full [background:radial-gradient(125%_125%_at_50%_10%,var(--background)_42%,oklch(0.58_0.2_295)_100%)] dark:[background:radial-gradient(125%_125%_at_50%_10%,#000_42%,#63e_100%)] opacity-[0.13] pointer-events-none" />

      <SubscriptionGuard>
        <GlobalReadonlyGuard />
        <SidebarDock />
        <TopBar />
        {/* Agregamos pt-28 y md:pt-28 para que el main no quede oculto detrás del TopBar (h-20) */}
        <main className="min-h-screen pt-28 p-4 pb-24 md:p-8 md:pt-28 md:pb-6 md:ml-[84px] relative z-0">
          {children}
        </main>
      </SubscriptionGuard>
    </div>
  );
}
