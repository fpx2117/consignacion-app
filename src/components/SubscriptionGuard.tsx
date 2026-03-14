"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";

interface SubscriptionResponse {
    hasSubscription: boolean;
    subscription?: {
        id: string;
        status: string;
    };
}

const EXEMPT_PATHS = ["/settings/subscriptions", "/login"];
// TTL de 5 minutos para no re-verificar en cada navegación
const CACHE_TTL_MS = 5 * 60 * 1000;

let cachedResult: { hasSubscription: boolean; timestamp: number } | null = null;

export function SubscriptionGuard({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const router = useRouter();
    const checkedRef = useRef(false);

    useEffect(() => {
        if (EXEMPT_PATHS.includes(pathname)) return;

        // Si ya tenemos resultado reciente en caché, no bloqueamos ni re-verificamos
        const now = Date.now();
        if (cachedResult && now - cachedResult.timestamp < CACHE_TTL_MS) {
            if (!cachedResult.hasSubscription) {
                router.push("/settings/subscriptions");
            }
            return;
        }

        // Verificación en background — NO bloquea el render del contenido
        if (checkedRef.current) return;
        checkedRef.current = true;

        async function checkSubscription() {
            try {
                const res = await fetch("/api/subscriptions/current", { cache: "no-store" });
                if (res.ok) {
                    const data: SubscriptionResponse = await res.json();
                    cachedResult = { hasSubscription: data.hasSubscription, timestamp: Date.now() };

                    if (!data.hasSubscription) {
                        router.push("/settings/subscriptions");
                    }
                }
            } catch {
                // Silently ignore — no interrumpir la experiencia por un error de red
            } finally {
                checkedRef.current = false;
            }
        }

        checkSubscription();
    }, [pathname, router]);

    // ✅ Render inmediato — sin spinner bloqueante. La verificación es en background.
    return <>{children}</>;
}
