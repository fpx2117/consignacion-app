"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogClose,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { BarChart3, FileText, Loader2, Package, PackageX, X } from "lucide-react";
import { useSucursalStore } from "@/store/useSucursalStore";
import { cn } from "@/lib/utils";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type Opcion = "completo" | "sin_costos" | "basico";

const OPCIONES: {
  key: Opcion;
  icon: React.ElementType;
  label: string;
  desc: string;
  tags: string[];
  color: string;
  iconColor: string;
}[] = [
  {
    key: "completo",
    icon: BarChart3,
    label: "Completo",
    desc: "Incluye costos, precios de venta, márgenes y cuadros de valuación financiera.",
    tags: ["Costos", "Valuación", "Margen"],
    color: "hover:border-[color:var(--primary)] hover:bg-[color:var(--primary)]/5 data-[active=true]:border-[color:var(--primary)] data-[active=true]:bg-[color:var(--primary)]/5",
    iconColor: "text-[color:var(--primary)]",
  },
  {
    key: "sin_costos",
    icon: FileText,
    label: "Sin costos",
    desc: "Muestra precios de venta, stock y valuación total. Oculta precios de costo y margen.",
    tags: ["Valuación", "Sin costo"],
    color: "hover:border-sky-400 hover:bg-sky-50 dark:hover:bg-sky-950 data-[active=true]:border-sky-400 data-[active=true]:bg-sky-50 dark:data-[active=true]:bg-sky-950",
    iconColor: "text-sky-500",
  },
  {
    key: "basico",
    icon: Package,
    label: "Solo stock",
    desc: "Solo muestra nombre, imagen, stock y precio de venta. Sin datos financieros.",
    tags: ["Sin costos", "Sin valuación"],
    color: "hover:border-slate-400 hover:bg-slate-50 dark:hover:bg-slate-900 data-[active=true]:border-slate-400 data-[active=true]:bg-slate-50 dark:data-[active=true]:bg-slate-900",
    iconColor: "text-slate-500",
  },
];

export function InventoryPdfOptionsDialog({ open, onOpenChange }: Props) {
  const activeSucursalId = useSucursalStore((state) => state.activeSucursalId);
  const [loading, setLoading] = useState<Opcion | null>(null);
  const [soloConStock, setSoloConStock] = useState(false);

  const handleOpen = (opcion: Opcion) => {
    if (loading) return;
    setLoading(opcion);

    const params = new URLSearchParams();
    if (opcion === "completo") {
      params.set("conCostos", "true");
      params.set("conValuacion", "true");
    } else if (opcion === "sin_costos") {
      params.set("conCostos", "false");
      params.set("conValuacion", "true");
    } else {
      params.set("conCostos", "false");
      params.set("conValuacion", "false");
    }
    params.set("soloConStock", soloConStock ? "true" : "false");

    window.open(
      `/ver/inventario/${activeSucursalId}/pdf?${params.toString()}`,
      "_blank"
    );
    setTimeout(() => {
      setLoading(null);
      onOpenChange(false);
    }, 600);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-[2.5rem] p-0 overflow-hidden max-w-[420px] border-none shadow-2xl dark:bg-background bg-card gap-0 [&>button]:hidden">
        {/* Close */}
        <div className="absolute right-5 top-5 z-50">
          <DialogClose className="rounded-full bg-black/10 p-2 hover:bg-black/20 text-foreground/70 hover:text-foreground transition-colors focus:outline-none cursor-pointer flex items-center justify-center">
            <X className="h-4 w-4" />
            <span className="sr-only">Cerrar</span>
          </DialogClose>
        </div>

        {/* Header */}
        <div className="bg-[color:var(--primary)] p-7 text-white relative overflow-hidden">
          <div className="absolute top-0 right-0 p-8 opacity-10 rotate-12 scale-150">
            <FileText className="h-24 w-24" />
          </div>
          <div className="relative z-10">
            <DialogHeader>
              <DialogTitle className="text-xl font-black text-white tracking-tight">
                Exportar Inventario PDF
              </DialogTitle>
              <DialogDescription className="text-white/70 text-sm mt-1">
                Elegí qué información incluir en el reporte.
              </DialogDescription>
            </DialogHeader>
          </div>
        </div>

        {/* Opciones */}
        <div className="p-5 flex flex-col gap-2.5">
          {OPCIONES.map(({ key, icon: Icon, label, desc, tags, color, iconColor }) => {
            const isActive = loading === key;
            const isDisabled = loading !== null && !isActive;
            return (
              <button
                key={key}
                data-active={isActive}
                onClick={() => handleOpen(key)}
                disabled={loading !== null}
                className={cn(
                  "group flex items-center gap-4 rounded-2xl border-2 border-border/60 p-4 text-left transition-all",
                  color,
                  "focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--primary)]",
                  isDisabled && "opacity-40 cursor-not-allowed"
                )}
              >
                {/* Icon */}
                <div className={cn("flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center bg-muted/60 group-hover:scale-110 transition-transform", isActive && "scale-110")}>
                  {isActive ? (
                    <Loader2 className={cn("h-5 w-5 animate-spin", iconColor)} />
                  ) : (
                    <Icon className={cn("h-5 w-5", iconColor)} />
                  )}
                </div>

                {/* Text */}
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-sm text-foreground">{label}</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">{desc}</p>
                  <div className="flex flex-wrap gap-1 mt-2">
                    {tags.map((tag) => (
                      <span key={tag} className="text-[9px] font-black uppercase tracking-wide px-1.5 py-0.5 rounded-md bg-muted text-muted-foreground">
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Toggle stock */}
        <div className="px-5 pb-3">
          <button
            type="button"
            onClick={() => setSoloConStock((v) => !v)}
            disabled={loading !== null}
            className={cn(
              "w-full flex items-center gap-3 rounded-2xl border-2 px-4 py-3 text-left transition-all",
              soloConStock
                ? "border-amber-400 bg-amber-50 dark:bg-amber-950"
                : "border-border/60 bg-muted/30 hover:border-border",
              loading !== null && "opacity-40 cursor-not-allowed"
            )}
          >
            <div className={cn(
              "flex-shrink-0 w-8 h-8 rounded-xl flex items-center justify-center",
              soloConStock ? "bg-amber-100 dark:bg-amber-900" : "bg-muted"
            )}>
              {soloConStock
                ? <Package className="h-4 w-4 text-amber-600" />
                : <PackageX className="h-4 w-4 text-muted-foreground" />
              }
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-xs text-foreground">
                {soloConStock ? "Solo productos con stock" : "Todos los productos (con y sin stock)"}
              </p>
              <p className="text-[10px] text-muted-foreground mt-0.5">
                {soloConStock ? "Los agotados no aparecerán en el PDF." : "Los agotados se muestran al final con indicador rojo."}
              </p>
            </div>
            {/* pill on/off */}
            <div className={cn(
              "flex-shrink-0 w-8 h-5 rounded-full transition-colors relative",
              soloConStock ? "bg-amber-400" : "bg-muted-foreground/30"
            )}>
              <div className={cn(
                "absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all",
                soloConStock ? "left-3.5" : "left-0.5"
              )} />
            </div>
          </button>
        </div>

        <div className="px-5 pb-5">
          <Button
            variant="ghost"
            className="w-full text-muted-foreground"
            onClick={() => onOpenChange(false)}
            disabled={loading !== null}
          >
            Cancelar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
