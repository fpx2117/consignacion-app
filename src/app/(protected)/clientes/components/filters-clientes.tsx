"use client";

import * as React from "react";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Search } from "lucide-react";

interface ClienteFiltersProps {
  q: string;
  setQ: (value: string) => void;
  statusFilter: string;
  setStatusFilter: (value: string) => void;
}

export function ClienteFilters({ q, setQ, statusFilter, setStatusFilter }: ClienteFiltersProps) {
  return (
    <div className="flex flex-col lg:flex-row items-center gap-4 w-full bg-card p-3 md:p-4 rounded-[1.5rem] border border-border shadow-sm">
      {/* Buscador */}
      <div className="relative w-full flex-1">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por nombre, teléfono..."
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="w-full pl-11 h-12 bg-background border-border rounded-xl focus-visible:ring-primary"
        />
      </div>

      {/* Tabs - En móvil ocupan todo el ancho */}
      <Tabs 
        value={statusFilter} 
        onValueChange={setStatusFilter} 
        className="w-full lg:w-auto"
      >
        <TabsList className="grid grid-cols-3 w-full lg:w-[300px] h-12 bg-muted/50 border border-border rounded-xl p-1">
          <TabsTrigger value="all" className="text-[10px] font-bold uppercase tracking-widest">
            Todos
          </TabsTrigger>
          <TabsTrigger value="active" className="text-[10px] font-bold uppercase tracking-widest">
            Activos
          </TabsTrigger>
          <TabsTrigger value="inactive" className="text-[10px] font-bold uppercase tracking-widest">
            Inactivos
          </TabsTrigger>
        </TabsList>
      </Tabs>
    </div>
  );
}