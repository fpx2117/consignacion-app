"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

export function SetupGuard({ children }: { children: React.ReactNode }) {
    const [checking, setChecking] = useState(true);
    const [isInitialized, setIsInitialized] = useState<boolean | null>(null);
    const pathname = usePathname();
    const router = useRouter();

    useEffect(() => {
        async function checkSetup() {
            // Don't check if already on setup or an API route
            if (pathname === "/setup" || pathname.startsWith("/api")) {
                setChecking(false);
                return;
            }

            try {
                const res = await fetch("/api/setup/status", { cache: "no-store" });
                if (res.ok) {
                    const data = await res.json();
                    setIsInitialized(data.initialized);

                    if (data.initialized === false) {
                        router.push("/setup");
                    }
                }
            } catch (error) {
                console.error("Error checking setup status:", error);
            } finally {
                setChecking(false);
            }
        }

        checkSetup();
    }, [pathname, router]);

    // Prevent flash of content if redirected
    if (checking || (isInitialized === false && pathname !== "/setup")) {
        return (
            <div className="flex h-screen w-full items-center justify-center bg-background">
                <div className="flex flex-col items-center gap-4">
                    <Loader2 className="h-10 w-10 animate-spin text-primary" />
                    <p className="text-sm font-medium text-muted-foreground animate-pulse">
                        Preparando sistema...
                    </p>
                </div>
            </div>
        );
    }

    return <>{children}</>;
}
