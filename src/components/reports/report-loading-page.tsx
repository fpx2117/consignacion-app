"use client";

// src/components/report-loading-page.tsx
// Componente unificado de loading/error para todas las páginas de reportes PDF.

import { Loader2, AlertCircle, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ReportLoadingPageProps {
  /** Título principal en estado de carga (ej: "Generando Reporte POS") */
  title: string;
  /** Subtítulo en estado de carga (ej: "Ventas Directas · Este mes") */
  subtitle: string;
  /** Ícono secundario que aparece en la esquina del loader (ej: ShoppingCart) */
  Icon: LucideIcon;
  /** Título del error (ej: "Error de acceso") — default: "Error de acceso" */
  errorTitle?: string;
  /** Mensaje de error a mostrar */
  errorMessage?: string | null;
}

export function ReportLoadingPage({
  title,
  subtitle,
  Icon,
  errorTitle = "Error de acceso",
  errorMessage,
}: ReportLoadingPageProps) {
  if (errorMessage) {
    return (
      <div className="h-screen w-full flex flex-col items-center justify-center bg-rose-50 dark:bg-background p-6 text-center">
        <div className="p-5 rounded-3xl bg-card shadow-2xl border border-rose-100 dark:border-rose-900/30 flex flex-col items-center gap-3 max-w-xs w-full">
          <div className="p-3 rounded-2xl bg-rose-100 dark:bg-rose-900/20">
            <AlertCircle className="h-8 w-8 text-rose-500" />
          </div>
          <div>
            <h1 className="text-base font-black text-foreground uppercase tracking-tight">
              {errorTitle}
            </h1>
            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
              {errorMessage}
            </p>
          </div>
          <Button
            onClick={() => window.close()}
            variant="outline"
            className="w-full rounded-xl font-bold uppercase text-[10px] border-rose-200 hover:bg-rose-50 dark:border-rose-800"
          >
            Cerrar ventana
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen w-full flex flex-col items-center justify-center bg-muted/40 dark:bg-background gap-6">
      {/* Loader con ícono de reporte en esquina */}
      <div className="relative">
        <div className="p-6 rounded-[2.5rem] bg-card shadow-[0_20px_50px_rgba(0,0,0,0.08)] dark:shadow-none ring-1 ring-border">
          <Loader2 className="h-12 w-12 text-primary animate-spin stroke-[2.5px]" />
        </div>
        <div className="absolute -bottom-2 -right-2 p-2 bg-primary rounded-2xl shadow-lg border-4 border-background">
          <Icon className="h-4 w-4 text-primary-foreground" />
        </div>
      </div>

      {/* Texto */}
      <div className="text-center space-y-2">
        <h1 className="text-xl font-black text-foreground uppercase tracking-tighter">
          {title}
        </h1>
        <p className="text-[10px] text-muted-foreground/80 font-black uppercase tracking-[0.3em] animate-pulse">
          {subtitle}
        </p>
      </div>
    </div>
  );
}
