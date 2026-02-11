"use client";

import * as React from "react";
import { Producto, UpdateProductoInput } from "@/lib/types"; // Importamos el tipo de input
import { apiService } from "@/lib/apiService";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowUpCircle, ArrowDownCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface Props {
  producto: Producto;
  onUpdated: () => void;
  trigger: React.ReactNode;
}

export function AjustarStockDialog({ producto, onUpdated, trigger }: Props) {
  const [open, setOpen] = React.useState(false);
  const [cantidad, setCantidad] = React.useState<number>(0);
  const [loading, setLoading] = React.useState(false);

  // Calculamos la vista previa del stock
  const previewSuma = producto.stockDisponibleUnits + (cantidad || 0);
  const previewResta = Math.max(0, producto.stockDisponibleUnits - (cantidad || 0));

  async function handleAjuste(tipo: "suma" | "resta") {
    if (cantidad <= 0) return;
    setLoading(true);
    
    const nuevaCantidad = tipo === "suma" ? previewSuma : previewResta;

    try {
      // ✅ CORRECCIÓN: Enviamos solo el campo necesario bajo el tipo UpdateProductoInput
      const payload: UpdateProductoInput = {
        stockDisponibleUnits: nuevaCantidad
      };

      await apiService.updateProducto(producto.id, payload);
      
      toast.success(`Stock actualizado: ${nuevaCantidad} unidades`);
      onUpdated();
      setOpen(false);
      setCantidad(0);
    } catch (e) {
      toast.error("Error al ajustar el stock");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-[400px] border-border bg-card">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-2xl font-black">
            Ajustar Stock
          </DialogTitle>
          <div className="text-sm text-muted-foreground">
            Producto: <span className="font-bold text-foreground">{producto.nombre}</span>
          </div>
        </DialogHeader>

        <div className="py-6 space-y-6">
          <div className="flex justify-around items-center bg-muted/30 p-4 rounded-xl border border-border/50">
            <div className="text-center">
              <p className="text-[10px] uppercase font-bold text-muted-foreground">Actual</p>
              <p className="text-3xl font-black">{producto.stockDisponibleUnits}</p>
            </div>
            <div className="h-8 w-px bg-border" />
            <div className="text-center">
              <p className="text-[10px] uppercase font-bold text-muted-foreground">Simulación</p>
              <p className="text-3xl font-black text-primary">
                {/* Mostramos la simulación dependiendo de si el usuario está pensando en sumar o restar */}
                {cantidad > 0 ? "..." : producto.stockDisponibleUnits}
                {cantidad > 0 && (cantidad > producto.stockDisponibleUnits ? previewSuma : "±" + cantidad)}
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="cantidad" className="font-bold">Cantidad de unidades</Label>
            <Input
              id="cantidad"
              type="number"
              placeholder="Ej: 10"
              value={cantidad || ""}
              onChange={(e) => setCantidad(Math.abs(Number(e.target.value)))} // Evitamos negativos
              className="text-lg h-12 text-center font-mono"
              min="0"
            />
          </div>
        </div>

        <DialogFooter className="grid grid-cols-2 gap-2">
          <Button
            variant="outline"
            disabled={loading || cantidad <= 0}
            onClick={() => handleAjuste("resta")}
            className="h-12 border-red-500/20 hover:bg-red-500/10 hover:text-red-500 gap-2 font-bold transition-all"
          >
            <ArrowDownCircle className="h-5 w-5" />
            Quitar {cantidad > 0 && `(${previewResta})`}
          </Button>
          <Button
            disabled={loading || cantidad <= 0}
            onClick={() => handleAjuste("suma")}
            className="h-12 bg-emerald-600 hover:bg-emerald-700 text-white gap-2 font-bold transition-all"
          >
            {loading ? <Loader2 className="animate-spin" /> : <ArrowUpCircle className="h-5 w-5" />}
            Agregar {cantidad > 0 && `(${previewSuma})`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}