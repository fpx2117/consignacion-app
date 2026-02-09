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
          // ESTRUCTURA BASE
          "group relative flex flex-col justify-between overflow-hidden transition-all duration-500",
          // h-full y min-h aseguran consistencia, pero h-auto interno permite crecer sin límites
          "h-full min-h-[120px]", 
          "border-none shadow-[0_4px_20px_rgb(0,0,0,0.03)]",
          
          emphasis && "shadow-xl ring-1 ring-inset ring-black/10 dark:ring-white/10 z-10",

          isDestructive && "bg-destructive/5 dark:bg-destructive/10 border-l-4 border-destructive/50",
          isSuccess && "bg-emerald-500/5 dark:bg-emerald-500/10 border-l-4 border-emerald-500/50",
          isWarning && "bg-amber-500/5 dark:bg-amber-500/10 border-l-4 border-amber-500/50",
          isDefault && "bg-card/60 backdrop-blur-md border-l-4 border-transparent hover:border-primary/30"
        )}
      >
        {/* Glow Effects */}
        {isDestructive && <div className="absolute -left-6 -top-6 h-24 w-24 bg-destructive/10 blur-3xl" />}
        {isSuccess && <div className="absolute -left-6 -top-6 h-24 w-24 bg-emerald-500/10 blur-3xl" />}
        {isWarning && <div className="absolute -left-6 -top-6 h-24 w-24 bg-amber-500/10 blur-3xl" />}

        {/* CONTENIDO PRINCIPAL */}
        {/* Usamos flex h-full para distribuir el espacio uniformemente */}
        <div className="relative z-10 flex h-full flex-col justify-between p-4 sm:p-5">
          
          <div className="flex flex-col gap-4"> {/* Gap un poco mayor para respirar */}
            
            {/* ENCABEZADO: CENTRADO VERTICALMENTE */}
            {/* items-center: El icono SIEMPRE estará en el centro vertical del bloque de texto */}
            <div className="flex items-center gap-3 w-full">
              <div
                className={cn(
                  "shrink-0 rounded-xl p-2.5 transition-all duration-300 ring-1 ring-inset shadow-sm", // p-2.5 para un toque más de aire
                  isDestructive && "bg-destructive/10 text-destructive ring-destructive/20",
                  isSuccess && "bg-emerald-500/10 text-emerald-600 ring-emerald-500/20 dark:text-emerald-400",
                  isWarning && "bg-amber-500/10 text-amber-600 ring-amber-500/20 dark:text-amber-400",
                  isDefault && "bg-primary/10 text-primary ring-primary/20"
                )}
              >
                <Icon className="h-4 w-4" />
              </div>

              {/* TÍTULO */}
              {/* break-words: Rompe palabras largas si es necesario */}
              {/* text-balance: Equilibra las líneas para que no quede una palabra sola */}
              <p className="text-[10px] font-black uppercase tracking-[0.15em] text-muted-foreground/80 break-words leading-tight text-balance w-full">
                {title}
              </p>
            </div>

            {/* VALOR */}
            {loading ? (
              <div className="pt-1">
                <Skeleton className="h-8 w-[70%] rounded-lg" />
              </div>
            ) : (
              <motion.div
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                className={cn(
                  // text-2xl base (móvil) -> sm:text-3xl (tablet/desktop)
                  // break-all: Evita que números gigantes rompan el layout horizontal
                  "font-black tabular-nums tracking-tighter leading-none transition-colors break-all",
                  "text-2xl sm:text-3xl", 
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

          {/* FOOTER */}
          {/* items-center: Alinea el puntito con el centro vertical del texto del footer */}
          <div className="mt-4 flex items-center gap-2.5">
            <div
              className={cn(
                "shrink-0 h-1.5 w-1.5 rounded-full ring-2 ring-opacity-20",
                isDestructive && "bg-destructive ring-destructive",
                isSuccess && "bg-emerald-500 ring-emerald-500",
                isWarning && "bg-amber-500 ring-amber-500",
                isDefault && "bg-primary/80 ring-primary"
              )}
            />
            {/* TEXTO SUBTÍTULO */}
            <p className="text-[11px] font-bold text-muted-foreground/90 italic break-words leading-tight text-balance">
              {subtitle}
            </p>
          </div>
        </div>

        {/* ICONO DE FONDO */}
        <Icon
          className={cn(
            "absolute -right-6 -bottom-6 h-32 w-32 transition-all duration-700 pointer-events-none z-0",
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