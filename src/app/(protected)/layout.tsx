import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { SidebarDock } from "@/components/sidebar-dock";
import { SubscriptionGuard } from "@/components/SubscriptionGuard";

export const dynamic = "force-dynamic";

async function checkAuth() {
  const h = await headers();

  const cookieHeader = h.get("cookie") ?? "";

  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "https";

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
  const ok = await checkAuth();

  if (!ok) redirect("/login");

  return (
    <div className="min-h-screen bg-background text-foreground transition-colors duration-300">
      <SubscriptionGuard>
        <SidebarDock />
        <main className="min-h-screen p-4 pb-24 md:p-6 md:pb-6 md:ml-[84px] relative z-0">
          {children}
        </main>
      </SubscriptionGuard>
    </div>
  );
}
