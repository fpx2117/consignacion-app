import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { SidebarDock } from "@/components/sidebar-dock";

async function checkAuth() {
  const cookieHeader = (await headers()).get("cookie") ?? "";

  try {
    const res = await fetch("/api/auth/me", {
      method: "GET",
      cache: "no-store",
      headers: { cookie: cookieHeader },
    });

    if (!res.ok) return false;

    const json = await res.json();
    return Boolean(json?.data?.id); // tu endpoint responde { data: user }
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
    <div className="min-h-screen bg-background">
      <SidebarDock />
      <main className="min-h-screen p-4 pb-24 md:p-6 md:pb-6 md:ml-[84px]">
        {children}
      </main>
    </div>
  );
}
