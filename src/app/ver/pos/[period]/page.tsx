/* eslint-disable */
// @ts-nocheck
"use client";
import { useEffect, useState, use } from "react";
import { Loader2, AlertCircle, ShoppingCart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSearchParams } from "next/navigation";

const PERIOD_LABELS: Record<string, string> = { today: "Hoy", week: "Esta semana", month: "Este mes", all: "Historico" };

export default function PosReporteLoadingPage({ params }: { params: Promise<{ period: string }> }) {
    const { period } = use(params);
    const searchParams = useSearchParams();
    const code = searchParams.get("code");
    const sucursalId = searchParams.get("sucursalId") || "1";
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!code) { setError("Acceso no autorizado o enlace invalido."); return; }
        const t = setTimeout(() => window.location.replace(`/ver/pos/${period}/pdf?code=${code}&sucursalId=${sucursalId}`), 1200);
        return () => clearTimeout(t);
    }, [period, code, sucursalId]);

    if (error) return (
        <div className="h-screen w-full flex flex-col items-center justify-center bg-rose-50 dark:bg-zinc-950 p-6 text-center">
            <div className="p-4 rounded-3xl bg-white dark:bg-zinc-900 shadow-2xl border border-rose-100">
                <AlertCircle className="h-10 w-10 text-rose-500 mb-2 mx-auto" />
                <h1 className="text-lg font-black text-slate-800 uppercase">Error de acceso</h1>
                <p className="text-xs text-slate-500 mt-1 max-w-[200px] mx-auto">{error}</p>
                <Button onClick={() => window.close()} variant="outline" className="mt-4 w-full rounded-xl font-bold uppercase text-[10px]">Cerrar</Button>
            </div>
        </div>
    );

    return (
        <div className="h-screen w-full flex flex-col items-center justify-center bg-zinc-50 dark:bg-zinc-950 gap-6">
            <div className="relative">
                <div className="p-6 rounded-[2.5rem] bg-white dark:bg-zinc-900 shadow-[0_20px_50px_rgba(2,132,199,0.15)] ring-1 ring-zinc-200 dark:ring-zinc-800">
                    <Loader2 className="h-12 w-12 text-sky-600 animate-spin stroke-[3px]" />
                </div>
                <div className="absolute -bottom-2 -right-2 p-2 bg-sky-600 rounded-2xl shadow-lg border-4 border-zinc-50 dark:border-zinc-950">
                    <ShoppingCart className="h-4 w-4 text-white" />
                </div>
            </div>
            <div className="text-center space-y-2">
                <h1 className="text-xl font-black text-zinc-800 dark:text-zinc-100 uppercase tracking-tighter">Generando Reporte POS</h1>
                <p className="text-[10px] text-zinc-400 font-black uppercase tracking-[0.3em] animate-pulse">Ventas Directas · {PERIOD_LABELS[period] ?? period}</p>
            </div>
        </div>
    );
}
