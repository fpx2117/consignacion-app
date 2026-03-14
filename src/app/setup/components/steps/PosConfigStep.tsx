"use client";

import { motion } from "motion/react";
import { MonitorSmartphone, Percent, CreditCard, ShieldCheck, Info } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { StepWrapper } from "../StepWrapper";
import type { PosConfigData } from "../../types";

interface PosConfigStepProps {
  data: PosConfigData;
  onChange: (data: PosConfigData) => void;
}

export function PosConfigStep({ data, onChange }: PosConfigStepProps) {
  return (
    <StepWrapper>
      {/* Header */}
      <div className="space-y-4 text-center mb-10">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="w-16 h-16 rounded-2xl bg-[color:var(--status-warning)]/10 border border-[color:var(--status-warning)]/20 flex items-center justify-center mx-auto"
        >
          <MonitorSmartphone className="w-8 h-8 text-[color:var(--status-warning)]" />
        </motion.div>
        <h2 className="text-3xl font-black tracking-tight">Punto de Venta</h2>
        <p className="text-muted-foreground text-lg">
          Configurá las reglas básicas de tu caja y precios.
        </p>
      </div>

      {/* Form */}
      <div className="space-y-1 bg-card/40 backdrop-blur-md rounded-[2.5rem] border border-border/50 shadow-2xl relative overflow-hidden">
        <div className="absolute inset-0 bg-[color:var(--status-warning)]/5 blur-3xl -z-10 rounded-full" />

        {/* Modo Estricto */}
        <div className="p-6 sm:p-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="h-11 w-11 rounded-xl bg-[color:var(--status-warning)]/10 flex items-center justify-center shrink-0 mt-0.5">
              <ShieldCheck className="h-5 w-5 text-[color:var(--status-warning)]" />
            </div>
            <div>
              <h3 className="font-bold text-foreground flex items-center gap-2">
                Modo Estricto de Caja
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-[color:var(--status-warning)]/10 text-[color:var(--status-warning)] border border-[color:var(--status-warning)]/20">
                  Recomendado
                </span>
              </h3>
              <p className="text-sm text-muted-foreground mt-1">
                Exige abrir un turno de caja antes de procesar ventas. Ideal para control de efectivo.
              </p>
            </div>
          </div>
          <Switch
            checked={data.usarControlDeCaja}
            onCheckedChange={(checked) => onChange({ ...data, usarControlDeCaja: checked })}
            className="data-[state=checked]:bg-[color:var(--status-warning)] shrink-0"
          />
        </div>

        <div className="h-px bg-border/30 mx-8" />

        {/* Porcentaje Consignación */}
        <div className="p-6 sm:p-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="h-11 w-11 rounded-xl bg-[color:var(--primary)]/10 flex items-center justify-center shrink-0 mt-0.5">
              <Percent className="h-5 w-5 text-[color:var(--primary)]" />
            </div>
            <div>
              <h3 className="font-bold text-foreground">Margen de Consignación</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Porcentaje que se suma al precio del proveedor al crear una consignación.
              </p>
              {data.porcentajeAumentoConsignacion > 0 && (
                <div className="flex items-center gap-1.5 mt-2 text-xs text-muted-foreground">
                  <Info className="h-3 w-3 text-[color:var(--primary)]" />
                  <span>
                    Producto de $1.000 → <span className="font-bold text-[color:var(--status-success-strong)]">
                      ${(1000 + 1000 * data.porcentajeAumentoConsignacion / 100).toLocaleString("es-AR")}
                    </span>
                  </span>
                </div>
              )}
            </div>
          </div>
          <div className="relative w-28 shrink-0">
            <Input
              type="number"
              min={0}
              value={data.porcentajeAumentoConsignacion}
              onChange={(e) =>
                onChange({ ...data, porcentajeAumentoConsignacion: Number(e.target.value) || 0 })
              }
              className="h-12 pr-8 text-center font-bold rounded-xl bg-background/50 border-border/50 focus:border-[color:var(--primary)]"
            />
            <Percent className="absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          </div>
        </div>

        <div className="h-px bg-border/30 mx-8" />

        {/* Porcentaje Tarjeta */}
        <div className="p-6 sm:p-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="h-11 w-11 rounded-xl bg-[color:var(--theme-ocean-primary)]/10 flex items-center justify-center shrink-0 mt-0.5">
              <CreditCard className="h-5 w-5 text-[color:var(--theme-ocean-primary)]" />
            </div>
            <div>
              <h3 className="font-bold text-foreground">Interés por Tarjeta</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Porcentaje adicional al cobrar con tarjeta de crédito/débito.
              </p>
              {data.porcentajeInteresTarjeta > 0 && (
                <div className="flex items-center gap-1.5 mt-2 text-xs text-muted-foreground">
                  <Info className="h-3 w-3 text-[color:var(--theme-ocean-primary)]" />
                  <span>
                    Venta de $1.000 → <span className="font-bold text-[color:var(--status-success-strong)]">
                      ${(1000 + 1000 * data.porcentajeInteresTarjeta / 100).toLocaleString("es-AR")}
                    </span>
                  </span>
                </div>
              )}
            </div>
          </div>
          <div className="relative w-28 shrink-0">
            <Input
              type="number"
              min={0}
              value={data.porcentajeInteresTarjeta}
              onChange={(e) =>
                onChange({ ...data, porcentajeInteresTarjeta: Number(e.target.value) || 0 })
              }
              className="h-12 pr-8 text-center font-bold rounded-xl bg-background/50 border-border/50 focus:border-[color:var(--theme-ocean-primary)]"
            />
            <CreditCard className="absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          </div>
        </div>
      </div>

      {/* Hint */}
      <p className="text-center text-xs text-muted-foreground/60 font-medium mt-6">
        Todo esto se puede cambiar después en Configuración → Punto de Venta.
      </p>
    </StepWrapper>
  );
}
