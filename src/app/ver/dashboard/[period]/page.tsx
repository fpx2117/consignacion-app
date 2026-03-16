"use client";

// src/app/ver/dashboard/[period]/page.tsx
import { useEffect, use } from "react";
import { useSearchParams } from "next/navigation";
import { BarChart3 } from "lucide-react";
import { ReportLoadingPage } from "@/components/report-loading-page";

const PERIOD_LABELS: Record<string, string> = {
  today: "Hoy",
  week: "Esta semana",
  month: "Este mes",
  all: "Histórico",
};

export default function DashboardReporteLoadingPage({
  params,
}: {
  params: Promise<{ period: string }>;
}) {
  const { period } = use(params);
  const searchParams = useSearchParams();
  const code = searchParams.get("code");
  const sucursalId = searchParams.get("sucursalId") || "1";
  const label = PERIOD_LABELS[period] ?? period;

  useEffect(() => {
    if (!code) return;
    const timer = setTimeout(() => {
      window.location.replace(`/ver/dashboard/${period}/pdf?code=${code}&sucursalId=${sucursalId}`);
    }, 1200);
    return () => clearTimeout(timer);
  }, [period, code, sucursalId]);

  return (
    <ReportLoadingPage
      title="Generando Reporte"
      subtitle={`Dashboard · ${label}`}
      Icon={BarChart3}
      errorMessage={code ? null : "Acceso no autorizado o enlace inválido."}
    />
  );
}
