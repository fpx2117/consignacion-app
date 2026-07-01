"use client";

// src/app/ver/inventario/[id]/page.tsx
import { useEffect, useState, use } from "react";
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
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [linkError, setLinkError] = useState<string | null>(null);
  const sucursalLabel = id === "0" ? "Vista General" : `Sucursal ${id}`;

  useEffect(() => {
    let mounted = true;
    apiService.getInventarioPdfUrl(id)
      .then((url) => {
        if (mounted && url) setPdfUrl(url);
      })
      .catch(() => {
        if (mounted) setLinkError("No se pudo generar el reporte de inventario. Intentá nuevamente.");
      });
    return () => { mounted = false; };
  }, [id]);

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
