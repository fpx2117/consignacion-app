"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { X, Filter, Calendar, ChevronDown, Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface PedidosFiltersProps {
  estado: string;
  fechaDesde: string;
  fechaHasta: string;
  onEstadoChange: (v: string) => void;
  onFechaDesdeChange: (v: string) => void;
  onFechaHastaChange: (v: string) => void;
  onLimpiar: () => void;
}

const ESTADO_OPTIONS = [
  {
    value: "all",
    label: "Todos",
    dot: "bg-muted-foreground/60",
    active: "bg-muted text-foreground border-border",
    inactive: "bg-transparent text-muted-foreground border-border/40 hover:bg-muted/50",
    dropdownColor: "text-foreground",
  },
  {
    value: "pendientes",
    label: "Pendientes",
    dot: "bg-orange-500",
    active: "bg-orange-500/15 text-orange-700 border-orange-500/40 dark:text-orange-400",
    inactive: "bg-transparent text-muted-foreground border-border/40 hover:bg-orange-500/10 hover:text-orange-600",
    dropdownColor: "text-orange-600 dark:text-orange-400",
  },
  {
    value: "PROGRAMADO",
    label: "Programado",
    dot: "bg-[color:var(--theme-ocean-primary)]",
    active: "bg-[color:var(--theme-ocean-primary)]/15 text-[color:var(--theme-ocean-primary)] border-[color:var(--theme-ocean-primary)]/40",
    inactive: "bg-transparent text-muted-foreground border-border/40 hover:bg-[color:var(--theme-ocean-primary)]/10 hover:text-[color:var(--theme-ocean-primary)]",
    dropdownColor: "text-[color:var(--theme-ocean-primary)]",
  },
  {
    value: "VENCIDO",
    label: "Vencido",
    dot: "bg-[color:var(--status-danger)]",
    active: "bg-[color:var(--status-danger)]/15 text-[color:var(--status-danger)] border-[color:var(--status-danger)]/40",
    inactive: "bg-transparent text-muted-foreground border-border/40 hover:bg-[color:var(--status-danger)]/10 hover:text-[color:var(--status-danger)]",
    dropdownColor: "text-[color:var(--status-danger)]",
  },
  {
    value: "PARCIAL",
    label: "Parcial",
    dot: "bg-yellow-500",
    active: "bg-yellow-500/15 text-yellow-700 border-yellow-500/40 dark:text-yellow-400",
    inactive: "bg-transparent text-muted-foreground border-border/40 hover:bg-yellow-500/10 hover:text-yellow-600",
    dropdownColor: "text-yellow-600 dark:text-yellow-400",
  },
  {
    value: "CONFIRMADO",
    label: "Confirmado",
    dot: "bg-[color:var(--status-success-strong)]",
    active: "bg-[color:var(--status-success-strong)]/15 text-[color:var(--status-success-strong)] border-[color:var(--status-success-strong)]/40",
    inactive: "bg-transparent text-muted-foreground border-border/40 hover:bg-[color:var(--status-success-strong)]/10 hover:text-[color:var(--status-success-strong)]",
    dropdownColor: "text-[color:var(--status-success-strong)]",
  },
  {
    value: "POSTERGADO",
    label: "Postergado",
    dot: "bg-muted-foreground",
    active: "bg-muted text-foreground border-border",
    inactive: "bg-transparent text-muted-foreground border-border/40 hover:bg-muted/50",
    dropdownColor: "text-foreground",
  },
  {
    value: "CANCELADO",
    label: "Cancelado",
    dot: "bg-muted-foreground/50",
    active: "bg-muted/60 text-muted-foreground border-border/60",
    inactive: "bg-transparent text-muted-foreground/60 border-border/30 hover:bg-muted/40",
    dropdownColor: "text-muted-foreground",
  },
];

