"use client";

import React from "react";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

interface KpiCardProps {
  title: string;
  value: string | number;
  subtitle: string;
  icon: React.ElementType;
  loading: boolean;
  emphasis?: boolean; // Ahora "emphasis" solo resalta, no cambia el color
  variant?: "default" | "success" | "destructive" | "warning";
}

export function KpiCard({
  title,
  value,
  subtitle,
  icon: Icon,
  loading,
  emphasis,
  variant = "default",
}: KpiCardProps) {
  
  // 1. LÓGICA DE COLORES (Separada del énfasis)
  const isDestructive = variant === "destructive";
  const isSuccess = variant === "success";
  const isWarning = variant === "warning";
  const isDefault = !isDestructive && !isSuccess && !isWarning;

  return (
    <motion.div
      whileHover={{ y: -4 }}
      transition={{ type: "spring", stiffness: 300, damping: 20 }}
      className="h-full"
    >
      <Card
        className={cn(
          "group relative flex h-full min-h-[115px] flex-col justify-between overflow-hidden transition-all duration-500",
          "border-none shadow-[0_4px_20px_rgb(0,0,0,0.03)]",
          
          // 2. ÉNFASIS: Solo añade sombra y anillo, no cambia el color de fondo
          emphasis && "shadow-xl ring-1 ring-inset ring-black/10 dark:ring-white/10 z-10",

          // 3. ESTILOS POR VARIANTE (Prioridad absoluta al color)
          isDestructive && "bg-destructive/5 dark:bg-destructive/10 border-l-4 border-destructive/50",
          isSuccess && "bg-emerald-500/5 dark:bg-emerald-500/10 border-l-4 border-emerald-500/50", // ✅ ESTO ASEGURA EL VERDE
          isWarning && "bg-amber-500/5 dark:bg-amber-500/10 border-l-4 border-amber-500/50",
          isDefault && "bg-card/60 backdrop-blur-md border-l-4 border-transparent hover:border-primary/30"
        )}
      >
        {/* Glow Effects (Luces de fondo) */}
        {isDestructive && <div className="absolute -left-6 -top-6 h-20 w-20 bg-destructive/10 blur-3xl" />}
        {isSuccess && <div className="absolute -left-6 -top-6 h-20 w-20 bg-emerald-500/10 blur-3xl" />}
        {isWarning && <div className="absolute -left-6 -top-6 h-20 w-20 bg-amber-500/10 blur-3xl" />}

        <div className="relative z-10 flex h-full flex-col justify-between p-5">
          <div className="space-y-2">
            
            {/* ENCABEZADO */}
            <div className="flex items-center gap-3">
              <div
                className={cn(
                  "rounded-xl p-2 transition-all duration-300 ring-1 ring-inset shadow-sm",
                  isDestructive && "bg-destructive/10 text-destructive ring-destructive/20",
                  isSuccess && "bg-emerald-500/10 text-emerald-600 ring-emerald-500/20 dark:text-emerald-400",
                  isWarning && "bg-amber-500/10 text-amber-600 ring-amber-500/20 dark:text-amber-400",
                  isDefault && "bg-primary/10 text-primary ring-primary/20"
                )}
              >
                <Icon className="h-4 w-4" />
              </div>

              <p className="text-[10px] font-black uppercase tracking-[0.15em] text-muted-foreground/80 truncate">
                {title}
              </p>
            </div>

            {/* VALOR */}
            {loading ? (
              <div className="pt-2">
                <Skeleton className="h-9 w-[60%] rounded-lg" />
              </div>
            ) : (
              <motion.div
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                className={cn(
                  "text-3xl font-black tabular-nums tracking-tighter leading-none transition-colors",
                  isDestructive && "text-destructive",
                  isSuccess && "text-emerald-600 dark:text-emerald-400", // ✅ Texto verde
                  isWarning && "text-amber-600 dark:text-amber-400",
                  isDefault && "text-foreground"
                )}
              >
                {value}
              </motion.div>
            )}
          </div>

          {/* FOOTER */}
          <div className="mt-4 flex items-center gap-2">
            <div
              className={cn(
                "h-1.5 w-1.5 rounded-full ring-2 ring-opacity-20",
                isDestructive && "bg-destructive ring-destructive",
                isSuccess && "bg-emerald-500 ring-emerald-500", // ✅ Punto verde
                isWarning && "bg-amber-500 ring-amber-500",
                isDefault && "bg-primary/80 ring-primary"
              )}
            />
            <p className="truncate text-[11px] font-bold text-muted-foreground/90 italic">
              {subtitle}
            </p>
          </div>
        </div>

        {/* ICONO FONDO */}
        <Icon
          className={cn(
            "absolute -right-6 -bottom-6 h-32 w-32 transition-all duration-700 pointer-events-none",
            "-rotate-12 group-hover:rotate-0 group-hover:scale-110",
            isDestructive && "text-destructive opacity-[0.08]",
            isSuccess && "text-emerald-500 opacity-[0.08]",
            isWarning && "text-amber-500 opacity-[0.08]",
            isDefault && "text-primary opacity-[0.06]"
          )}
        />
      </Card>
    </motion.div>
  );
}