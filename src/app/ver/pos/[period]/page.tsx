"use client";

// src/app/ver/pos/[period]/page.tsx
import { use } from "react";
import { useSearchParams } from "next/navigation";
import { ShoppingCart } from "lucide-react";
import { ReportLoadingPage } from "@/components/reports/report-loading-page";
import { useReportPdfNavigation } from "@/hooks/useReportPdfNavigation";

const PERIOD_LABELS: Record<string, string> = {
  today: "Hoy",
  week: "Esta semana",
  month: "Este mes",
  all: "Histórico",
};

export default function PosReporteLoadingPage({
  params,
}: {
  params: Promise<{ period: string }>;
}) {
  const { period } = use(params);
  const searchParams = useSearchParams();
  const code = searchParams.get("code");
  const sucursalId = searchParams.get("sucursalId") || "1";
  const label = PERIOD_LABELS[period] ?? period;

  const pdfUrl = code
    ? `/ver/pos/${period}/pdf?code=${code}&sucursalId=${sucursalId}`
    : null;
  const fetchError = useReportPdfNavigation(pdfUrl);

  return (
    <ReportLoadingPage
      title="Generando Reporte POS"
      subtitle={`Ventas Directas · ${label}`}
      Icon={ShoppingCart}
      errorMessage={
        fetchError ?? (code ? null : "Acceso no autorizado o enlace inválido.")
      }
    />
  );
}
