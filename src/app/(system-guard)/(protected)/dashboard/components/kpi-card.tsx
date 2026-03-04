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

  const getGradient = () => {
    if (isWarning) return "from-amber-500/10 via-amber-500/5 to-transparent border-amber-200/20 dark:border-amber-800/20";
    return "from-card/60 via-card/40 to-transparent border-border/50";
  };

  const getIconBg = () => {
    if (isDestructive) return "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400";
    if (isSuccess) return "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400";
    if (isWarning) return "bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400";
    return "bg-secondary text-secondary-foreground";
  };

  return (
    <motion.div
      whileHover={{ y: -4, scale: 1.01 }}
      transition={{ type: "spring", stiffness: 300, damping: 20 }}
      className="h-full w-full"
    >
      <Card
        className={cn(
          "relative flex h-full min-h-[160px] flex-col justify-between overflow-hidden transition-all duration-300",
          "border backdrop-blur-xl shadow-lg",
          emphasis ? "shadow-xl ring-1 ring-black/5 dark:ring-white/10" : "shadow-sm",
          "bg-gradient-to-br",
          getGradient()
        )}
      >
        {/* Glow Effect */}
        <div className={cn(
          "absolute -right-10 -top-10 h-32 w-32 rounded-full blur-3xl opacity-20",
          isDestructive && "bg-red-500",
          isSuccess && "bg-emerald-500",
          isWarning && "bg-amber-500",
          isDefault && "bg-blue-500"
        )} />

        <div className="relative z-10 flex h-full flex-col p-5">
          {/* Header */}
          <div className="flex items-start justify-between mb-4">
            <div className={cn("rounded-xl p-2.5 shadow-sm transition-colors", getIconBg())}>
              <Icon className="h-5 w-5" />
            </div>
          </div>

          {/* Content */}
          <div className="flex flex-col gap-1 mt-auto">
            <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground/80">
              {title}
            </p>

            {loading ? (
              <Skeleton className="h-8 w-3/4 rounded-lg my-1" />
            ) : (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={cn(
                  "text-xl sm:text-2xl md:text-3xl font-black tracking-tight tabular-nums truncate",
                  isSuccess && "text-emerald-600 dark:text-emerald-400",
                  isWarning && "text-amber-600 dark:text-amber-400",
                  isDefault && "text-card-foreground"
                )}
              >
                {value}
              </motion.div>
            )}

            <p className="text-[10px] sm:text-xs font-medium text-muted-foreground/70 tracking-wide mt-1 truncate">
              {subtitle}
            </p>
          </div>
        </div>

        {/* Decorative Watermark Icon (Subtle) */}
        <Icon className={cn(
          "absolute -bottom-4 -right-4 h-24 w-24 opacity-[0.03] rotate-12 pointer-events-none",
          isDefault && "opacity-[0.05]"
        )} />
      </Card>
    </motion.div>
  );
}