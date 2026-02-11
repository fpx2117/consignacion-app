"use client";

import { useEffect, useState, use } from "react";
import { Loader2, AlertCircle } from "lucide-react";
import { apiService } from "@/lib/apiService"; 
import { Button } from "@/components/ui/button";

export default function InventarioLoadingPage({ params }: { params: Promise<{ id: string }> }) {
  // Desempaquetamos la promesa con el hook use() siguiendo tu ejemplo de ticket
  const { id } = use(params); 
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    const fetchPdf = async () => {
      try {
        // Obtenemos la URL corta del inventario (normalizada a /x/[code])
        const pdfUrl = await apiService.getInventarioPdfUrl();
        
        if (mounted && pdfUrl) {
           // Redirección externa al visor seguro
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
      <div className="h-screen w-full flex flex-col items-center justify-center bg-zinc-50 dark:bg-zinc-900 gap-4">
        <div className="p-4 rounded-full bg-white dark:bg-zinc-800 shadow-xl ring-1 ring-zinc-200 dark:ring-zinc-700">
           <Loader2 className="h-10 w-10 text-emerald-600 animate-spin" />
        </div>
        <div className="text-center space-y-1">
            <h1 className="text-lg font-bold text-zinc-800 dark:text-zinc-100">Generando Inventario...</h1>
            <p className="text-sm text-zinc-500">Por favor esperá un momento.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen w-full flex flex-col items-center justify-center bg-red-50 dark:bg-red-950/20 p-4 text-center gap-4">
      <div className="p-4 rounded-full bg-red-100 text-red-600 mb-2">
        <AlertCircle className="h-8 w-8" />
      </div>
      <h1 className="text-xl font-bold text-red-700 dark:text-red-400">Ocurrió un error</h1>
      <p className="text-sm text-red-600/80 max-w-xs mx-auto">{error}</p>
      <Button onClick={() => window.close()} variant="outline" className="mt-4 border-red-200 hover:bg-red-100 text-red-700">
        Cerrar ventana
      </Button>
    </div>
  );
}