"use client";

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import { Loader2, AlertCircle } from "lucide-react";
import { apiService } from "@/lib/apiService";
import { Button } from "@/components/ui/button";

// Tipado para Next.js 15
type Params = Promise<{ id: string }>;
type SearchParams = Promise<{ [key: string]: string | string[] | undefined }>;

export default function TicketLoadingPage(props: { params: Params, searchParams: SearchParams }) {
  const { id } = use(props.params);
  const searchParams = use(props.searchParams);

  const mode = (searchParams.mode as "view" | "whatsapp") || "view";
  const phone = searchParams.phone as string | undefined;
  const name = searchParams.name as string | undefined;

  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    const processAction = async () => {
      try {
        // 1. Conseguimos la URL del PDF
        const pdfUrl = await apiService.getVentaPdfUrl(Number(id));

        if (!mounted) return;
        if (!pdfUrl) throw new Error("No se pudo generar el ticket.");

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

          // Conseguir la configuración para los mensajes
          const config = await apiService.getConfiguracionGeneral();

          // Usar 'mensajeWhatsappVenta' específicamente
          let template = config?.mensajeWhatsappVenta ||
            `*AllData POS - Ticket*\n\n` +
            `Hola {name}.\n` +
            `📄 Ticket digital: {url}\n\n` +
            `¡Gracias por tu compra!`;

          // Reemplazo de variables
          const message = template
            .replace(/{name}/g, name || 'Cliente')
            .replace(/{url}/g, pdfUrl);

          // Limpiamos el teléfono
          const cleanPhone = phone.replace(/\D/g, "");
          const waUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;

          window.location.replace(waUrl);
        }

      } catch (err: any) {
        if (mounted) {
          setError(err.message || "No se pudo procesar la solicitud.");
        }
      }
    };

    if (id) {
      processAction();
    }

    return () => { mounted = false; };
  }, [id, mode, phone, name]);

  if (!error) {
    return (
      <div className="h-screen w-full flex flex-col items-center justify-center bg-zinc-50 dark:bg-zinc-900 gap-4">
        <div className="p-4 rounded-full bg-white dark:bg-zinc-800 shadow-xl ring-1 ring-zinc-200 dark:ring-zinc-700">
          <Loader2 className="h-10 w-10 text-indigo-600 animate-spin" />
        </div>
        <div className="text-center space-y-1">
          <h1 className="text-lg font-bold text-zinc-800 dark:text-zinc-100">
            {mode === 'whatsapp' ? 'Abriendo WhatsApp...' : 'Generando Ticket...'}
          </h1>
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