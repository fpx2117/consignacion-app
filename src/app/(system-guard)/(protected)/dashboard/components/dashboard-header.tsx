"use client";

import { useEffect, useState } from "react";
import type { DateRange } from "react-day-picker";
import { es } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
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
  RefreshCw,
  LayoutDashboard,
  CalendarDays,
  Filter,
  Download,
  FileText,
  Loader2,
  ChevronDown,
  ShoppingCart,
  Handshake,
} from "lucide-react";
import type {
  DashboardPeriod,
  DashboardFilter,
  DashboardDateRange,
} from "@/lib/types";
import { apiService } from "@/lib/apiService";
import { motion } from "motion/react";
import { cn } from "@/lib/utils";

interface DashboardHeaderProps {
  period: DashboardPeriod;
  setPeriod: (v: DashboardPeriod) => void;
  dateRange: DashboardDateRange;
  setDateRange: (v: DashboardDateRange) => void;
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
  custom: "Rango personalizado",
};

const REPORT_PERIODS: DashboardPeriod[] = [
  "today",
  "week",
  "month",
  "all",
  "custom",
];

function inputDateToLocal(value: string): Date {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function localDateToInput(value: Date): string {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatRange(range: DashboardDateRange): string {
  const format = (value: string) => {
    const [year, month, day] = value.split("-");
    return `${day}/${month}/${year}`;
  };
  return `${format(range.from)} - ${format(range.to)}`;
}

type ReportType = "pos" | "consignacion";
type DownloadKey = `${ReportType}-${DashboardPeriod}`;

export function DashboardHeader({
  period,
  setPeriod,
  dateRange,
  setDateRange,
  filter,
  setFilter,
  refresh,
  loading,
}: DashboardHeaderProps) {
  const [downloading, setDownloading] = useState<DownloadKey | null>(null);
  const [greeting, setGreeting] = useState("Bienvenido");
  const [rangeOpen, setRangeOpen] = useState(false);
  const [draftRange, setDraftRange] = useState<DateRange>({
    from: inputDateToLocal(dateRange.from),
    to: inputDateToLocal(dateRange.to),
  });

  useEffect(() => {
    setDraftRange({
      from: inputDateToLocal(dateRange.from),
      to: inputDateToLocal(dateRange.to),
    });
  }, [dateRange]);

  const getGreetingByHour = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Buenos días";
    if (hour < 18) return "Buenas tardes";
    return "Buenas noches";
  };

  useEffect(() => {
    setGreeting(getGreetingByHour());
  }, []);

  const handleDownload = async (
    type: ReportType,
    targetPeriod: DashboardPeriod,
  ) => {
    const key: DownloadKey = `${type}-${targetPeriod}`;
    if (downloading) return;
    setDownloading(key);
    // Abrir la ventana sincrónicamente para que los navegadores móviles
    // la consideren parte del gesto del usuario (evita el bloqueo de popups).
    const newWindow = window.open("", "_blank");
    try {
      const url =
        type === "pos"
          ? await apiService.getPosReporteUrl(
              targetPeriod,
              targetPeriod === "custom" ? dateRange : undefined,
            )
          : await apiService.getConsigReporteUrl(
              targetPeriod,
              targetPeriod === "custom" ? dateRange : undefined,
            );
      if (newWindow) {
        newWindow.location.href = url;
      } else {
        window.location.assign(url);
      }
    } catch {
      newWindow?.close();
    } finally {
      setDownloading(null);
    }
  };

  const isDownloading = (type: ReportType, p: DashboardPeriod) =>
    downloading === `${type}-${p}`;

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
            {greeting}
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
        className="flex flex-col gap-3 bg-card/40 p-1.5 rounded-2xl border border-border/50 backdrop-blur-xl shadow-sm sm:flex-row sm:flex-wrap sm:items-center lg:flex-nowrap"
      >
        {/* FILTRO */}
        <div className="relative group min-w-[160px]">
          <div className="absolute left-3 top-1/2 -translate-y-1/2 z-10 pointer-events-none text-muted-foreground/50 group-hover:text-primary transition-colors">
            <Filter className="h-3.5 w-3.5" />
          </div>
          <Select
            value={filter}
            onValueChange={(v) => setFilter(v as DashboardFilter)}
          >
            <SelectTrigger className="h-10 w-full pl-9 bg-transparent border-none hover:bg-muted/45 transition-all rounded-xl focus:ring-0">
              <SelectValue placeholder="Filtrar por..." />
            </SelectTrigger>
            <SelectContent className="rounded-xl border border-border/70 shadow-2xl backdrop-blur-xl bg-popover/95 text-popover-foreground ring-1 ring-black/10 dark:ring-white/10">
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
          <Select
            value={period}
            onValueChange={(v) => setPeriod(v as DashboardPeriod)}
          >
            <SelectTrigger className="h-10 w-full pl-9 bg-transparent border-none hover:bg-muted/45 transition-all rounded-xl focus:ring-0">
              <SelectValue placeholder="Período" />
            </SelectTrigger>
            <SelectContent className="rounded-xl border border-border/70 shadow-2xl backdrop-blur-xl bg-popover/95 text-popover-foreground ring-1 ring-black/10 dark:ring-white/10">
              <SelectItem value="today">Hoy</SelectItem>
              <SelectItem value="week">Esta semana</SelectItem>
              <SelectItem value="month">Este mes</SelectItem>
              <SelectItem value="all">Histórico</SelectItem>
              <SelectItem value="custom">Rango personalizado</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {period === "custom" && (
          <>
            <div className="h-6 w-[1px] bg-border hidden sm:block" />
            <Popover open={rangeOpen} onOpenChange={setRangeOpen}>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  className="h-10 min-w-[210px] justify-start rounded-xl px-3 text-xs font-semibold hover:bg-muted/45"
                  aria-label={`Cambiar rango de fechas. Seleccion actual: ${formatRange(dateRange)}`}
                >
                  <CalendarDays className="mr-2 h-3.5 w-3.5 text-primary" />
                  {formatRange(dateRange)}
                </Button>
              </PopoverTrigger>
              <PopoverContent
                align="end"
                className="w-auto max-w-[calc(100vw-2rem)] rounded-2xl p-0 shadow-2xl"
              >
                <div className="border-b px-4 py-3">
                  <p className="text-sm font-bold">Rango del reporte</p>
                  <p className="text-xs text-muted-foreground">
                    Selecciona hasta 366 dias. Ambas fechas estan incluidas.
                  </p>
                </div>
                <Calendar
                  mode="range"
                  locale={es}
                  selected={draftRange}
                  onSelect={(nextRange) =>
                    setDraftRange(
                      nextRange ?? { from: undefined, to: undefined },
                    )
                  }
                  defaultMonth={draftRange.from}
                  captionLayout="dropdown"
                  max={365}
                  required={false}
                />
                <div className="flex items-center justify-between gap-3 border-t p-3">
                  <span className="text-[11px] text-muted-foreground">
                    {draftRange.from && draftRange.to
                      ? `${localDateToInput(draftRange.from)} / ${localDateToInput(draftRange.to)}`
                      : "Seleccion incompleta"}
                  </span>
                  <Button
                    type="button"
                    size="sm"
                    disabled={!draftRange.from || !draftRange.to}
                    onClick={() => {
                      if (!draftRange.from || !draftRange.to) return;
                      setDateRange({
                        from: localDateToInput(draftRange.from),
                        to: localDateToInput(draftRange.to),
                      });
                      setRangeOpen(false);
                    }}
                    className="rounded-lg"
                  >
                    Aplicar rango
                  </Button>
                </div>
              </PopoverContent>
            </Popover>
          </>
        )}

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
                  "flex-1 sm:flex-none h-10 px-3 rounded-xl hover:bg-primary/10 hover:text-primary transition-all gap-1.5 bg-foreground/5 dark:bg-card/5 sm:bg-transparent",
                  downloading && "opacity-80",
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
              className="w-60 rounded-xl border-none shadow-xl backdrop-blur-xl bg-card/95 dark:bg-card/95 ring-1 ring-black/5"
            >
              {/* ━━ POS ━━ */}
              <DropdownMenuLabel className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-[color:var(--theme-ocean-primary)] px-3 py-2">
                <ShoppingCart className="h-3 w-3" /> Ventas · POS
              </DropdownMenuLabel>
              {REPORT_PERIODS.map((p) => (
                <DropdownMenuItem
                  key={`pos-${p}`}
                  onClick={() => handleDownload("pos", p)}
                  disabled={!!downloading}
                  className={cn(
                    "flex items-center gap-2.5 rounded-lg mx-1 cursor-pointer transition-colors",
                    p === period &&
                      "bg-[color:var(--theme-ocean-primary)] dark:bg-[color:var(--theme-ocean-primary)]/30 text-[color:var(--theme-ocean-primary)] font-semibold",
                  )}
                >
                  <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  <span className="text-sm">
                    {p === "custom" ? formatRange(dateRange) : PERIOD_LABELS[p]}
                  </span>
                  {isDownloading("pos", p) && (
                    <Loader2 className="h-3 w-3 animate-spin ml-auto" />
                  )}
                  {p === period && !isDownloading("pos", p) && (
                    <span className="ml-auto text-[9px] font-bold uppercase tracking-wide text-[color:var(--theme-ocean-primary)] opacity-70">
                      Actual
                    </span>
                  )}
                </DropdownMenuItem>
              ))}

              <DropdownMenuSeparator className="my-1" />

              {/* ━━ CONSIGNACIÓN ━━ */}
              <DropdownMenuLabel className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-[color:var(--primary)] px-3 py-2">
                <Handshake className="h-3 w-3" /> Consignaciones
              </DropdownMenuLabel>
              {REPORT_PERIODS.map((p) => (
                <DropdownMenuItem
                  key={`consig-${p}`}
                  onClick={() => handleDownload("consignacion", p)}
                  disabled={!!downloading}
                  className={cn(
                    "flex items-center gap-2.5 rounded-lg mx-1 cursor-pointer transition-colors",
                    p === period &&
                      "bg-[color:var(--primary)] dark:bg-[color:var(--primary)]/30 text-[color:var(--primary)] font-semibold",
                  )}
                >
                  <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  <span className="text-sm">
                    {p === "custom" ? formatRange(dateRange) : PERIOD_LABELS[p]}
                  </span>
                  {isDownloading("consignacion", p) && (
                    <Loader2 className="h-3 w-3 animate-spin ml-auto" />
                  )}
                  {p === period && !isDownloading("consignacion", p) && (
                    <span className="ml-auto text-[9px] font-bold uppercase tracking-wide text-[color:var(--primary)] opacity-70">
                      Actual
                    </span>
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
              "flex-1 sm:flex-none h-10 px-4 rounded-xl hover:bg-primary/10 hover:text-primary transition-all gap-2 bg-foreground/5 dark:bg-card/5 sm:bg-transparent",
              loading && "opacity-80",
            )}
          >
            <RefreshCw
              className={cn("h-4 w-4 shrink-0", loading ? "animate-spin" : "")}
            />
            <span className="text-xs font-semibold sm:hidden">Actualizar</span>
          </Button>
        </div>
      </motion.div>
    </div>
  );
}
