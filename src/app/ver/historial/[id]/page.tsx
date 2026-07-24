"use client";

// src/app/ver/historial/[id]/page.tsx
import { use } from "react";
import { useSearchParams } from "next/navigation";
import { FileText } from "lucide-react";
import { ReportLoadingPage } from "@/components/reports/report-loading-page";
import { useReportPdfNavigation } from "@/hooks/useReportPdfNavigation";

const MONTH_LABELS = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
];

export default function HistorialLoadingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const searchParams = useSearchParams();
  const anio = searchParams.get("anio") || String(new Date().getFullYear());
  const code = searchParams.get("code");
  const mes = Number.parseInt(id, 10);
  const mesLabel = MONTH_LABELS[mes] ?? `Mes ${id}`;

  const pdfUrl = code
    ? `/ver/historial/${id}/pdf?anio=${anio}&code=${code}`
    : null;
  const fetchError = useReportPdfNavigation(pdfUrl);

  return (
    <ReportLoadingPage
      title="Generando Auditoría"
      subtitle={`${mesLabel} · Período ${anio}`}
      Icon={FileText}
      errorTitle="Error de Auditoría"
      errorMessage={
        fetchError ?? (code ? null : "Acceso no autorizado o enlace inválido.")
      }
    />
  );
}
