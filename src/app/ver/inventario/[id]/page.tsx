/* eslint-disable */
// @ts-nocheck

//src/app/ver/inventario/[id]/page.tsx
"use client";

import { useEffect, useState, use } from "react";
import { Loader2, AlertCircle } from "lucide-react";
import { apiService } from "@/lib/apiService";
import { Button } from "@/components/ui/button";

export default function InventarioLoadingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    const fetchPdf = async () => {
      try {
        // Pasamos el ID (sucursal) para obtener el link específico
        const pdfUrl = await apiService.getInventarioPdfUrl(id);

        if (mounted && pdfUrl) {
          window.location.replace(pdfUrl);
        }
      } catch (err) {
        if (mounted) {
          setError("No se pudo generar el reporte de inventario. Intentá nuevamente.");
        }
      }
    };

    fetchPdf();

    return () => { mounted = false; };
  }, [id]);

  if (!error) {
    return (
      <div className="h-screen w-full flex flex-col items-center justify-center bg-muted/40 dark:bg-card gap-4">
        <div className="p-4 rounded-full bg-card dark:bg-muted shadow-xl ring-1 ring-border dark:ring-border">
          <Loader2 className="h-10 w-10 text-[color:var(--status-success-strong)] animate-spin" />
        </div>
        <div className="text-center space-y-1">
          <h1 className="text-lg font-bold text-foreground dark:text-foreground">Generando Inventario...</h1>
          <p className="text-sm text-muted-foreground">Sucursal ID: {id === '0' ? 'General' : id}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen w-full flex flex-col items-center justify-center bg-[color:var(--status-danger)] dark:bg-[color:var(--status-danger)]/20 p-4 text-center gap-4">
      <div className="p-4 rounded-full bg-[color:var(--status-danger)] text-[color:var(--status-danger)] mb-2">
        <AlertCircle className="h-8 w-8" />
      </div>
      <h1 className="text-xl font-bold text-[color:var(--status-danger)] dark:text-[color:var(--status-danger)]">Ocurrió un error</h1>
      <p className="text-sm text-[color:var(--status-danger)]/80 max-max-w-xs mx-auto">{error}</p>
      <Button onClick={() => window.close()} variant="outline" className="mt-4 border-[color:var(--status-danger)] hover:bg-[color:var(--status-danger)] text-[color:var(--status-danger)]">
        Cerrar ventana
      </Button>
    </div>
  );
}