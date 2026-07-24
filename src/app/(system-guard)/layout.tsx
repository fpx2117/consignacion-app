import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { unstable_cache } from "next/cache";

export const dynamic = "force-dynamic";

const getUserCountCached = unstable_cache(
  async () => prisma.usuario.count(),
  ["system-user-count"],
  { revalidate: 300, tags: ["system-init"] },
);

export default async function SystemGuardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Check if the system is initialized (at least one user exists)
  const userCount = await getUserCountCached();

  if (userCount === 0) {
    // System not initialized, redirect to setup
    redirect("/setup");
  }

  return <>{children}</>;
}
