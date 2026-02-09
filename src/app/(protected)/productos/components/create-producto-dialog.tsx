"use client";

import * as React from "react";
import type { CreateProductoInput } from "@/lib/types";
import { apiService } from "@/lib/apiService";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
} from "@/components/ui/dialog";
import { 
  Package, 
  DollarSign, 
  Tag, 
  Loader2, 
  PlusCircle,
  TrendingUp,
  Wallet,
  AlertCircle
} from "lucide-react";

function toNumber(v: string): number | undefined {
  const t = v.replace(",", ".").trim();
  if (!t) return undefined;
  const n = Number(t);
  return Number.isFinite(n) ? n : undefined;
}

function toInt(v: string): number | undefined {
  const t = v.trim();
  if (!t) return undefined;
  const n = Number(t);
  return Number.isFinite(n) ? Math.trunc(n) : undefined;
}

export function CreateProductoDialog({
  trigger,
  onCreated,
}: {
  trigger: React.ReactNode;
  onCreated?: () => void;
}) {
  const [open, setOpen] = React.useState(false);
  const [saving, setSaving] = React.useState(false);

  const [nombre, setNombre] = React.useState("");
  const [precioVenta, setPrecioVenta] = React.useState("");
  const [precioCosto, setPrecioCosto] = React.useState("");
  const [stockDisponibleUnits, setStockDisponibleUnits] = React.useState("");

  // Cálculos reactivos en tiempo real
  const pv = toNumber(precioVenta) || 0;
  const pc = toNumber(precioCosto) || 0;
  const unidades = toInt(stockDisponibleUnits) || 0;

  const gananciaUnitaria = pv - pc;
  const margenPorcentaje = pv > 0 ? (gananciaUnitaria / pv) * 100 : 0;
  const valorTotalInventario = pv * unidades;
  const esGananciaNegativa = pv > 0 && pc > 0 && gananciaUnitaria < 0;

  const canSubmit = nombre.trim().length >= 2 && pv > 0 && pc > 0;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit || saving) return;
    setSaving(true);
    try {
      await apiService.createProducto({
        nombre: nombre.trim(),
        precioVenta: pv,
        precioCosto: pc,
        stockDisponibleUnits: unidades,
      });
      setOpen(false);
      setNombre(""); setPrecioVenta(""); setPrecioCosto(""); setStockDisponibleUnits("");
      onCreated?.();
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>

      <DialogContent className="sm:max-w-[500px] p-0 overflow-hidden border-none shadow-2xl bg-background text-foreground">
        <DialogHeader className="p-6 pb-2 border-b bg-muted/20">
          <div className="flex items-center gap-2 text-primary">
            <PlusCircle className="h-5 w-5" />
            <DialogTitle className="text-xl font-bold italic tracking-tight">Nuevo Producto</DialogTitle>
          </div>
          <DialogDescription>
            Configura los valores unitarios de tu nuevo artículo.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="p-6 space-y-5">
          <div className="space-y-4">
            {/* Nombre */}
            <div className="space-y-2">
              <Label className="text-sm font-semibold opacity-80">Nombre del producto</Label>
              <div className="relative">
                <Tag className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  placeholder="Ej: Speed XL 500ml"
                  className="pl-9 h-11 bg-muted/30 focus-visible:ring-primary border-muted"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {/* Precio Costo */}
              <div className="space-y-2">
                <Label className="text-sm font-semibold opacity-80">Costo Unitario</Label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    value={precioCosto}
                    onChange={(e) => setPrecioCosto(e.target.value)}
                    className="pl-9 h-11 bg-muted/30"
                    placeholder="0.00"
                    inputMode="decimal"
                  />
                </div>
              </div>

              {/* Precio Venta */}
              <div className="space-y-2">
                <Label className="text-sm font-semibold opacity-80 text-primary">Precio Venta</Label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-primary" />
                  <Input
                    value={precioVenta}
                    onChange={(e) => setPrecioVenta(e.target.value)}
                    className="pl-9 h-11 bg-primary/5 border-primary/20 font-bold text-primary"
                    placeholder="0.00"
                    inputMode="decimal"
                  />
                </div>
              </div>
            </div>

            {/* PANEL DE CÁLCULOS (Compatible con Light/Dark) */}
            {(pv > 0 || pc > 0 || unidades > 0) && (
              <div className={`rounded-xl border p-4 space-y-3 transition-all duration-300 ${
                esGananciaNegativa 
                ? 'bg-destructive/10 border-destructive/20' 
                : 'bg-emerald-500/5 border-emerald-500/20 dark:bg-emerald-500/10'
              }`}>
                {/* Rentabilidad */}
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                    <TrendingUp className={`h-3.5 w-3.5 ${esGananciaNegativa ? 'text-destructive' : 'text-emerald-500'}`} />
                    RENTABILIDAD UNITARIA
                  </div>
                  <span className={`text-sm font-black ${esGananciaNegativa ? 'text-destructive' : 'text-emerald-500'}`}>
                    ${gananciaUnitaria.toLocaleString()} ({margenPorcentaje.toFixed(1)}%)
                  </span>
                </div>

                {/* Valor Inventario */}
                <div className="flex justify-between items-center border-t border-border/40 pt-2">
                  <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                    <Wallet className="h-3.5 w-3.5" />
                    VALOR TOTAL STOCK
                  </div>
                  <span className="text-sm font-black tracking-tight">
                    ${valorTotalInventario.toLocaleString()}
                  </span>
                </div>

                {esGananciaNegativa && (
                  <div className="flex items-center gap-1.5 text-destructive text-[10px] font-bold uppercase animate-pulse">
                    <AlertCircle className="h-3 w-3" />
                    Atención: Estás vendiendo a pérdida
                  </div>
                )}
              </div>
            )}

            {/* Stock */}
            <div className="space-y-2">
              <Label className="text-sm font-semibold opacity-80">Stock Inicial (Unidades)</Label>
              <div className="relative">
                <Package className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  value={stockDisponibleUnits}
                  onChange={(e) => setStockDisponibleUnits(e.target.value)}
                  className="pl-9 h-11 bg-muted/30 font-mono"
                  placeholder="0"
                  inputMode="numeric"
                />
              </div>
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              className="flex-1 h-11"
              onClick={() => setOpen(false)}
              disabled={saving}
            >
              Cancelar
            </Button>
            <Button 
              type="submit" 
              className="flex-1 h-11 font-bold shadow-lg transition-transform active:scale-95"
              disabled={!canSubmit || saving || esGananciaNegativa}
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Guardar Producto"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}