export function PedidosFilters({
  estado,
  fechaDesde,
  fechaHasta,
  onEstadoChange,
  onFechaDesdeChange,
  onFechaHastaChange,
  onLimpiar,
}: PedidosFiltersProps) {
  const hasAnyFilter = estado !== "all" || fechaDesde !== "" || fechaHasta !== "";
  const activeOption = ESTADO_OPTIONS.find((o) => o.value === estado) ?? ESTADO_OPTIONS[0];

  return (
    <div className="p-4 space-y-3">

      {/* ── Fila de estado ───────────────────────────────────────────────── */}
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1.5 text-muted-foreground shrink-0">
          <Filter className="h-3.5 w-3.5" />
          <span className="text-[10px] font-black uppercase tracking-widest">Estado</span>
        </div>

        {/* MOBILE: dropdown compacto */}
        <div className="sm:hidden flex-1">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className={cn(
                  "w-full inline-flex items-center justify-between gap-2 px-3 py-1.5 rounded-xl border text-xs font-bold transition-all duration-150",
                  activeOption.active
                )}
              >
                <span className="flex items-center gap-1.5">
                  <span className={cn("h-2 w-2 rounded-full shrink-0", activeOption.dot)} />
                  {activeOption.label}
                </span>
                <ChevronDown className="h-3.5 w-3.5 opacity-60 shrink-0" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="start"
              className="w-52 rounded-xl border-border/60 shadow-xl p-1"
            >
              {ESTADO_OPTIONS.map((opt) => {
                const isActive = estado === opt.value;
                return (
                  <DropdownMenuItem
                    key={opt.value}
                    onClick={() => onEstadoChange(opt.value)}
                    className={cn(
                      "flex items-center gap-2.5 px-3 py-2 rounded-lg cursor-pointer font-semibold text-sm",
                      opt.dropdownColor
                    )}
                  >
                    <span className={cn("h-2.5 w-2.5 rounded-full shrink-0", opt.dot)} />
                    <span className="flex-1">{opt.label}</span>
                    {isActive && <Check className="h-3.5 w-3.5 shrink-0 opacity-80" />}
                  </DropdownMenuItem>
                );
              })}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* DESKTOP: pills horizontales */}
        <div className="hidden sm:flex flex-wrap items-center gap-1.5">
          {ESTADO_OPTIONS.map((opt) => {
            const isActive = estado === opt.value;
            return (
              <button
                key={opt.value}
                onClick={() => onEstadoChange(opt.value)}
                className={cn(
                  "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold transition-all duration-150",
                  isActive ? opt.active : opt.inactive
                )}
              >
                <span className={cn("h-2 w-2 rounded-full shrink-0", opt.dot)} />
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Fila de período ──────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row items-start sm:items-end gap-3">
        <div className="flex items-center gap-1.5 text-muted-foreground shrink-0 sm:pb-2">
          <Calendar className="h-3.5 w-3.5" />
          <span className="text-[10px] font-black uppercase tracking-widest">Período</span>
        </div>

        <div className="flex flex-wrap items-end gap-3 flex-1 w-full">
          {/* Fecha Desde */}
          <div className="space-y-1 flex-1 min-w-[130px]">
            <Label className="text-[10px] uppercase font-bold text-muted-foreground/70">Desde</Label>
            <Input
              type="date"
              value={fechaDesde}
              onChange={(e) => onFechaDesdeChange(e.target.value)}
              className={cn(
                "h-8 rounded-xl text-sm transition-colors w-full",
                fechaDesde
                  ? "bg-[color:var(--theme-ocean-primary)]/10 border-[color:var(--theme-ocean-primary)]/30 text-[color:var(--theme-ocean-primary)] font-semibold"
                  : "bg-muted/30 border-transparent"
              )}
            />
          </div>

          {/* Fecha Hasta */}
          <div className="space-y-1 flex-1 min-w-[130px]">
            <Label className="text-[10px] uppercase font-bold text-muted-foreground/70">Hasta</Label>
            <Input
              type="date"
              value={fechaHasta}
              onChange={(e) => onFechaHastaChange(e.target.value)}
              className={cn(
                "h-8 rounded-xl text-sm transition-colors w-full",
                fechaHasta
                  ? "bg-[color:var(--theme-ocean-primary)]/10 border-[color:var(--theme-ocean-primary)]/30 text-[color:var(--theme-ocean-primary)] font-semibold"
                  : "bg-muted/30 border-transparent"
              )}
            />
          </div>

          {/* Limpiar */}
          {hasAnyFilter && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onLimpiar}
              className="h-8 px-3 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted gap-1.5 text-xs font-bold shrink-0"
            >
              <X className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Limpiar filtros</span>
              <span className="sm:hidden">Limpiar</span>
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
