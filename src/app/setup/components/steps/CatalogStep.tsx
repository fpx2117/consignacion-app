"use client";

import { motion } from "motion/react";
import { Globe, MessageCircle, ExternalLink, Eye } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { StepWrapper } from "../StepWrapper";
import type { CatalogData } from "../../types";

interface CatalogStepProps {
  data: CatalogData;
  onChange: (data: CatalogData) => void;
}

export function CatalogStep({ data, onChange }: CatalogStepProps) {
  return (
    <StepWrapper>
      {/* Header */}
      <div className="space-y-4 text-center mb-10">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="w-16 h-16 rounded-2xl bg-[color:var(--status-warning)]/10 border border-[color:var(--status-warning)]/20 flex items-center justify-center mx-auto"
        >
          <Globe className="w-8 h-8 text-[color:var(--status-warning)]" />
        </motion.div>
        <h2 className="text-3xl font-black tracking-tight">Catálogo Público</h2>
        <p className="text-muted-foreground text-lg">
          ¿Querés que tus clientes puedan ver tus productos online?
        </p>
      </div>

      {/* Form */}
      <div className="space-y-1 bg-card/40 backdrop-blur-md rounded-[2.5rem] border border-border/50 shadow-2xl relative overflow-hidden">
        <div className="absolute inset-0 bg-[color:var(--status-warning)]/5 blur-3xl -z-10 rounded-full" />

        {/* Toggle catálogo */}
        <div className="p-6 sm:p-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="h-11 w-11 rounded-xl bg-[color:var(--status-warning)]/10 flex items-center justify-center shrink-0 mt-0.5">
              <Eye className="h-5 w-5 text-[color:var(--status-warning)]" />
            </div>
            <div>
              <h3 className="font-bold text-foreground">Habilitar Catálogo Público</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Generá un link donde cualquier persona puede ver tus productos y precios.
              </p>
              {data.mostrarListaPrecios && (
                <div className="flex items-center gap-2 mt-2">
                  <div className="h-2 w-2 rounded-full bg-[color:var(--status-success-strong)] animate-pulse" />
                  <span className="text-xs font-medium text-[color:var(--status-success-strong)] flex items-center gap-1">
                    Disponible en <code className="bg-[color:var(--status-success-strong)]/10 px-1.5 py-0.5 rounded text-[10px]">/lista</code>
                    <ExternalLink className="h-3 w-3" />
                  </span>
                </div>
              )}
            </div>
          </div>
          <Switch
            checked={data.mostrarListaPrecios}
            onCheckedChange={(checked) => onChange({ ...data, mostrarListaPrecios: checked })}
            className="data-[state=checked]:bg-[color:var(--status-warning)] shrink-0"
          />
        </div>

        {/* WhatsApp number — solo visible si catálogo activo */}
        {data.mostrarListaPrecios && (
          <>
            <div className="h-px bg-border/30 mx-8" />
            <div className="p-6 sm:p-8">
              <div className="flex items-start gap-4">
                <div className="h-11 w-11 rounded-xl bg-[color:var(--status-success-strong)]/10 flex items-center justify-center shrink-0 mt-0.5">
                  <MessageCircle className="h-5 w-5 text-[color:var(--status-success-strong)]" />
                </div>
                <div className="flex-1 space-y-3">
                  <div>
                    <h3 className="font-bold text-foreground">Número de WhatsApp</h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      Los clientes podrán enviarte un mensaje directamente desde el catálogo.
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-bold uppercase tracking-widest text-foreground/80 pl-2">
                      Número con código de país
                    </Label>
                    <Input
                      value={data.whatsappNumber}
                      onChange={(e) => onChange({ ...data, whatsappNumber: e.target.value })}
                      placeholder="Ej: 5493515551234"
                      className="h-12 rounded-xl bg-background/50 border-border/50 focus:border-[color:var(--status-success-strong)] focus:ring-4 focus:ring-[color:var(--status-success-strong)]/10"
                    />
                    <p className="text-[10px] text-muted-foreground/60 pl-2">
                      Formato: código país + código área + número, sin espacios ni guiones.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Info box */}
      <div className="mt-6 p-4 rounded-2xl bg-[color:var(--status-warning)]/5 border border-[color:var(--status-warning)]/10 flex items-start gap-3">
        <Globe className="h-4 w-4 text-[color:var(--status-warning)] shrink-0 mt-0.5" />
        <p className="text-xs text-[color:var(--status-warning)]/70 leading-relaxed">
          El catálogo es <strong>solo lectura</strong> — tus clientes ven productos y precios pero no pueden comprar.
          Si en el futuro querés habilitar ventas online, podés hacerlo desde Configuración.
        </p>
      </div>
    </StepWrapper>
  );
}
