/* eslint-disable */
// @ts-nocheck
"use client";

import * as React from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { X, Filter } from "lucide-react";

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
  { value: "all", label: "Todos los estados" },
  { value: "pendientes", label: "Pendientes (Programado + Vencido)" },
  { value: "PROGRAMADO", label: "Programado" },
  { value: "VENCIDO", label: "Vencido" },
  { value: "PARCIAL", label: "Parcial" },
  { value: "CONFIRMADO", label: "Confirmado" },
  { value: "POSTERGADO", label: "Postergado" },
  { value: "CANCELADO", label: "Cancelado" },
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
  const hasFilters = estado !== "all" || fechaDesde !== "" || fechaHasta !== "";

  return (
    <div className="flex flex-col sm:flex-row items-start sm:items-end gap-3 p-4">
      <div className="flex items-center gap-2 text-muted-foreground shrink-0">
        <Filter className="h-4 w-4" />
        <span className="text-xs font-bold uppercase tracking-wider">Filtros</span>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 flex-1 w-full">
        {/* Estado */}
        <div className="space-y-1 flex-1 min-w-[180px]">
          <Label className="text-[10px] uppercase font-bold text-muted-foreground/70">Estado</Label>
          <Select value={estado} onValueChange={onEstadoChange}>
            <SelectTrigger className="h-9 rounded-xl bg-muted/30 border-transparent text-sm font-medium">
              <SelectValue placeholder="Todos los estados" />
            </SelectTrigger>
            <SelectContent className="rounded-xl">
              {ESTADO_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value} className="text-sm">
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Fecha Desde */}
        <div className="space-y-1 min-w-[140px]">
          <Label className="text-[10px] uppercase font-bold text-muted-foreground/70">Desde</Label>
          <Input
            type="date"
            value={fechaDesde}
            onChange={(e) => onFechaDesdeChange(e.target.value)}
            className="h-9 rounded-xl bg-muted/30 border-transparent text-sm"
          />
        </div>

        {/* Fecha Hasta */}
        <div className="space-y-1 min-w-[140px]">
          <Label className="text-[10px] uppercase font-bold text-muted-foreground/70">Hasta</Label>
          <Input
            type="date"
            value={fechaHasta}
            onChange={(e) => onFechaHastaChange(e.target.value)}
            className="h-9 rounded-xl bg-muted/30 border-transparent text-sm"
          />
        </div>

        {/* Limpiar */}
        {hasFilters && (
          <div className="flex items-end">
            <Button
              variant="ghost"
              size="sm"
              onClick={onLimpiar}
              className="h-9 px-3 rounded-xl text-muted-foreground hover:text-foreground gap-1.5"
            >
              <X className="h-3.5 w-3.5" />
              Limpiar
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
