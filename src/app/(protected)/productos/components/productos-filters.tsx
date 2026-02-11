"use client";

import * as React from "react";
import { X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

interface FiltersProps {
  query: string;
  setQuery: (val: string) => void;
  stockFilter: string;
  setStockFilter: (val: string) => void;
  categoryFilter: string;
  setCategoryFilter: (val: string) => void;
  expiryFilter: string;
  setExpiryFilter: (val: string) => void;
  categories: string[];
}

export function ProductosFilters({ 
  query, setQuery, 
  stockFilter, setStockFilter, 
  categoryFilter, setCategoryFilter,
  expiryFilter, setExpiryFilter,
  categories 
}: FiltersProps) {
  
  const hasActiveFilters = stockFilter !== "all" || categoryFilter !== "all" || expiryFilter !== "all" || query !== "";

  return (
    <div className="flex flex-col gap-4 p-2 relative z-30">
      {/* Search Bar & Clear Button */}
      <div className="flex flex-col md:flex-row gap-3 w-full">
        <div className="relative w-full flex-1">
          <Input
            placeholder="Buscar por nombre, código o ID..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            // bg-background se adapta a blanco en light y oscuro en dark
            className="w-full pl-5 h-12 bg-background border-input rounded-2xl focus-visible:ring-primary/20 transition-all"
          />
          {query && (
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => setQuery("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 rounded-xl hover:bg-muted"
            >
              <X className="h-4 w-4 text-muted-foreground" />
            </Button>
          )}
        </div>

        {hasActiveFilters && (
          <Button 
            variant="outline" 
            onClick={() => {
              setQuery("");
              setStockFilter("all");
              setCategoryFilter("all");
              setExpiryFilter("all");
            }}
            className="h-12 px-6 rounded-2xl gap-2 font-black uppercase text-[10px] tracking-widest border-dashed border-2"
          >
            Limpiar Filtros
          </Button>
        )}
      </div>

      {/* Selectors Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full">
        
        {/* STOCK */}
        <Select value={stockFilter} onValueChange={setStockFilter}>
          <SelectTrigger className="h-11 bg-background border-input rounded-xl font-bold px-4 focus:ring-1 focus:ring-primary">
            <div className="flex items-center gap-3">
              <div className={cn(
                "h-2 w-2 rounded-full shrink-0",
                stockFilter === 'available' ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" :
                stockFilter === 'low' ? "bg-orange-500 shadow-[0_0_8px_rgba(249,115,22,0.5)]" :
                stockFilter === 'out' ? "bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]" : 
                "bg-slate-400"
              )} />
              <span className="text-[10px] uppercase text-muted-foreground font-black tracking-tighter">Stock:</span>
              <SelectValue placeholder="Todos" />
            </div>
          </SelectTrigger>
          <SelectContent className="rounded-xl border-border bg-popover p-1 shadow-xl">
            <SelectItem value="all">Indiferente</SelectItem>
            <SelectItem value="available" className="text-emerald-600 dark:text-emerald-400">Disponible</SelectItem>
            <SelectItem value="low" className="text-orange-600 dark:text-orange-400">Crítico</SelectItem>
            <SelectItem value="out" className="text-red-600 dark:text-red-400">Agotado</SelectItem>
          </SelectContent>
        </Select>

        {/* CATEGORÍA */}
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="h-11 bg-background border-input rounded-xl font-bold px-4 focus:ring-1 focus:ring-primary">
            <div className="flex items-center gap-3">
              <div className="h-2 w-2 rounded-full bg-blue-500 shrink-0" />
              <span className="text-[10px] uppercase text-muted-foreground font-black tracking-tighter">Cat:</span>
              <SelectValue placeholder="Todas" />
            </div>
          </SelectTrigger>
          <SelectContent className="rounded-xl border-border bg-popover p-1 shadow-xl">
            <SelectItem value="all">Todas las categorías</SelectItem>
            {categories.map((cat) => (
              <SelectItem key={cat} value={cat}>{cat}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* VENCIMIENTO */}
        <Select value={expiryFilter} onValueChange={setExpiryFilter}>
          <SelectTrigger className="h-11 bg-background border-input rounded-xl font-bold px-4 focus:ring-1 focus:ring-primary">
            <div className="flex items-center gap-3">
              <div className={cn(
                "h-2 w-2 rounded-full shrink-0",
                expiryFilter === 'expired' ? "bg-red-500" :
                expiryFilter === 'soon' ? "bg-amber-500" : "bg-slate-400"
              )} />
              <span className="text-[10px] uppercase text-muted-foreground font-black tracking-tighter">Vence:</span>
              <SelectValue placeholder="Fecha" />
            </div>
          </SelectTrigger>
          <SelectContent className="rounded-xl border-border bg-popover p-1 shadow-xl">
            <SelectItem value="all">Cualquier fecha</SelectItem>
            <SelectItem value="expired" className="text-red-600 dark:text-red-400">Vencidos</SelectItem>
            <SelectItem value="soon" className="text-amber-600 dark:text-amber-400">Próximos (7 días)</SelectItem>
            <SelectItem value="none">Sin vencimiento</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}