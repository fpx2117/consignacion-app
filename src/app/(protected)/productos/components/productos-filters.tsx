"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { Search, SlidersHorizontal, X, Circle } from "lucide-react";
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
}

export function ProductosFilters({ query, setQuery, stockFilter, setStockFilter }: FiltersProps) {
  return (
    <div className="flex flex-col md:flex-row gap-4 items-center p-2">
      
      {/* BARRA DE BÚSQUEDA ANIMADA */}
      <div className="relative w-full flex-1 group">
        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
          <Search className={cn(
            "h-4 w-4 transition-colors duration-300",
            query ? "text-primary" : "text-muted-foreground/50"
          )} />
        </div>
        
        <Input
          placeholder="Buscar por nombre o ID del producto..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full pl-11 pr-12 h-12 bg-background/50 backdrop-blur-sm border-border/40 rounded-2xl transition-all duration-300 focus-visible:ring-offset-0 focus-visible:ring-2 focus-visible:ring-primary/20 focus-visible:border-primary shadow-inner"
        />

        {query && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            className="absolute right-2 top-1/2 -translate-y-1/2"
          >
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => setQuery("")}
              className="h-8 w-8 rounded-xl hover:bg-destructive/10 hover:text-destructive group/btn"
            >
              <X className="h-4 w-4 transition-transform group-hover/btn:rotate-90" />
            </Button>
          </motion.div>
        )}
      </div>

      {/* SELECTOR DE ESTADO CON INDICADORES */}
      <div className="w-full md:w-auto flex items-center gap-2">
        <div className="hidden lg:flex items-center gap-1.5 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">
          <SlidersHorizontal className="h-3.5 w-3.5" />
          Filtrar
        </div>
        
        <Select value={stockFilter} onValueChange={setStockFilter}>
          <SelectTrigger className="w-full md:w-[220px] h-12 bg-background/50 backdrop-blur-sm border-border/40 rounded-2xl font-bold transition-all hover:bg-background/80 focus:ring-2 focus:ring-primary/20 shadow-sm">
            <div className="flex items-center gap-3">
              <StockIndicator status={stockFilter} />
              <SelectValue placeholder="Estado de Stock" />
            </div>
          </SelectTrigger>
          
          <SelectContent className="rounded-2xl border-border/40 backdrop-blur-xl bg-background/95 p-1 shadow-2xl">
            <SelectItem value="all" className="rounded-xl py-3 focus:bg-primary/10">
              <div className="flex items-center gap-2 font-medium text-foreground/80">
                <Circle className="h-2 w-2 fill-muted-foreground/30 text-transparent" />
                Todos los productos
              </div>
            </SelectItem>
            <SelectItem value="available" className="rounded-xl py-3 focus:bg-emerald-500/10 focus:text-emerald-600">
              <div className="flex items-center gap-2 font-medium">
                <Circle className="h-2 w-2 fill-emerald-500 text-emerald-500" />
                Stock Disponible
              </div>
            </SelectItem>
            <SelectItem value="low" className="rounded-xl py-3 focus:bg-orange-500/10 focus:text-orange-600">
              <div className="flex items-center gap-2 font-medium">
                <Circle className="h-2 w-2 fill-orange-500 text-orange-500" />
                Stock Crítico
              </div>
            </SelectItem>
            <SelectItem value="out" className="rounded-xl py-3 focus:bg-red-500/10 focus:text-red-600">
              <div className="flex items-center gap-2 font-medium">
                <Circle className="h-2 w-2 fill-red-500 text-red-500" />
                Agotados
              </div>
            </SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}

// Sub-componente para el punto de color en el Trigger
function StockIndicator({ status }: { status: string }) {
  const colors: Record<string, string> = {
    all: "bg-muted-foreground/40",
    low: "bg-orange-500 shadow-[0_0_8px_rgba(249,115,22,0.5)]",
    available: "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]",
    out: "bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]",
  };

  return (
    <div className={cn(
      "h-2.5 w-2.5 rounded-full transition-all duration-500",
      colors[status] || colors.all
    )} />
  );
}