import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { SidebarDock } from "@/components/sidebar-dock";

async function checkAuth() {
  const cookieStore = await cookies();
  const cookieHeader = cookieStore
    .getAll()
    .map((c) => `${c.name}=${c.value}`)
    .join("; ");

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000";

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

  if (!ok) {
    redirect("/login");
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Sidebar fijo (se convierte en Bottom Nav en móvil) */}
      <SidebarDock />

      {/* CORRECCIÓN AQUÍ:
         1. 'pb-24': Padding abajo en móvil para que el contenido no quede tapado por la barra de navegación.
         2. 'md:pb-0': En desktop quitamos el padding de abajo.
         3. 'md:ml-[84px]': El margen izquierdo SOLO se aplica en desktop (md en adelante).
      */}
      <main className="min-h-screen p-4 pb-24 md:p-6 md:pb-6 md:ml-[84px]">
        {children}
      </main>
    </div>
  );
}