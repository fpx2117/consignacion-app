import * as React from "react";
import { Suspense } from "react";
import { Metadata } from "next";
import { Store } from "lucide-react";

import { Skeleton } from "@/components/ui/skeleton";
import BranchesClient from "./branches-client";
import { requireAuth } from "@/lib/auth/require-auth";
import { checkFeature } from "@/lib/subscriptions/require-subscription";
import { redirect } from "next/navigation";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { TutorialButton } from "@/components/ui/tutorial-button";
import { BRANCHES_TUTORIAL } from "@/lib/tutorial-content";

export const metadata: Metadata = {
  title: "Sucursales",
  description: "Administrá los puntos de venta y depósitos",
};

export default async function BranchesPage() {
  const auth = await requireAuth();
  if (!auth.ok) return redirect("/login");

  if (auth.user.rol !== "ADMIN") {
    return redirect("/unauthorized");
  }

  const featureCheck = await checkFeature("sucursales");

  return (
    <div className="max-w-5xl mx-auto space-y-8 p-4 md:p-10">
      <header className="space-y-3">
        <div className="flex items-center gap-2 text-[color:var(--status-success-strong)] font-semibold tracking-wider text-[10px] bg-[color:var(--status-success-strong)]/10 w-fit px-3 py-1 rounded-full border border-[color:var(--status-success-strong)]/20">
          <Store className="h-3 w-3" />
          SUCURSALES Y DEPÓSITOS
        </div>
        <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight">
          Gestión de Sucursales
        </h1>
        <TutorialButton steps={BRANCHES_TUTORIAL} />
        <p className="text-sm text-muted-foreground max-w-2xl">
          Administrá tus diferentes puntos de venta, controlá qué empleados
          tienen acceso a cada uno y gestioná el stock y precios de forma
          independiente.
        </p>
      </header>

      {!featureCheck.allowed ? (
        <Alert
          variant="destructive"
          className="bg-destructive/10 border-destructive/20 text-destructive"
        >
          <AlertTitle className="text-lg font-bold flex items-center gap-2">
            Función no disponible
          </AlertTitle>
          <AlertDescription className="text-sm text-destructive/90 select-text">
            {featureCheck.message} Para habilitar la gestión de múltiples
            sucursales necesitas hacer un upgrade a tu plan actual.
          </AlertDescription>
        </Alert>
      ) : (
        <Suspense
          fallback={<Skeleton className="h-[400px] w-full rounded-2xl" />}
        >
          <BranchesClient />
        </Suspense>
      )}
    </div>
  );
}
