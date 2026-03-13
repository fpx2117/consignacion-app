/* eslint-disable */
// @ts-nocheck
"use client";

import { useEffect, useState, use } from "react";
import { Loader2, AlertCircle, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSearchParams, useRouter } from "next/navigation";

export default function HistorialLoadingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params); 
  const searchParams = useSearchParams();
  const router = useRouter();

  // Obtenemos parámetros de la URL
  const anio = searchParams.get("anio") || "2026";
  const code = searchParams.get("code");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Si no hay código de acceso, es una entrada inválida
    if (!code) {
      setError("Acceso no autorizado o enlace inválido.");
      return;
    }

    // Pequeño delay para que la animación se aprecie y el navegador procese el hilo
    const timer = setTimeout(() => {
      // Redirigimos al route.ts que genera el binario real
      window.location.replace(`/ver/historial/${id}/pdf?anio=${anio}&code=${code}`);
    }, 1200);

    return () => clearTimeout(timer);
  }, [id, anio, code]);

  if (error) {
    return (
      <div className="h-screen w-full flex flex-col items-center justify-center bg-rose-50 dark:bg-background p-6 text-center">
        <div className="p-4 rounded-3xl bg-card dark:bg-card shadow-2xl border border-rose-100 dark:border-rose-900/30">
          <AlertCircle className="h-10 w-10 text-rose-500 mb-2 mx-auto" />
          <h1 className="text-lg font-black text-foreground dark:text-foreground uppercase">Error de Auditoría</h1>
          <p className="text-xs text-muted-foreground mt-1 max-w-[200px] mx-auto">{error}</p>
          <Button onClick={() => window.close()} variant="outline" className="mt-4 w-full rounded-xl font-bold uppercase text-[10px]">Cerrar</Button>
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
            <FileText className="h-4 w-4 text-[color:var(--ui-fx-white)]" />
        </div>
      </div>
      <div className="text-center space-y-2">
        <h1 className="text-xl font-black text-foreground dark:text-foreground uppercase tracking-tighter">Generando Auditoría</h1>
        <p className="text-[10px] text-muted-foreground/80 font-black uppercase tracking-[0.3em] animate-pulse">Mes ${id} • Periodo ${anio}</p>
      </div>
    </div>
  );
}