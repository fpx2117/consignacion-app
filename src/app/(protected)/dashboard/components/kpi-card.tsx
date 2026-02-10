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
  emphasis?: boolean;
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
  const isDestructive = variant === "destructive";
  const isSuccess = variant === "success";
  const isWarning = variant === "warning";
  const isDefault = !isDestructive && !isSuccess && !isWarning;

  return (
    <motion.div
      whileHover={{ y: -4 }}
      transition={{ type: "spring", stiffness: 300, damping: 20 }}
      className="h-full w-full"
    >
      <Card
        className={cn(
          "group relative flex flex-col justify-between overflow-hidden transition-all duration-500",
          "h-full min-h-[140px] sm:min-h-[160px]", // Aumentamos min-h ligeramente para evitar colapsos
          "border-none shadow-sm",
          emphasis && "shadow-xl ring-1 ring-inset ring-black/10 dark:ring-white/10 z-10",
          isDestructive && "bg-destructive/5 dark:bg-destructive/10 border-l-4 border-destructive/50",
          isSuccess && "bg-emerald-500/5 dark:bg-emerald-500/10 border-l-4 border-emerald-500/50",
          isWarning && "bg-amber-500/5 dark:bg-amber-500/10 border-l-4 border-amber-500/50",
          isDefault && "bg-card/60 backdrop-blur-md border-l-4 border-transparent hover:border-primary/30"
        )}
      >
        {/* Glow Effects */}
        <div className={cn(
          "absolute -left-6 -top-6 h-24 w-24 blur-3xl opacity-20 transition-opacity group-hover:opacity-40",
          isDestructive && "bg-destructive",
          isSuccess && "bg-emerald-500",
          isWarning && "bg-amber-500",
          isDefault && "bg-primary"
        )} />

        <div className="relative z-10 flex h-full flex-col justify-between p-3 sm:p-5">
          
          <div className="flex flex-col gap-2 sm:gap-4">
            
            {/* ENCABEZADO: Responsivo (Column en muy pequeños, Row en el resto) */}
            <div className="flex flex-col xs:flex-row items-start xs:items-center gap-2 xs:gap-3 w-full">
              <div
                className={cn(
                  "shrink-0 rounded-lg p-2 transition-all duration-300 ring-1 ring-inset",
                  isDestructive && "bg-destructive/10 text-destructive ring-destructive/20",
                  isSuccess && "bg-emerald-500/10 text-emerald-600 ring-emerald-500/20 dark:text-emerald-400",
                  isWarning && "bg-amber-500/10 text-amber-600 ring-amber-500/20 dark:text-amber-400",
                  isDefault && "bg-primary/10 text-primary ring-primary/20"
                )}
              >
                <Icon className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              </div>

              <p className="text-[9px] sm:text-[10px] font-black uppercase tracking-wider text-muted-foreground/80 leading-tight text-balance overflow-hidden">
                {title}
              </p>
            </div>

            {/* VALOR: Ajuste de tamaño dinámico */}
            {loading ? (
              <Skeleton className="h-7 w-[60%] rounded-lg mt-1" />
            ) : (
              <motion.div
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                className={cn(
                  "font-black tabular-nums tracking-tighter leading-none transition-colors",
                  "text-xl xs:text-2xl sm:text-3xl lg:text-4xl", // Escala fluida
                  "break-all hyphens-auto", // Para números excesivamente largos o divisas
                  isDestructive && "text-destructive",
                  isSuccess && "text-emerald-600 dark:text-emerald-400",
                  isWarning && "text-amber-600 dark:text-amber-400",
                  isDefault && "text-foreground"
                )}
              >
                {value}
              </motion.div>
            )}
          </div>

          {/* FOOTER: Ajuste de padding y tamaño */}
          <div className="mt-3 flex items-center gap-2 border-t border-foreground/5 pt-2 sm:pt-3">
            <div
              className={cn(
                "shrink-0 h-1.5 w-1.5 rounded-full animate-pulse",
                isDestructive && "bg-destructive",
                isSuccess && "bg-emerald-500",
                isWarning && "bg-amber-500",
                isDefault && "bg-primary"
              )}
            />
            <p className="text-[10px] sm:text-[11px] font-medium text-muted-foreground/70 italic line-clamp-1 group-hover:line-clamp-none transition-all">
              {subtitle}
            </p>
          </div>
        </div>

        {/* ICONO DE FONDO: Ajustado para no molestar visualmente en móvil */}
        <Icon
          className={cn(
            "absolute -right-4 -bottom-4 h-20 w-20 sm:h-32 sm:w-32 transition-all duration-700 pointer-events-none z-0",
            "-rotate-12 group-hover:rotate-0 group-hover:scale-110 opacity-[0.05]",
            isDestructive && "text-destructive",
            isSuccess && "text-emerald-500",
            isWarning && "text-amber-500",
            isDefault && "text-primary"
          )}
        />
      </Card>
    </motion.div>
  );
}