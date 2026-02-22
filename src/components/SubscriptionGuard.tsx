"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

interface SubscriptionResponse {
    hasSubscription: boolean;
    subscription?: {
        id: string;
        status: string;
    };
}

export function SubscriptionGuard({ children }: { children: React.ReactNode }) {
    const [loading, setLoading] = useState(true);
    const [hasSubscription, setHasSubscription] = useState<boolean | null>(null);
    const pathname = usePathname();
    const router = useRouter();

    useEffect(() => {
        async function checkSubscription() {
            // Si ya está en la página de suscripciones o en el login, no hace falta checkear/redireccionar
            if (pathname === "/settings/subscriptions" || pathname === "/login") {
                setLoading(false);
                return;
            }

            try {
                const res = await fetch("/api/subscriptions/current", { cache: "no-store" });
                if (res.ok) {
                    const data: SubscriptionResponse = await res.json();
                    setHasSubscription(data.hasSubscription);

                    if (!data.hasSubscription) {
                        router.push("/settings/subscriptions");
                    }
                }
            } catch (error) {
                console.error("Error checking subscription:", error);
            } finally {
                setLoading(false);
            }
        }

        checkSubscription();
    }, [pathname, router]);

    // Mientras carga o si no tiene suscripción y no está en la página permitida, mostramos un loader
    // para evitar que se vea el contenido protegido por un instante.
    if (loading || (hasSubscription === false && pathname !== "/settings/subscriptions")) {
        return (
            <div className="flex h-screen w-full items-center justify-center bg-background/50 backdrop-blur-sm">
                <div className="flex flex-col items-center gap-4">
                    <Loader2 className="h-10 w-10 animate-spin text-primary" />
                    <p className="text-sm font-medium text-muted-foreground animate-pulse">
                        Verificando acceso...
                    </p>
                </div>
            </div>
        );
    }

    return <>{children}</>;
}
