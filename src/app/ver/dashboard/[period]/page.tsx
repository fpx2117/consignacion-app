/* eslint-disable */
// @ts-nocheck
"use client";

// src/app/ver/dashboard/[period]/page.tsx
import { useEffect, useState, use } from "react";
import { Loader2, AlertCircle, BarChart3, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSearchParams } from "next/navigation";

const PERIOD_LABELS: Record<string, string> = {
    today: "Hoy",
    week: "Esta semana",
    month: "Este mes",
    all: "Histórico",
};

export default function DashboardReporteLoadingPage({
    params,
}: {
    params: Promise<{ period: string }>;
}) {
    const { period } = use(params);
    const searchParams = useSearchParams();
    const code = searchParams.get("code");
    const sucursalId = searchParams.get("sucursalId") || "1";
    const [error, setError] = useState<string | null>(null);

    const label = PERIOD_LABELS[period] ?? period;

    useEffect(() => {
        if (!code) {
            setError("Acceso no autorizado o enlace inválido.");
            return;
        }

        const timer = setTimeout(() => {
            window.location.replace(`/ver/dashboard/${period}/pdf?code=${code}&sucursalId=${sucursalId}`);
        }, 1200);

        return () => clearTimeout(timer);
    }, [period, code, sucursalId]);

    if (error) {
        return (
            <div className="h-screen w-full flex flex-col items-center justify-center bg-rose-50 dark:bg-background p-6 text-center">
                <div className="p-4 rounded-3xl bg-card dark:bg-card shadow-2xl border border-rose-100 dark:border-rose-900/30">
                    <AlertCircle className="h-10 w-10 text-rose-500 mb-2 mx-auto" />
                    <h1 className="text-lg font-black text-foreground dark:text-foreground uppercase">Error de acceso</h1>
                    <p className="text-xs text-muted-foreground mt-1 max-w-[200px] mx-auto">{error}</p>
                    <Button onClick={() => window.close()} variant="outline" className="mt-4 w-full rounded-xl font-bold uppercase text-[10px]">
                        Cerrar
                    </Button>
                </div>
            </div>
        );
    }

    return (
        <div className="h-screen w-full flex flex-col items-center justify-center bg-muted/40 dark:bg-background gap-6">
            <div className="relative">
                <div className="p-6 rounded-[2.5rem] bg-card dark:bg-card shadow-[0_20px_50px_rgba(79,70,229,0.15)] dark:shadow-none ring-1 ring-border dark:ring-border">
                    <Loader2 className="h-12 w-12 text-[color:var(--primary)] animate-spin stroke-[3px]" />
                </div>
                <div className="absolute -bottom-2 -right-2 p-2 bg-[color:var(--primary)] rounded-2xl shadow-lg border-4 border-background dark:border-background">
                    <BarChart3 className="h-4 w-4 text-[color:var(--ui-fx-white)]" />
                </div>
            </div>
            <div className="text-center space-y-2">
                <h1 className="text-xl font-black text-foreground dark:text-foreground uppercase tracking-tighter">
                    Generando Reporte
                </h1>
                <p className="text-[10px] text-muted-foreground/80 font-black uppercase tracking-[0.3em] animate-pulse">
                    Dashboard · {label}
                </p>
            </div>
        </div>
    );
}
