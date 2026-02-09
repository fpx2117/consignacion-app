"use client";

import * as React from "react";
import type { Producto, UpdateProductoInput } from "@/lib/types";
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
  Pencil, 
  DollarSign, 
  Tag, 
  Loader2, 
  TrendingUp, 
  AlertCircle,
  Package
} from "lucide-react";

function toNumber(v: string): number | undefined {
  const t = v.replace(",", ".").trim();
  if (!t) return undefined;
  const n = Number(t);
  return Number.isFinite(n) ? n : undefined;
}

export function EditProductoDialog({
  trigger,
  producto,
  onUpdated,
}: {
  trigger: React.ReactNode;
  producto: Producto;
  onUpdated?: () => void;
}) {
  const [open, setOpen] = React.useState(false);
  const [saving, setSaving] = React.useState(false);

  const [nombre, setNombre] = React.useState(producto.nombre);
  const [precioVenta, setPrecioVenta] = React.useState(String(producto.precioVenta));
  const [precioCosto, setPrecioCosto] = React.useState(String(producto.precioCosto));

  // Sincronizar estados cuando cambia el producto o se abre el dialog
  React.useEffect(() => {
    if (open) {
      setNombre(producto.nombre);
      setPrecioVenta(String(producto.precioVenta));
      setPrecioCosto(String(producto.precioCosto));
    }
  }, [open, producto]);

  // Cálculos en tiempo real
  const pv = toNumber(precioVenta) || 0;
  const pc = toNumber(precioCosto) || 0;
  const gananciaUnitaria = pv - pc;
  const margenPorcentaje = pv > 0 ? (gananciaUnitaria / pv) * 100 : 0;
  const esGananciaNegativa = pv > 0 && pc > 0 && gananciaUnitaria < 0;

  const canSubmit = nombre.trim().length >= 2 && pv > 0 && pc > 0;

  async function save() {
    if (!canSubmit || saving) return;
    setSaving(true);
    try {
      const payload: UpdateProductoInput = {
        nombre: nombre.trim(),
        precioVenta: pv,
        precioCosto: pc,
        // Eliminado packSizeUnits por requerimiento de manejo por UNIDAD
      };

      await apiService.updateProducto(producto.id, payload);
      setOpen(false);
      onUpdated?.();
    } catch (err: any) {
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
            <Pencil className="h-5 w-5" />
            <DialogTitle className="text-xl font-bold tracking-tight">Editar Producto</DialogTitle>
          </div>
          <DialogDescription>
            Modifica los detalles del producto ID: <span className="font-mono text-primary font-bold">#{producto.id}</span>
          </DialogDescription>
        </DialogHeader>

        <div className="p-6 space-y-5">
          <div className="space-y-4">
            {/* Nombre */}
            <div className="space-y-2">
              <Label className="text-sm font-semibold opacity-80 text-muted-foreground">Nombre del producto</Label>
              <div className="relative">
                <Tag className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  className="pl-9 h-11 bg-muted/30 focus-visible:ring-primary border-muted"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {/* Precio Costo */}
              <div className="space-y-2">
                <Label className="text-sm font-semibold opacity-80 text-muted-foreground">Costo Unitario</Label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    value={precioCosto}
                    onChange={(e) => setPrecioCosto(e.target.value)}
                    className="pl-9 h-11 bg-muted/30"
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
                    inputMode="decimal"
                  />
                </div>
              </div>
            </div>

            {/* PANEL DE CÁLCULOS (Compatible con Light/Dark) */}
            {(pv > 0 || pc > 0) && (
              <div className={`rounded-xl border p-4 space-y-2 transition-all duration-300 ${
                esGananciaNegativa 
                ? 'bg-destructive/10 border-destructive/20' 
                : 'bg-emerald-500/5 border-emerald-500/20 dark:bg-emerald-500/10'
              }`}>
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2 text-xs font-bold text-muted-foreground uppercase tracking-wider">
                    <TrendingUp className={`h-3.5 w-3.5 ${esGananciaNegativa ? 'text-destructive' : 'text-emerald-500'}`} />
                    Nueva Rentabilidad
                  </div>
                  <span className={`text-sm font-black ${esGananciaNegativa ? 'text-destructive' : 'text-emerald-500'}`}>
                    ${gananciaUnitaria.toLocaleString()} ({margenPorcentaje.toFixed(1)}%)
                  </span>
                </div>

                {esGananciaNegativa && (
                  <div className="flex items-center gap-1.5 text-destructive text-[10px] font-bold uppercase animate-pulse pt-1 border-t border-destructive/20">
                    <AlertCircle className="h-3 w-3" />
                    Atención: Margen de pérdida detectado
                  </div>
                )}
              </div>
            )}

            {/* Información de Stock (No editable aquí por seguridad, pero visible) */}
            <div className="flex items-center gap-2 p-3 bg-muted/20 rounded-lg border border-dashed border-muted-foreground/20">
              <Package className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground italic">
                Stock actual: <strong className="text-foreground">{producto.stockDisponibleUnits} unidades</strong>
              </span>
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
              onClick={save} 
              className="flex-1 h-11 font-bold shadow-lg"
              disabled={!canSubmit || saving || esGananciaNegativa}
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Actualizar cambios
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}