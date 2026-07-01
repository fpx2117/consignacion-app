"use client";

// src/app/ver/consig/[period]/page.tsx
import { useEffect, use } from "react";
import { useSearchParams } from "next/navigation";
import { Handshake } from "lucide-react";
import { ReportLoadingPage } from "@/components/reports/report-loading-page";

const PERIOD_LABELS: Record<string, string> = {
  today: "Hoy",
  week: "Esta semana",
  month: "Este mes",
  all: "Histórico",
};

export default function ConsigReporteLoadingPage({
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
      window.location.replace(`/ver/consig/${period}/pdf?code=${code}&sucursalId=${sucursalId}`);
    }, 1200);
    return () => clearTimeout(timer);
  }, [period, code, sucursalId]);

  return (
    <ReportLoadingPage
      title="Generando Reporte"
      subtitle={`Consignaciones · ${label}`}
      Icon={Handshake}
      errorMessage={code ? null : "Acceso no autorizado o enlace inválido."}
    />
  );
}
