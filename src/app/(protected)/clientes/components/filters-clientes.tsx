"use client";

import * as React from "react";
import { Search, X, ChevronLeft, ChevronRight } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

interface ClienteFiltersProps {
  q: string;
  setQ: (value: string) => void;
  statusFilter: string;
  setStatusFilter: (value: string) => void;
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

export function ClienteFilters({ 
  q, 
  setQ, 
  statusFilter, 
  setStatusFilter,
  currentPage,
  totalPages,
  onPageChange
}: ClienteFiltersProps) {
  return (
    <div className="flex flex-col gap-6 p-4 bg-card/50 border rounded-2xl shadow-sm">
      {/* Buscador */}
      <div className="relative w-full">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por nombre, teléfono..."
          value={q}
          onChange={(e) => { setQ(e.target.value); onPageChange(1); }}
          className="pl-10 bg-muted/30 border-none focus-visible:ring-1 focus-visible:ring-primary/50"
        />
        {q && (
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => setQ("")}
            className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
          >
            <X className="h-3 w-3" />
          </Button>
        )}
      </div>

      {/* Filtros de Estado Centrados */}
      <div className="flex flex-col items-center gap-4">
        <div className="flex items-center justify-center gap-1 p-1 bg-muted/40 rounded-xl w-full max-w-sm border border-white/5">
          {["all", "active", "inactive"].map((status) => (
            <Button
              key={status}
              variant={statusFilter === status ? "secondary" : "ghost"}
              size="sm"
              onClick={() => { setStatusFilter(status); onPageChange(1); }}
              className={`flex-1 rounded-lg px-4 h-9 text-xs font-bold transition-all ${
                statusFilter === status 
                  ? 'bg-background shadow-lg text-foreground' 
                  : 'text-muted-foreground hover:bg-transparent'
              }`}
            >
              {status === "all" ? "Todos" : status === "active" ? "Activos" : "Inactivos"}
            </Button>
          ))}
        </div>

        {/* Controles de Paginación */}
        {totalPages > 1 && (
          <div className="flex items-center gap-4 pt-2">
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8 rounded-lg border-white/10"
              onClick={() => onPageChange(currentPage - 1)}
              disabled={currentPage === 1}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
              Página {currentPage} de {totalPages}
            </span>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8 rounded-lg border-white/10"
              onClick={() => onPageChange(currentPage + 1)}
              disabled={currentPage === totalPages}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}