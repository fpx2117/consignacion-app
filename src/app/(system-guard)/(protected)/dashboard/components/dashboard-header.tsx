"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  RefreshCw, LayoutDashboard, CalendarDays, Filter,
  Download, FileText, Loader2, ChevronDown, ShoppingCart, Handshake,
} from "lucide-react";
import { DashboardPeriod, DashboardFilter } from "@/lib/types";
import { apiService } from "@/lib/apiService";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface DashboardHeaderProps {
  period: DashboardPeriod;
  setPeriod: (v: DashboardPeriod) => void;
  filter: DashboardFilter;
  setFilter: (v: DashboardFilter) => void;
  refresh: () => void;
  loading: boolean;
}

const PERIOD_LABELS: Record<DashboardPeriod, string> = {
  today: "Hoy",
  week: "Esta semana",
  month: "Este mes",
  all: "Histórico",
};

type ReportType = "pos" | "consignacion";
type DownloadKey = `${ReportType}-${DashboardPeriod}`;

export function DashboardHeader({
  period,
  setPeriod,
  filter,
  setFilter,
  refresh,
  loading,
}: DashboardHeaderProps) {
  const [downloading, setDownloading] = useState<DownloadKey | null>(null);

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Buenos días";
    if (hour < 18) return "Buenas tardes";
    return "Buenas noches";
  };

  const handleDownload = async (type: ReportType, targetPeriod: DashboardPeriod) => {
    const key: DownloadKey = `${type}-${targetPeriod}`;
    if (downloading) return;
    setDownloading(key);
    try {
      const url = type === "pos"
        ? await apiService.getPosReporteUrl(targetPeriod)
        : await apiService.getConsigReporteUrl(targetPeriod);
      window.open(url, "_blank");
    } catch {
      // silently ignore — /x/ will show error state
    } finally {
      setDownloading(null);
    }
  };

  const isDownloading = (type: ReportType, p: DashboardPeriod) => downloading === `${type}-${p}`;

  return (
    <div className="relative flex flex-col gap-8 pb-4 sm:flex-row sm:items-end sm:justify-between">
      {/* Lado Izquierdo */}
      <motion.div
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        className="space-y-2"
      >
        <div className="flex items-center gap-2">
          <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-primary/10 text-primary ring-1 ring-primary/20">
            <LayoutDashboard className="h-3.5 w-3.5" />
          </div>
          <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground/80">
            {getGreeting()}
          </span>
        </div>
        <div>
          <h1 className="text-4xl font-black tracking-tight text-foreground md:text-5xl lg:text-6xl">
            Dashboard
          </h1>
          <p className="text-base font-medium text-muted-foreground/60 max-w-md mt-1 leading-relaxed">
            Visión general del rendimiento y estado operativo.
          </p>
        </div>
      </motion.div>

      {/* Lado Derecho: Controles */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col gap-3 sm:flex-row sm:items-center bg-card/40 p-1.5 rounded-2xl border border-border/50 backdrop-blur-xl shadow-sm"
      >
        {/* FILTRO */}
        <div className="relative group min-w-[160px]">
          <div className="absolute left-3 top-1/2 -translate-y-1/2 z-10 pointer-events-none text-muted-foreground/50 group-hover:text-primary transition-colors">
            <Filter className="h-3.5 w-3.5" />
          </div>
          <Select value={filter} onValueChange={(v) => setFilter(v as DashboardFilter)}>
            <SelectTrigger className="h-10 w-full pl-9 bg-transparent border-none hover:bg-black/5 dark:hover:bg-white/5 transition-all rounded-xl focus:ring-0">
              <SelectValue placeholder="Filtrar por..." />
            </SelectTrigger>
            <SelectContent className="rounded-xl border-none shadow-xl backdrop-blur-xl bg-white/90 dark:bg-black/90 ring-1 ring-black/5">
              <SelectItem value="all">Vista General</SelectItem>
              <SelectItem value="consignacion">Consignaciones</SelectItem>
              <SelectItem value="pos">Ventas (POS)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="h-6 w-[1px] bg-border hidden sm:block" />

        {/* PERÍODO */}
        <div className="relative group min-w-[160px]">
          <div className="absolute left-3 top-1/2 -translate-y-1/2 z-10 pointer-events-none text-muted-foreground/50 group-hover:text-primary transition-colors">
            <CalendarDays className="h-3.5 w-3.5" />
          </div>
          <Select value={period} onValueChange={(v) => setPeriod(v as DashboardPeriod)}>
            <SelectTrigger className="h-10 w-full pl-9 bg-transparent border-none hover:bg-black/5 dark:hover:bg-white/5 transition-all rounded-xl focus:ring-0">
              <SelectValue placeholder="Período" />
            </SelectTrigger>
            <SelectContent className="rounded-xl border-none shadow-xl backdrop-blur-xl bg-white/90 dark:bg-black/90 ring-1 ring-black/5">
              <SelectItem value="today">Hoy</SelectItem>
              <SelectItem value="week">Esta semana</SelectItem>
              <SelectItem value="month">Este mes</SelectItem>
              <SelectItem value="all">Histórico</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="h-6 w-[1px] bg-border hidden sm:block" />

        {/* ACCIONES MÓVILES / DESKTOP */}
        <div className="flex w-full sm:w-auto items-center gap-2">
          {/* DESCARGAR — dividido en POS y CONSIGNACIÓN */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                disabled={!!downloading}
                className={cn(
                  "flex-1 sm:flex-none h-10 px-3 rounded-xl hover:bg-primary/10 hover:text-primary transition-all gap-1.5 bg-black/5 dark:bg-white/5 sm:bg-transparent",
                  downloading && "opacity-80"
                )}
              >
                {downloading ? (
                  <Loader2 className="h-4 w-4 animate-spin shrink-0" />
                ) : (
                  <Download className="h-4 w-4 shrink-0" />
                )}
                <span className="text-xs font-semibold">
                  {downloading ? "Generando..." : "Reportes"}
                </span>
                <ChevronDown className="h-3 w-3 opacity-60 ml-auto sm:ml-0 shrink-0" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              className="w-60 rounded-xl border-none shadow-xl backdrop-blur-xl bg-white/95 dark:bg-zinc-900/95 ring-1 ring-black/5"
            >
              {/* ━━ POS ━━ */}
              <DropdownMenuLabel className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-sky-600 px-3 py-2">
                <ShoppingCart className="h-3 w-3" /> Ventas · POS
              </DropdownMenuLabel>
              {(["today", "week", "month", "all"] as DashboardPeriod[]).map((p) => (
                <DropdownMenuItem
                  key={`pos-${p}`}
                  onClick={() => handleDownload("pos", p)}
                  disabled={!!downloading}
                  className={cn(
                    "flex items-center gap-2.5 rounded-lg mx-1 cursor-pointer transition-colors",
                    p === period && "bg-sky-50 dark:bg-sky-950/30 text-sky-700 font-semibold"
                  )}
                >
                  <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  <span className="text-sm">{PERIOD_LABELS[p]}</span>
                  {isDownloading("pos", p) && <Loader2 className="h-3 w-3 animate-spin ml-auto" />}
                  {p === period && !isDownloading("pos", p) && (
                    <span className="ml-auto text-[9px] font-bold uppercase tracking-wide text-sky-600 opacity-70">Actual</span>
                  )}
                </DropdownMenuItem>
              ))}

              <DropdownMenuSeparator className="my-1" />

              {/* ━━ CONSIGNACIÓN ━━ */}
              <DropdownMenuLabel className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-indigo-600 px-3 py-2">
                <Handshake className="h-3 w-3" /> Consignaciones
              </DropdownMenuLabel>
              {(["today", "week", "month", "all"] as DashboardPeriod[]).map((p) => (
                <DropdownMenuItem
                  key={`consig-${p}`}
                  onClick={() => handleDownload("consignacion", p)}
                  disabled={!!downloading}
                  className={cn(
                    "flex items-center gap-2.5 rounded-lg mx-1 cursor-pointer transition-colors",
                    p === period && "bg-indigo-50 dark:bg-indigo-950/30 text-indigo-700 font-semibold"
                  )}
                >
                  <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  <span className="text-sm">{PERIOD_LABELS[p]}</span>
                  {isDownloading("consignacion", p) && <Loader2 className="h-3 w-3 animate-spin ml-auto" />}
                  {p === period && !isDownloading("consignacion", p) && (
                    <span className="ml-auto text-[9px] font-bold uppercase tracking-wide text-indigo-600 opacity-70">Actual</span>
                  )}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          <div className="h-6 w-[1px] bg-border hidden sm:block" />

          {/* REFRESH */}
          <Button
            variant="ghost"
            size="sm"
            onClick={refresh}
            disabled={loading}
            className={cn(
              "flex-1 sm:flex-none h-10 px-4 rounded-xl hover:bg-primary/10 hover:text-primary transition-all gap-2 bg-black/5 dark:bg-white/5 sm:bg-transparent",
              loading && "opacity-80"
            )}
          >
            <RefreshCw className={cn("h-4 w-4 shrink-0", loading ? "animate-spin" : "")} />
            <span className="text-xs font-semibold sm:hidden">Actualizar</span>
          </Button>
        </div>
      </motion.div>
    </div>
  );
}