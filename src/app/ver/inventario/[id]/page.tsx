"use client";

// src/app/ver/inventario/[id]/page.tsx
import { useEffect, useState, use } from "react";
import { Boxes } from "lucide-react";
import { apiService } from "@/lib/apiService";
import { ReportLoadingPage } from "@/components/report-loading-page";

export default function InventarioLoadingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [error, setError] = useState<string | null>(null);
  const sucursalLabel = id === "0" ? "Vista General" : `Sucursal ${id}`;

  useEffect(() => {
    let mounted = true;
    apiService.getInventarioPdfUrl(id)
      .then((pdfUrl) => {
        if (mounted && pdfUrl) window.location.replace(pdfUrl);
      })
      .catch(() => {
        if (mounted) setError("No se pudo generar el reporte de inventario. Intentá nuevamente.");
      });
    return () => { mounted = false; };
  }, [id]);

  return (
    <ReportLoadingPage
      title="Generando Inventario"
      subtitle={sucursalLabel}
      Icon={Boxes}
      errorTitle="Error al generar inventario"
      errorMessage={error}
    />
  );
}
