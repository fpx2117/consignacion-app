"use client";

import * as React from "react";
import { X, Search } from "lucide-react";
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
import { Separator } from "@/components/ui/separator";
import { getCategoryColorByKey, getCategoryColorByName } from "@/lib/category-colors";
import type { Categoria } from "@/lib/types";

interface FiltersProps {
  query: string;
  setQuery: (val: string) => void;
  stockFilter: string;
  setStockFilter: (val: string) => void;
  categoryFilter: string;
  setCategoryFilter: (val: string) => void;
  expiryFilter: string;
  setExpiryFilter: (val: string) => void;
  categories: Categoria[];
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
    <div className="p-4 space-y-4">
      <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">

        <div className="relative w-full md:max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/50" />
          <Input
            placeholder="Buscar producto, código, categoría..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-9 h-11 bg-background/50 border-input/60 focus:bg-background transition-all rounded-xl shadow-sm"
          />
          {query && (
            <button
              onClick={() => setQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-1"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto overflow-x-auto pb-1 md:pb-0">
          <div className="flex items-center gap-2 p-1 bg-muted/20 rounded-xl border border-border/40">
            <Select value={stockFilter} onValueChange={setStockFilter}>
              <SelectTrigger className="h-9 border-none bg-transparent gap-2 px-3 text-xs font-medium focus:ring-0 w-[140px]">
                <span className="text-muted-foreground">Stock:</span>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="available">Disponible</SelectItem>
                <SelectItem value="low">Bajo</SelectItem>
                <SelectItem value="out">Agotado</SelectItem>
              </SelectContent>
            </Select>

            <Separator orientation="vertical" className="h-5" />

            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="h-9 border-none bg-transparent gap-2 px-3 text-xs font-medium focus:ring-0 w-[150px]">
                <span className="text-muted-foreground">Categoría:</span>
                <SelectValue placeholder="Todas" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                {categories.map((cat) => {
                  const color = cat.color ? getCategoryColorByKey(cat.color) : getCategoryColorByName(cat.nombre);
                  return (
                    <SelectItem key={cat.id} value={cat.nombre}>
                      <span className="flex items-center gap-2">
                        <span className={cn("h-2 w-2 rounded-full shrink-0", color.dot)} />
                        {cat.nombre}
                      </span>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>

            <Separator orientation="vertical" className="h-5" />

            <Select value={expiryFilter} onValueChange={setExpiryFilter}>
              <SelectTrigger className="h-9 border-none bg-transparent gap-2 px-3 text-xs font-medium focus:ring-0 w-[140px]">
                <span className="text-muted-foreground">Vencimiento:</span>
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="expired">Vencidos</SelectItem>
                <SelectItem value="soon">Próximos (7 días)</SelectItem>
                <SelectItem value="none">Sin vencimiento</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {hasActiveFilters && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => {
                setQuery("");
                setStockFilter("all");
                setCategoryFilter("all");
                setExpiryFilter("all");
              }}
              className="h-9 w-9 rounded-xl text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
              title="Limpiar filtros"
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}