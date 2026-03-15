"use client";

import { useEffect, useState, use } from "react";
import { Loader2, AlertCircle } from "lucide-react";
import { apiService } from "@/lib/apiService";
import { Button } from "@/components/ui/button";

// Tipado para Next.js 15
type Params = Promise<{ id: string }>;
type SearchParams = Promise<{ [key: string]: string | string[] | undefined }>;

export default function ConsignacionLoadingPage(props: { params: Params, searchParams: SearchParams }) {
  // Desempaquetamos Params y SearchParams
  const { id } = use(props.params);
  const searchParams = use(props.searchParams);

  const rawMode = searchParams.mode;
  const mode: "view" | "whatsapp" = rawMode === "whatsapp" ? "whatsapp" : "view";
  const phone = searchParams.phone as string | undefined;
  const name = searchParams.name as string | undefined;

  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    const processAction = async () => {
      try {
        // 1. Conseguimos la URL del PDF
        const pdfUrl = await apiService.getConsignacionPdfUrl(Number(id));

        if (!mounted) return;
        if (!pdfUrl) throw new Error("URL vacía");

        // CASO A: Solo VER
        if (mode === "view") {
          window.location.replace(pdfUrl);
          return;
        }

        // CASO B: WHATSAPP
        if (mode === "whatsapp") {
          if (!phone) {
            setError("Falta el teléfono del cliente para enviar WhatsApp.");
            return;
          }

          // Conseguir el mensaje personalizado
          const configRes = await fetch("/api/settings/general", { cache: "no-store" });
          const configData = await configRes.json();
          const config = configData?.data ?? configData;

          // Mensaje por defecto si no hay uno personalizado
          const template = config?.mensajeWhatsappConsignacion ||
            `*AllData POS - Remito*\n\n` +
            `Hola {name}.\n` +
            `📄 Remito: {url}\n\n` +
            `⏳ Válido 7 días • Máx 3 vistas`;

          // Reemplazo de variables
          const message = template
            .replace(/{name}/g, name || 'Cliente')
            .replace(/{url}/g, pdfUrl);

          // Limpiamos el teléfono
          const cleanPhone = phone.replace(/\D/g, "");
          const waUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;

          window.location.replace(waUrl);
        }

      } catch (err) {
        if (mounted) {
          const message = err instanceof Error ? err.message : "No se pudo procesar la solicitud.";
          setError(message);
        }
      }
    };

    if (id) {
      processAction();
    }

    return () => { mounted = false; };
  }, [id, mode, phone, name]);

  // --- UI DE CARGA ---
  if (!error) {
    return (
      <div className="h-screen w-full flex flex-col items-center justify-center bg-muted/40 dark:bg-card gap-4">
        <div className="p-4 rounded-full bg-card dark:bg-muted shadow-xl ring-1 ring-border dark:ring-border">
          <Loader2 className="h-10 w-10 text-[color:var(--status-success-strong)] animate-spin" />
        </div>
        <div className="text-center space-y-1">
          <h1 className="text-lg font-bold text-foreground dark:text-foreground">
            {mode === 'whatsapp' ? 'Abriendo WhatsApp...' : 'Generando Remito...'}
          </h1>
          <p className="text-sm text-muted-foreground">Un momento por favor.</p>
        </div>
      </div>
    );
  }

  // --- UI DE ERROR ---
  return (
    <div className="h-screen w-full flex flex-col items-center justify-center bg-[color:var(--status-danger)] dark:bg-[color:var(--status-danger)]/20 p-4 text-center gap-4">
      <div className="p-4 rounded-full bg-[color:var(--status-danger)] text-[color:var(--status-danger)] mb-2">
        <AlertCircle className="h-8 w-8" />
      </div>
      <h1 className="text-xl font-bold text-[color:var(--status-danger)] dark:text-[color:var(--status-danger)]">Error</h1>
      <p className="text-sm text-[color:var(--status-danger)]/80 max-w-xs mx-auto">{error}</p>
      <Button onClick={() => window.close()} variant="outline" className="mt-4 border-[color:var(--status-danger)] hover:bg-[color:var(--status-danger)] text-[color:var(--status-danger)]">
        Cerrar ventana
      </Button>
    </div>
  );
}