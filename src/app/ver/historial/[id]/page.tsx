"use client";

// src/app/ver/historial/[id]/page.tsx
import { useEffect, use } from "react";
import { useSearchParams } from "next/navigation";
import { FileText } from "lucide-react";
import { ReportLoadingPage } from "@/components/reports/report-loading-page";

const MONTH_LABELS = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
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

  useEffect(() => {
    if (!code) return;
    const timer = setTimeout(() => {
      window.location.replace(`/ver/historial/${id}/pdf?anio=${anio}&code=${code}`);
    }, 1200);
    return () => clearTimeout(timer);
  }, [id, anio, code]);

  return (
    <ReportLoadingPage
      title="Generando Auditoría"
      subtitle={`${mesLabel} · Período ${anio}`}
      Icon={FileText}
      errorTitle="Error de Auditoría"
      errorMessage={code ? null : "Acceso no autorizado o enlace inválido."}
    />
  );
}
