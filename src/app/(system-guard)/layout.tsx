import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function SystemGuardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    // Check if the system is initialized (at least one user exists)
    const userCount = await prisma.usuario.count();

    if (userCount === 0) {
        // System not initialized, redirect to setup
        redirect("/setup");
    }

    return <>{children}</>;
}
