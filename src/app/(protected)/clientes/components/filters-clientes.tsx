"use client";

import * as React from "react";
import { Input } from "@/components/ui/input";
import { LayoutGrid, List, Search, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface ClienteFiltersProps {
  q: string;
  setQ: (value: string) => void;
  statusFilter: string;
  setStatusFilter: (value: string) => void;
  viewMode: "grid" | "list";
  setViewMode: (mode: "grid" | "list") => void;
}

export function ClienteFilters({
  q,
  setQ,
  statusFilter,
  setStatusFilter,
  viewMode,
  setViewMode,
}: ClienteFiltersProps) {
  return (
    <div className="flex flex-col sm:flex-row items-center gap-4 w-full">
      {/* Search Bar - Modern & Fluid */}
      <div className="relative group w-full sm:flex-1">
        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
          <Search className="h-4 w-4 text-muted-foreground/50 group-focus-within:text-primary transition-colors" />
        </div>
        <Input
          placeholder="Buscar cliente por nombre, teléfono..."
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="w-full pl-11 h-12 bg-background/50 border-input/50 hover:bg-background/80 focus:bg-background transition-all rounded-2xl shadow-sm focus-visible:ring-primary/20 focus-visible:border-primary/50"
        />
      </div>

      <div className="flex items-center gap-2 w-full sm:w-auto">
        {/* Status Filter Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              className="h-12 px-4 rounded-2xl border-input/50 bg-background/50 hover:bg-background hover:border-primary/50 transition-all gap-2 flex-1 sm:flex-none text-muted-foreground hover:text-foreground"
            >
              <Filter className="h-4 w-4" />
              <span className="text-xs font-medium">
                {statusFilter === "all"
                  ? "Todos"
                  : statusFilter === "active"
                    ? "Activos"
                    : "Inactivos"}
              </span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48 rounded-xl p-2">
            <DropdownMenuLabel className="text-xs font-bold uppercase tracking-wider text-muted-foreground px-2 py-1.5">
              Estado
            </DropdownMenuLabel>
            <DropdownMenuSeparator className="mb-1" />
            <DropdownMenuCheckboxItem
              checked={statusFilter === "all"}
              onCheckedChange={() => setStatusFilter("all")}
              className="rounded-lg text-sm cursor-pointer"
            >
              Mostrar Todos
            </DropdownMenuCheckboxItem>
            <DropdownMenuCheckboxItem
              checked={statusFilter === "active"}
              onCheckedChange={() => setStatusFilter("active")}
              className="rounded-lg text-sm cursor-pointer text-emerald-600 focus:text-emerald-700"
            >
              Solo Activos
            </DropdownMenuCheckboxItem>
            <DropdownMenuCheckboxItem
              checked={statusFilter === "inactive"}
              onCheckedChange={() => setStatusFilter("inactive")}
              className="rounded-lg text-sm cursor-pointer text-orange-600 focus:text-orange-700"
            >
              Solo Inactivos
            </DropdownMenuCheckboxItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* View Toggle */}
        <div className="bg-muted/50 p-1 rounded-xl flex items-center border border-border/50 h-12">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setViewMode("grid")}
            className={`h-9 w-9 rounded-lg transition-all ${viewMode === "grid"
                ? "bg-background text-primary shadow-sm scale-110"
                : "text-muted-foreground hover:text-foreground hover:bg-transparent"
              }`}
          >
            <LayoutGrid className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setViewMode("list")}
            className={`h-9 w-9 rounded-lg transition-all ${viewMode === "list"
                ? "bg-background text-primary shadow-sm scale-110"
                : "text-muted-foreground hover:text-foreground hover:bg-transparent"
              }`}
          >
            <List className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}