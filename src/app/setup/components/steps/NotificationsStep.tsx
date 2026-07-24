"use client";

import { motion } from "motion/react";
import {
  BellRing,
  PackageSearch,
  CalendarClock,
  ShoppingCart,
  Package,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { StepWrapper } from "../StepWrapper";
import type { NotificationsData } from "../../types";

interface NotificationsStepProps {
  data: NotificationsData;
  onChange: (data: NotificationsData) => void;
}

export function NotificationsStep({ data, onChange }: NotificationsStepProps) {
  return (
    <StepWrapper>
      {/* Header */}
      <div className="space-y-4 text-center mb-10">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="w-16 h-16 rounded-2xl bg-[color:var(--brand-instagram)]/10 border border-[color:var(--brand-instagram)]/20 flex items-center justify-center mx-auto"
        >
          <BellRing className="w-8 h-8 text-[color:var(--brand-instagram)]" />
        </motion.div>
        <h2 className="text-3xl font-black tracking-tight">
          Alertas y Notificaciones
        </h2>
        <p className="text-muted-foreground text-lg">
          Configurá qué avisos querés recibir para mantener todo bajo control.
        </p>
      </div>

      {/* Form */}
      <div className="space-y-1 bg-card/40 backdrop-blur-md rounded-[2.5rem] border border-border/50 shadow-2xl relative overflow-hidden">
        <div className="absolute inset-0 bg-[color:var(--brand-instagram)]/5 blur-3xl -z-10 rounded-full" />

        {/* Stock Bajo */}
        <div className="p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-[color:var(--status-danger)]/10 flex items-center justify-center shrink-0">
              <PackageSearch className="h-4 w-4 text-[color:var(--status-danger)]" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-foreground">Stock Bajo</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Aviso cuando un producto llega al mínimo.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold text-muted-foreground uppercase">
                Mín:
              </span>
              <Input
                type="number"
                min={1}
                value={data.minStockGlobal}
                onChange={(e) =>
                  onChange({
                    ...data,
                    minStockGlobal: Number(e.target.value) || 1,
                  })
                }
                className="h-9 w-16 rounded-lg text-center font-bold text-xs bg-background/50 border-border/50"
              />
            </div>
            <Switch
              checked={data.notificarStockBajo}
              onCheckedChange={(v) =>
                onChange({ ...data, notificarStockBajo: v })
              }
              className="data-[state=checked]:bg-[color:var(--brand-instagram)]"
            />
          </div>
        </div>

        <div className="h-px bg-border/20 mx-6" />

        {/* Vencimientos */}
        <div className="p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-[color:var(--status-warning)]/10 flex items-center justify-center shrink-0">
              <CalendarClock className="h-4 w-4 text-[color:var(--status-warning)]" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-foreground">
                Vencimientos
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Aviso antes de que un producto caduque.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min={1}
                value={data.diasAnticipacionVencimiento}
                onChange={(e) =>
                  onChange({
                    ...data,
                    diasAnticipacionVencimiento: Number(e.target.value) || 1,
                  })
                }
                className="h-9 w-16 rounded-lg text-center font-bold text-xs bg-background/50 border-border/50"
              />
              <span className="text-[10px] font-bold text-muted-foreground uppercase">
                días
              </span>
            </div>
            <Switch
              checked={data.notificarVencimientos}
              onCheckedChange={(v) =>
                onChange({ ...data, notificarVencimientos: v })
              }
              className="data-[state=checked]:bg-[color:var(--brand-instagram)]"
            />
          </div>
        </div>

        <div className="h-px bg-border/20 mx-6" />

        {/* Ventas */}
        <div className="p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-[color:var(--status-success-strong)]/10 flex items-center justify-center shrink-0">
              <ShoppingCart className="h-4 w-4 text-[color:var(--status-success-strong)]" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-foreground">
                Confirmación de Ventas
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Alerta al procesar cada venta.
              </p>
            </div>
          </div>
          <Switch
            checked={data.notificarVentas}
            onCheckedChange={(v) => onChange({ ...data, notificarVentas: v })}
            className="data-[state=checked]:bg-[color:var(--brand-instagram)]"
          />
        </div>

        <div className="h-px bg-border/20 mx-6" />

        {/* Consignaciones activas */}
        <div className="p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-[color:var(--primary)]/10 flex items-center justify-center shrink-0">
              <Package className="h-4 w-4 text-[color:var(--primary)]" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-foreground">
                Consignaciones Activas
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Aviso cuando llevan mucho tiempo en la calle.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min={1}
                value={data.diasAvisoConsignacion}
                onChange={(e) =>
                  onChange({
                    ...data,
                    diasAvisoConsignacion: Number(e.target.value) || 1,
                  })
                }
                className="h-9 w-16 rounded-lg text-center font-bold text-xs bg-background/50 border-border/50"
              />
              <span className="text-[10px] font-bold text-muted-foreground uppercase">
                días
              </span>
            </div>
            <Switch
              checked={data.notificarConsignacionesActivas}
              onCheckedChange={(v) =>
                onChange({ ...data, notificarConsignacionesActivas: v })
              }
              className="data-[state=checked]:bg-[color:var(--brand-instagram)]"
            />
          </div>
        </div>
      </div>
    </StepWrapper>
  );
}
