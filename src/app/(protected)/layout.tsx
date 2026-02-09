import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { SidebarDock } from "@/components/sidebar-dock";

function normalizeBaseUrl(raw?: string) {
  if (!raw) return "http://localhost:3000";
  // Si ya tiene protocolo, ok
  if (raw.startsWith("http://") || raw.startsWith("https://")) return raw;
  // Si viene sin protocolo (caso Railway), asumimos https
  return `https://${raw}`;
}

async function checkAuth() {
  const cookieStore = await cookies();
  const cookieHeader = cookieStore
    .getAll()
    .map((c) => `${c.name}=${c.value}`)
    .join("; ");

  const baseUrl = normalizeBaseUrl(process.env.NEXT_PUBLIC_BASE_URL);

  try {
    const res = await fetch(`${baseUrl}/api/auth/me`, {
      method: "GET",
      cache: "no-store",
      headers: { cookie: cookieHeader },
    });

    return res.ok;
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
