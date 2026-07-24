"use client";

// src/app/ver/inventario/[id]/page.tsx
import { useEffect, useState, use } from "react";
import { useSearchParams } from "next/navigation";
import { Boxes } from "lucide-react";
import { apiService } from "@/lib/apiService";
import { ReportLoadingPage } from "@/components/reports/report-loading-page";
import { useReportPdfNavigation } from "@/hooks/useReportPdfNavigation";

export default function InventarioLoadingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const searchParams = useSearchParams();
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [linkError, setLinkError] = useState<string | null>(null);
  const sucursalLabel = id === "0" ? "Vista General" : `Sucursal ${id}`;

  // El diálogo de exportación (opciones conCostos/conValuacion/soloConStock)
  // navega acá con esos params en la URL: es una acción autenticada en la
  // misma sesión, no necesita el sistema de links compartibles (ese además
  // cachea el link por sucursal sin distinguir las opciones elegidas). En
  // ese caso se pide el PDF directo. Sin esos params (ej. entrando desde un
  // link corto /x/[code] compartido) se usa el flujo normal de link firmado.
  const directOptions = ["conCostos", "conValuacion", "soloConStock"].some(
    (k) => searchParams.has(k),
  );

  useEffect(() => {
    if (directOptions) {
      setPdfUrl(`/ver/inventario/${id}/pdf?${searchParams.toString()}`);
      return;
    }

    let mounted = true;
    apiService
      .getInventarioPdfUrl(id)
      .then((url) => {
        if (mounted && url) setPdfUrl(url);
      })
      .catch(() => {
        if (mounted)
          setLinkError(
            "No se pudo generar el reporte de inventario. Intentá nuevamente.",
          );
      });
    return () => {
      mounted = false;
    };
  }, [id, directOptions, searchParams]);

  const fetchError = useReportPdfNavigation(pdfUrl);

  return (
    <ReportLoadingPage
      title="Generando Inventario"
      subtitle={sucursalLabel}
      Icon={Boxes}
      errorTitle="Error al generar inventario"
      errorMessage={linkError ?? fetchError}
    />
  );
}
