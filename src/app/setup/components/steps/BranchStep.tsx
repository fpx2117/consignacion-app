"use client";

import { motion } from "framer-motion";
import { Store, Monitor } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StepWrapper } from "../StepWrapper";
import type { BranchData } from "../../types";

interface BranchStepProps {
  data: BranchData;
  onChange: (data: BranchData) => void;
}

export function BranchStep({ data, onChange }: BranchStepProps) {
  return (
    <StepWrapper>
      {/* Header */}
      <div className="space-y-4 text-center mb-10">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="w-16 h-16 rounded-2xl bg-emerald-600/10 border border-emerald-500/20 flex items-center justify-center mx-auto"
        >
          <Store className="w-8 h-8 text-emerald-500" />
        </motion.div>
        <h2 className="text-3xl font-black tracking-tight">Tu Primera Sucursal</h2>
        <p className="text-muted-foreground text-lg">
          Cada punto de venta necesita un nombre y al menos una terminal de cobro.
        </p>
      </div>

      {/* Form */}
      <div className="space-y-6 bg-card/40 backdrop-blur-md p-8 rounded-[2.5rem] border border-border/50 shadow-2xl relative">
        <div className="absolute inset-0 bg-emerald-500/5 blur-3xl -z-10 rounded-full" />

        {/* Sucursal */}
        <div className="space-y-2">
          <Label className="text-xs font-bold uppercase tracking-widest text-foreground/80 pl-2 flex items-center gap-1.5">
            <Store className="h-3 w-3" />
            Nombre de la Sucursal <span className="text-red-400">*</span>
          </Label>
          <Input
            autoFocus
            value={data.nombre}
            onChange={(e) => onChange({ ...data, nombre: e.target.value })}
            placeholder="Ej: Casa Central, Local Shopping Norte..."
            className="h-14 rounded-2xl bg-background/50 border-border/50 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 text-lg font-semibold"
          />
          <p className="text-xs text-muted-foreground/60 pl-2">
            Si tenés un solo local, podés dejarlo como "Sucursal Principal".
          </p>
        </div>

        {/* Divider */}
        <div className="flex items-center gap-4">
          <div className="h-px flex-1 bg-border/30" />
          <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/40">
            Terminal de Cobro
          </span>
          <div className="h-px flex-1 bg-border/30" />
        </div>

        {/* Terminal */}
        <div className="space-y-2">
          <Label className="text-xs font-bold uppercase tracking-widest text-foreground/80 pl-2 flex items-center gap-1.5">
            <Monitor className="h-3 w-3" />
            Nombre de la Terminal <span className="text-red-400">*</span>
          </Label>
          <Input
            value={data.terminalNombre}
            onChange={(e) => onChange({ ...data, terminalNombre: e.target.value })}
            placeholder="Ej: Caja Mostrador 1, Planta Alta..."
            className="h-14 rounded-2xl bg-background/50 border-border/50 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 text-lg font-semibold"
          />
          <p className="text-xs text-muted-foreground/60 pl-2">
            La terminal representa un punto de cobro físico. Podés agregar más después.
          </p>
        </div>

        {/* Visual hint */}
        <div className="mt-4 flex items-center gap-3 p-4 rounded-2xl bg-emerald-500/5 border border-emerald-500/10">
          <div className="h-10 w-10 rounded-xl bg-emerald-500/10 flex items-center justify-center shrink-0">
            <Monitor className="h-5 w-5 text-emerald-500" />
          </div>
          <div>
            <p className="text-xs font-bold text-emerald-400">Vista Previa</p>
            <p className="text-sm text-muted-foreground">
              <span className="font-semibold text-foreground">{data.nombre || "Mi Sucursal"}</span>
              {" → "}
              <span className="font-semibold text-foreground">{data.terminalNombre || "Mi Caja"}</span>
            </p>
          </div>
        </div>
      </div>
    </StepWrapper>
  );
}
