"use client";

// src/app/ver/consig/[period]/page.tsx
import { use } from "react";
import { useSearchParams } from "next/navigation";
import { Handshake } from "lucide-react";
import { ReportLoadingPage } from "@/components/reports/report-loading-page";
import { useReportPdfNavigation } from "@/hooks/useReportPdfNavigation";

const PERIOD_LABELS: Record<string, string> = {
  today: "Hoy",
  week: "Esta semana",
  month: "Este mes",
  all: "Histórico",
  custom: "Rango personalizado",
};

export default function ConsigReporteLoadingPage({
  params,
}: {
  params: Promise<{ period: string }>;
}) {
  const { period } = use(params);
  const searchParams = useSearchParams();
  const code = searchParams.get("code");
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const label =
    period === "custom" && from && to
      ? `${from.split("-").reverse().join("/")} al ${to.split("-").reverse().join("/")}`
      : (PERIOD_LABELS[period] ?? period);

  const pdfUrl = code
    ? `/ver/consig/${period}/pdf?${searchParams.toString()}`
    : null;
  const fetchError = useReportPdfNavigation(pdfUrl);

  return (
    <ReportLoadingPage
      title="Generando Reporte"
      subtitle={`Consignaciones · ${label}`}
      Icon={Handshake}
      errorMessage={
        fetchError ?? (code ? null : "Acceso no autorizado o enlace inválido.")
      }
    />
  );
}
