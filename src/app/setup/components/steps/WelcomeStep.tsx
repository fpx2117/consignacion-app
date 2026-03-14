"use client";

import { motion } from "motion/react";
import { Sparkles, ArrowRight, Shield, Zap, BarChart3 } from "lucide-react";
import { StepWrapper } from "../StepWrapper";

interface WelcomeStepProps {
  onNext: () => void;
}

const FEATURES = [
  { icon: Zap, label: "Punto de Venta", desc: "Cobros rápidos y control de caja" },
  { icon: BarChart3, label: "Gestión Completa", desc: "Stock, consignaciones y reportes" },
  { icon: Shield, label: "Seguro y Confiable", desc: "Datos protegidos en la nube" },
];

export function WelcomeStep({ onNext }: WelcomeStepProps) {
  return (
    <StepWrapper className="flex flex-col items-center justify-center space-y-10 text-center">
      {/* Icon */}
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: "spring", stiffness: 200, damping: 20, delay: 0.2 }}
        className="w-24 h-24 rounded-3xl bg-[color:var(--primary)]/10 border border-[color:var(--primary)]/20 flex items-center justify-center relative"
      >
        <div className="absolute inset-0 bg-[color:var(--primary)]/20 blur-xl rounded-3xl" />
        <Sparkles className="w-10 h-10 text-[color:var(--primary)] relative z-10" />
      </motion.div>

      {/* Title */}
      <div className="space-y-4 max-w-lg">
        <motion.h1
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="text-4xl md:text-5xl font-black tracking-tight"
        >
          Bienvenido a tu{" "}
          <span className="bg-gradient-to-r from-[color:var(--primary)] to-[color:var(--primary)] bg-clip-text text-transparent">
            Nuevo Ecosistema
          </span>
        </motion.h1>
        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="text-muted-foreground text-lg md:text-xl font-medium"
        >
          Configurá tu negocio en unos simples pasos. Todo lo que necesitás para arrancar, en un solo lugar.
        </motion.p>
      </div>

      {/* Feature pills */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6 }}
        className="flex flex-wrap items-center justify-center gap-3"
      >
        {FEATURES.map((f, i) => (
          <motion.div
            key={f.label}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.7 + i * 0.1 }}
            className="flex items-center gap-2.5 px-4 py-2.5 rounded-2xl bg-card/[0.04] border border-[color:var(--ui-fx-white)]/[0.06] backdrop-blur-sm"
          >
            <div className="h-8 w-8 rounded-lg bg-[color:var(--primary)]/10 flex items-center justify-center">
              <f.icon className="h-4 w-4 text-[color:var(--primary)]" />
            </div>
            <div className="text-left">
              <p className="text-xs font-bold text-foreground/90">{f.label}</p>
              <p className="text-[10px] text-muted-foreground">{f.desc}</p>
            </div>
          </motion.div>
        ))}
      </motion.div>

      {/* CTA */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.9 }}
        className="pt-4"
      >
        <button
          onClick={onNext}
          className="group px-8 py-4 rounded-full bg-foreground text-background font-black tracking-widest uppercase text-sm hover:scale-105 active:scale-95 transition-all shadow-[0_0_40px_-10px_var(--tw-shadow-color)] shadow-foreground/30 flex items-center gap-3"
        >
          Comenzar Configuración
          <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
        </button>
      </motion.div>
    </StepWrapper>
  );
}
