"use client";

import { Search, Grid, List, SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type {
  PublicCatalogCategory,
  PublicCatalogConfig,
  PublicCatalogProduct,
  PublicCatalogSortBy,
} from "@/lib/types";

interface StoreFiltersProps {
  config: PublicCatalogConfig;
  products: PublicCatalogProduct[];
  visibleCount: number;
  searchTerm: string;
  setSearchTerm: (val: string) => void;
  viewMode: "grid" | "list";
  setViewMode: (mode: "grid" | "list") => void;
  categories: PublicCatalogCategory[];
  selectedCategory: number | null;
  setSelectedCategory: (id: number | null) => void;
  selectedSubcategory: number | null;
  setSelectedSubcategory: (id: number | null) => void;
  isConsigne: boolean;
  setIsConsigne: (val: boolean) => void;
  sortBy: PublicCatalogSortBy;
  setSortBy: (val: PublicCatalogSortBy) => void;
}

export function StoreFilters({
  config,
  visibleCount,
  searchTerm,
  setSearchTerm,
  viewMode,
  setViewMode,
  sortBy,
  setSortBy,
  isConsigne,
  setIsConsigne,
}: StoreFiltersProps) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      {/* Search */}
      <div className="relative flex-1 max-w-md">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 group-focus-within:text-primary transition-colors" />
        <Input
          placeholder="Buscar productos..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="group pl-10 h-11 bg-white border-2 border-primary/30 rounded-xl text-sm text-gray-900 placeholder:text-gray-400
                               focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:border-primary
                               hover:border-primary/50 shadow-sm transition-all duration-200"
        />
      </div>

      {/* Right controls */}
      <div className="flex items-center gap-2">
        {/* Sort */}
        <Select value={sortBy} onValueChange={setSortBy}>
          <SelectTrigger
            className="h-11 gap-2 border-2 border-primary/30 bg-white rounded-xl text-sm text-gray-900 min-w-[140px] shadow-sm 
                                               hover:border-primary/50 focus:ring-2 focus:ring-primary/40 focus:border-primary transition-all duration-200"
          >
            <SlidersHorizontal className="h-4 w-4 text-primary/60 shrink-0" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="relevance">Relevancia</SelectItem>
            <SelectItem value="price_asc">Menor precio</SelectItem>
            <SelectItem value="price_desc">Mayor precio</SelectItem>
            <SelectItem value="name_asc">A - Z</SelectItem>
            <SelectItem value="name_desc">Z - A</SelectItem>
          </SelectContent>
        </Select>

        {/* View toggle */}
        <div className="hidden sm:flex items-center rounded-xl border border-gray-200 bg-white p-1">
          <Button
            variant="ghost"
            size="icon"
            className={cn(
              "h-8 w-8 rounded-lg",
              viewMode === "grid"
                ? "bg-gray-100 text-gray-900"
                : "text-gray-400",
            )}
            onClick={() => setViewMode("grid")}
          >
            <Grid className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className={cn(
              "h-8 w-8 rounded-lg",
              viewMode === "list"
                ? "bg-gray-100 text-gray-900"
                : "text-gray-400",
            )}
            onClick={() => setViewMode("list")}
          >
            <List className="h-4 w-4" />
          </Button>
        </div>

        {/* Consigne toggle */}
        {config.mostrarPreciosConsignacion &&
          (config.porcentajeAumentoConsignacion ?? 0) > 0 && (
            <div className="hidden sm:flex items-center rounded-xl border border-gray-200 bg-white p-1">
              <button
                onClick={() => setIsConsigne(false)}
                className={cn(
                  "rounded-lg px-3 py-1.5 text-xs font-medium transition-colors",
                  !isConsigne
                    ? "bg-primary text-primary-foreground"
                    : "text-gray-500 hover:text-gray-700",
                )}
              >
                General
              </button>
              <button
                onClick={() => setIsConsigne(true)}
                className={cn(
                  "rounded-lg px-3 py-1.5 text-xs font-medium transition-colors",
                  isConsigne
                    ? "bg-primary text-primary-foreground"
                    : "text-gray-500 hover:text-gray-700",
                )}
              >
                Consig.
              </button>
            </div>
          )}

        {/* Result count */}
        <span className="hidden md:inline text-sm text-gray-400 whitespace-nowrap">
          {visibleCount} resultado{visibleCount !== 1 ? "s" : ""}
        </span>
      </div>
    </div>
  );
}
