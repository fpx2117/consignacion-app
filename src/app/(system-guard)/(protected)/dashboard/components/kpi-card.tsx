"use client";

import React from "react";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { motion } from "motion/react";

interface KpiCardProps {
  title: string;
  value: string | number;
  subtitle: string;
  formula?: string;
  icon: React.ElementType;
  loading: boolean;
  emphasis?: boolean;
  variant?: "default" | "success" | "destructive" | "warning";
}

export function KpiCard({
  title,
  value,
  subtitle,
  formula,
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
    if (isWarning) return "from-[color:var(--status-warning)]/10 via-[color:var(--status-warning)]/5 to-transparent border-[color:var(--status-warning)]/20 dark:border-[color:var(--status-warning)]/20";
    return "from-card/60 via-card/40 to-transparent border-border/50";
  };

  const getIconBg = () => {
    if (isDestructive) return "bg-[color:var(--status-danger)]/15 text-[color:var(--status-danger)] ring-1 ring-inset ring-[color:var(--status-danger)]/20";
    if (isSuccess) return "bg-[color:var(--status-success-strong)]/15 text-[color:var(--status-success-strong)] ring-1 ring-inset ring-[color:var(--status-success-strong)]/20";
    if (isWarning) return "bg-[color:var(--status-warning)]/15 text-[color:var(--status-warning)] ring-1 ring-inset ring-[color:var(--status-warning)]/20";
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
          isDestructive && "bg-[color:var(--status-danger)]",
          isSuccess && "bg-[color:var(--status-success-strong)]",
          isWarning && "bg-[color:var(--status-warning)]",
          isDefault && "bg-[color:var(--theme-ocean-primary)]"
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
                  isSuccess && "text-[color:var(--status-success-strong)] dark:text-[color:var(--status-success-strong)]",
                  isWarning && "text-[color:var(--status-warning)] dark:text-[color:var(--status-warning)]",
                  isDefault && "text-card-foreground"
                )}
              >
                {value}
              </motion.div>
            )}

            <p className="text-[10px] sm:text-xs font-medium text-muted-foreground/70 tracking-wide mt-1 truncate">
              {subtitle}
            </p>
            {formula && (
              <p className="text-[9px] sm:text-[10px] font-mono text-muted-foreground/50 tracking-wide mt-0.5 truncate">
                {formula}
              </p>
            )}
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
