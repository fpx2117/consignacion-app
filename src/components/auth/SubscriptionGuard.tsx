"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useBroadcastChannel } from "@/hooks/useBroadcastChannel";
import type { PlanLimits } from "@/lib/subscriptions/require-subscription";

const EXEMPT_PATHS = ["/settings/subscriptions", "/login"];

interface SubscriptionGuardProps {
  planLimits: PlanLimits | null;
  children: React.ReactNode;
}

export function SubscriptionGuard({ planLimits, children }: SubscriptionGuardProps) {
  const pathname = usePathname();
  const router = useRouter();

  // Escuchar cambios de plan en otras pestañas → refrescar layout
  useBroadcastChannel({
    "plan-changed": () => router.refresh(),
  });

  useEffect(() => {
    if (EXEMPT_PATHS.some((p) => pathname.startsWith(p))) return;
    if (!planLimits) {
      router.push("/settings/subscriptions");
    }
  }, [planLimits, pathname, router]);

  return <>{children}</>;
}
