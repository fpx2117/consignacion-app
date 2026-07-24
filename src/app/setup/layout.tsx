import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function SetupGuardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Check if the system is already initialized
  const userCount = await prisma.usuario.count();

  if (userCount > 0) {
    // System already initialized, redirect to home
    redirect("/");
  }

  return <>{children}</>;
}
