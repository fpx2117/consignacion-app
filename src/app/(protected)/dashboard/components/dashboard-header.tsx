"use client";

import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RefreshCw, LayoutDashboard, CalendarDays } from "lucide-react";
import { DashboardPeriod } from "@/lib/types";
import { motion } from "framer-motion";

interface DashboardHeaderProps {
  period: string;
  setPeriod: (v: DashboardPeriod) => void;
  refresh: () => void;
  loading: boolean;
}

export function DashboardHeader({ period, setPeriod, refresh, loading }: DashboardHeaderProps) {
  // Un toque personal: Saludo dinámico según la hora
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Buenos días";
    if (hour < 18) return "Buenas tardes";
    return "Buenas noches";
  };

  return (
    <div className="relative flex flex-col gap-6 pb-8 sm:flex-row sm:items-end sm:justify-between">
      {/* Lado Izquierdo: Títulos con animación */}
      <motion.div 
        initial={{ opacity: 0, x: -20 }} 
        animate={{ opacity: 1, x: 0 }}
        className="space-y-1"
      >
        <div className="flex items-center gap-2 mb-1">
          <div className="h-2 w-2 rounded-full bg-primary animate-pulse" />
          <span className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/60">
            {getGreeting()}
          </span>
        </div>
        <h1 className="text-3xl font-black tracking-tight text-foreground md:text-4xl">
          Dashboard
        </h1>
        <p className="text-sm font-medium text-muted-foreground/80 max-w-xs leading-relaxed">
          Monitorea el pulso operativo de tu negocio en tiempo real.
        </p>
      </motion.div>

      {/* Lado Derecho: Controles Estilizados */}
      <motion.div 
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col gap-3 sm:flex-row sm:items-center"
      >
        <div className="relative group w-full sm:w-[200px]">
          <div className="absolute left-3 top-1/2 -translate-y-1/2 z-10 pointer-events-none text-muted-foreground/50 group-hover:text-primary transition-colors">
            <CalendarDays className="h-4 w-4" />
          </div>
          <Select value={period} onValueChange={(v) => setPeriod(v as DashboardPeriod)}>
            <SelectTrigger className="w-full pl-10 bg-card/50 border-none shadow-[0_4px_15px_rgb(0,0,0,0.05)] backdrop-blur-md hover:bg-card transition-all rounded-xl ring-offset-background focus:ring-1 focus:ring-primary/20">
              <SelectValue placeholder="Período" />
            </SelectTrigger>
            <SelectContent className="rounded-xl border-none shadow-2xl backdrop-blur-xl bg-background/95">
              <SelectItem value="today" className="rounded-lg">Hoy</SelectItem>
              <SelectItem value="week" className="rounded-lg">Esta semana</SelectItem>
              <SelectItem value="month" className="rounded-lg">Este mes</SelectItem>
              <SelectItem value="all" className="rounded-lg">Todo el histórico</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Button 
          variant="secondary" 
          onClick={refresh} 
          disabled={loading}
          className={cn(
            "w-full sm:w-auto px-6 rounded-xl border-none shadow-[0_4px_15px_rgb(0,0,0,0.05)] bg-card/50 backdrop-blur-md hover:bg-card transition-all group",
            loading && "opacity-80"
          )}
        >
          <RefreshCw className={cn(
            "mr-2 h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors",
            loading ? "animate-spin text-primary" : ""
          )} />
          <span className="font-bold text-xs uppercase tracking-widest">
            {loading ? "Actualizando" : "Recargar"}
          </span>
        </Button>
      </motion.div>

      {/* Línea decorativa minimalista */}
      <div className="absolute bottom-0 left-0 w-full h-[1px] bg-gradient-to-r from-border/50 via-border to-transparent" />
    </div>
  );
}

// Auxiliar para condicionales de clase si no lo tienes
function cn(...inputs: any[]) {
  return inputs.filter(Boolean).join(" ");
}