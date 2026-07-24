"use client";

import { motion, AnimatePresence } from "motion/react";
import { ArrowLeft, ArrowRight, SkipForward } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { STEPS, NAVIGABLE_STEPS, TOTAL_NAVIGABLE } from "../constants";
import type { SetupStep } from "../types";
import type { ReactNode } from "react";

interface SetupShellProps {
  currentStep: SetupStep;
  stepIndex: number;
  children: ReactNode;
  onBack: () => void;
  onNext: () => void;
  onSkip?: () => void;
  canGoNext?: boolean;
  showNextButton?: boolean;
}

export function SetupShell({
  currentStep,
  stepIndex,
  children,
  onBack,
  onNext,
  onSkip,
  canGoNext = true,
  showNextButton = true,
}: SetupShellProps) {
  const config = STEPS[stepIndex];
  const isOptional = config && !config.required;

  // Calcular progreso basado en steps navegables
  const navigableIndex = NAVIGABLE_STEPS.findIndex((s) => s.id === currentStep);
  const progressPercentage =
    navigableIndex >= 0
      ? Math.min(((navigableIndex + 1) / TOTAL_NAVIGABLE) * 100, 100)
      : 0;

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col items-center justify-center relative overflow-hidden font-sans">
      {/* Background effects */}
      <div className="fixed top-[-20%] left-[-10%] w-[50%] h-[50%] bg-[color:var(--primary)]/10 blur-[150px] rounded-full pointer-events-none" />
      <div className="fixed bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-[color:var(--primary)]/10 blur-[150px] rounded-full pointer-events-none" />

      {/* Top Progress Bar */}
      {config?.showProgress && (
        <div className="absolute top-0 left-0 w-full z-50">
          {/* Progress track */}
          <div className="h-1 bg-muted/20">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${progressPercentage}%` }}
              transition={{ duration: 0.6, ease: "easeInOut" }}
              className="h-full bg-gradient-to-r from-primary to-accent shadow-[0_0_12px_2px_hsl(var(--primary)/0.35)]"
            />
          </div>

          {/* Step indicator chips */}
          <div className="flex items-center justify-center gap-2 py-3 px-4">
            {NAVIGABLE_STEPS.map((step, i) => {
              const isCurrent = step.id === currentStep;
              const isPast = i < navigableIndex;
              const isSkippable = !step.required;

              return (
                <div key={step.id} className="flex items-center gap-2">
                  <div
                    className={cn(
                      "flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider transition-all duration-300",
                      isCurrent &&
                        "bg-[color:var(--primary)]/20 text-[color:var(--primary)] border border-[color:var(--primary)]/30 scale-105",
                      isPast && "bg-card/5 text-foreground/40",
                      !isCurrent &&
                        !isPast &&
                        "bg-card/[0.02] text-foreground/20",
                      isSkippable &&
                        !isCurrent &&
                        !isPast &&
                        "border border-dashed border-border/40",
                    )}
                  >
                    <span
                      className={cn(
                        "h-1.5 w-1.5 rounded-full",
                        isCurrent && "bg-[color:var(--primary)]",
                        isPast && "bg-card/30",
                        !isCurrent && !isPast && "bg-card/10",
                      )}
                    />
                    <span className="hidden sm:inline">{step.label}</span>
                  </div>

                  {/* Connector line */}
                  {i < NAVIGABLE_STEPS.length - 1 && (
                    <div
                      className={cn(
                        "h-px w-4 transition-colors duration-300",
                        isPast ? "bg-card/20" : "bg-card/5",
                      )}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="w-full max-w-5xl px-6 py-12 md:py-24 relative z-10 flex flex-col min-h-screen">
        <div className="flex-1 flex flex-col justify-center">
          <AnimatePresence mode="wait" initial={false}>
            {children}
          </AnimatePresence>
        </div>
      </div>

      {/* Bottom Navigation */}
      {config?.showNavigation && (
        <div className="fixed bottom-0 left-0 w-full p-6 sm:p-8 flex items-center justify-between pointer-events-none z-50">
          {/* Left: Back */}
          <div className="pointer-events-auto">
            <Button
              variant="ghost"
              onClick={onBack}
              className="h-12 px-4 rounded-full text-muted-foreground hover:text-foreground hover:bg-card/5 transition-all"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              <span className="text-xs font-bold uppercase tracking-widest hidden sm:inline">
                Atrás
              </span>
            </Button>
          </div>

          {/* Right: Skip + Next */}
          <div className="pointer-events-auto flex items-center gap-3">
            {isOptional && onSkip && (
              <Button
                variant="ghost"
                onClick={onSkip}
                className="h-12 px-4 rounded-full text-muted-foreground/60 hover:text-muted-foreground hover:bg-card/5 transition-all"
              >
                <span className="text-xs font-bold uppercase tracking-widest">
                  Omitir
                </span>
                <SkipForward className="w-4 h-4 ml-2" />
              </Button>
            )}

            {showNextButton && (
              <Button
                onClick={onNext}
                disabled={!canGoNext}
                className={cn(
                  "h-12 px-6 rounded-full bg-foreground text-background shadow-[0_4px_20px_-5px_var(--tw-shadow-color)] shadow-foreground/30 transition-all",
                  canGoNext
                    ? "hover:bg-foreground/90 hover:-translate-y-1"
                    : "opacity-40 cursor-not-allowed",
                )}
              >
                <span className="text-xs font-bold uppercase tracking-widest">
                  Siguiente
                </span>
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
