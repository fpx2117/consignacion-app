/* eslint-disable */
// @ts-nocheck
"use client";

import * as React from "react";
import type { UpdateProductoInput } from "@/lib/types";
import { apiService } from "@/lib/apiService";
import { CATEGORY_PALETTE, getCategoryColorByKey, type CategoryColorKey } from "@/lib/category-colors";
import { cn } from "@/lib/utils";

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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DollarSign,
  Tag,
  Loader2,
  TrendingUp,
  Package,
  Barcode,
  BellRing,
  Calendar,
  Layers,
  AlertCircle,
  Plus
} from "lucide-react";
import { CreateCategoriaDialog } from "./create-categoria-dialog";
import { toast } from "sonner";

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
  trigger?: React.ReactNode;
  onCreated?: () => void;
}) {
  const [open, setOpen] = React.useState(false);
  const [saving, setSaving] = React.useState(false);

  // Estados del formulario
  const [nombre, setNombre] = React.useState("");
  const [codigoBarra, setCodigoBarra] = React.useState("");
  const [precioVenta, setPrecioVenta] = React.useState("");
  const [precioCosto, setPrecioCosto] = React.useState("");
  const [stockDisponibleUnits, setStockDisponibleUnits] = React.useState("");
  const [stockMinUnits, setStockMinUnits] = React.useState("");
  const [fechaVencimiento, setFechaVencimiento] = React.useState("");

  // Categorías
  const [categorias, setCategorias] = React.useState<{ id: number | string; nombre: string; color?: string }[]>([]);
  const [categoriaId, setCategoriaId] = React.useState<string>("");

  React.useEffect(() => {
    if (open) {
      setNombre("");
      setCodigoBarra("");
      setPrecioVenta("");
      setPrecioCosto("");
      setStockDisponibleUnits("");
      setStockMinUnits("");
      setFechaVencimiento("");
      setCategoriaId("");

      apiService.getCategorias()
        .then((data) => {
          setCategorias(Array.isArray(data) ? data : []);
        })
        .catch(() => setCategorias([]));
    }
  }, [open]);

  const pv = toNumber(precioVenta) || 0;
  const pc = toNumber(precioCosto) || 0;
  const gananciaUnitaria = pv - pc;
  const margenPorcentaje = pv > 0 ? (gananciaUnitaria / pv) * 100 : 0;
  const esGananciaNegativa = pv > 0 && pc > 0 && gananciaUnitaria < 0;

  const canSubmit = nombre.trim().length >= 2 && pv > 0 && pc > 0 && categoriaId !== "";

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit || saving) return;
    setSaving(true);
    try {
      await apiService.createProducto({
        nombre: nombre.trim(),
        codigoBarra: codigoBarra.trim() || undefined,
        precioVenta: pv,
        precioCosto: pc,
        stockDisponibleUnits: toInt(stockDisponibleUnits) || 0,
        stockTotalUnits: toInt(stockDisponibleUnits) || 0,
        stockMinUnits: toInt(stockMinUnits) || 0,
        fechaVencimiento: fechaVencimiento || null,
        categoriaId: Number(categoriaId),
      });
      toast.success("Producto creado con éxito");
      setOpen(false);
      onCreated?.();
    } catch (err: any) {
      toast.error(err.message || "Error al crear producto");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button className="h-11 rounded-full font-bold shadow-lg shadow-primary/20">
            Nuevo Producto
          </Button>
        )}
      </DialogTrigger>

      <DialogContent className="sm:max-w-[550px] p-0 overflow-hidden border-none shadow-2xl bg-background">
        <DialogHeader className="p-6 pb-2 border-b bg-muted/20">
          <div className="flex items-center gap-2 text-primary">
            <Package className="h-5 w-5" />
            <DialogTitle className="text-xl font-bold italic tracking-tight">Nuevo Producto</DialogTitle>
          </div>
          <DialogDescription>Completa la información base del producto</DialogDescription>
        </DialogHeader>

        <form onSubmit={save} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto w-full">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-4 sm:col-span-2">
              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase text-muted-foreground">Nombre</Label>
                <div className="relative">
                  <Tag className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input value={nombre} onChange={(e) => setNombre(e.target.value)} className="pl-9 h-11 bg-muted/30" />
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase text-muted-foreground">Código de Barras</Label>
                <div className="relative">
                  <Barcode className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input value={codigoBarra} onChange={(e) => setCodigoBarra(e.target.value)} className="pl-9 h-11 bg-muted/30" />
                </div>
              </div>
            </div>

            <div className="space-y-2 sm:col-span-2">
              <Label className="text-xs font-bold uppercase text-muted-foreground">Categoría</Label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Layers className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground z-10" />
                  <Select value={categoriaId} onValueChange={setCategoriaId}>
                    <SelectTrigger className="pl-9 h-11 bg-muted/30">
                      <SelectValue placeholder="Seleccionar categoría..." />
                    </SelectTrigger>
                    <SelectContent>
                      {categorias.map((cat) => {
                        const catColor = getCategoryColorByKey(cat.color);
                        return (
                          <SelectItem key={cat.id} value={cat.id.toString()}>
                            <span className="flex items-center gap-2">
                              <span className={cn("h-2 w-2 rounded-full shrink-0", catColor.dot)} />
                              {cat.nombre}
                            </span>
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                </div>
                <CreateCategoriaDialog
                  onCreated={() => {
                    apiService.getCategorias().then((data) => {
                      setCategorias(Array.isArray(data) ? data : []);
                    });
                  }}
                />
              </div>
            </div>

            <div className="space-y-2 sm:col-span-1">
              <Label className="text-sm font-semibold opacity-80">Vencimiento (Opcional)</Label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input type="date" value={fechaVencimiento} onChange={(e) => setFechaVencimiento(e.target.value)} className="pl-9 h-11 bg-muted/30" />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-sm font-semibold opacity-80">Costo Unitario</Label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input value={precioCosto} onChange={(e) => setPrecioCosto(e.target.value)} className="pl-9 h-11 bg-muted/30" placeholder="0.00" inputMode="decimal" />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-semibold opacity-80 text-primary">Precio Venta</Label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-primary" />
                <Input value={precioVenta} onChange={(e) => setPrecioVenta(e.target.value)} className="pl-9 h-11 bg-primary/5 border-primary/20 font-bold text-primary" placeholder="0.00" inputMode="decimal" />
              </div>
            </div>
          </div>

          {(pv > 0 || pc > 0) && (
            <div className={`rounded-xl border p-4 space-y-2 transition-all ${esGananciaNegativa ? 'bg-destructive/10 border-destructive/20' : 'bg-emerald-500/5 border-emerald-500/20'}`}>
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                  <TrendingUp className={`h-3.5 w-3.5 ${esGananciaNegativa ? 'text-destructive' : 'text-emerald-500'}`} />
                  RENTABILIDAD ESTIMADA
                </div>
                <span className={`text-sm font-black ${esGananciaNegativa ? 'text-destructive' : 'text-emerald-500'}`}>
                  $${gananciaUnitaria.toLocaleString()} (${margenPorcentaje.toFixed(1)}%)
                </span>
              </div>
              {esGananciaNegativa && (
                <div className="flex items-center gap-1.5 text-destructive text-[10px] font-bold uppercase">
                  <AlertCircle className="h-3 w-3" /> Atención: Precio de venta bajo el costo
                </div>
              )}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-sm font-semibold opacity-80">Stock Inicial</Label>
              <div className="relative">
                <Package className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input value={stockDisponibleUnits} onChange={(e) => setStockDisponibleUnits(e.target.value)} className="pl-9 h-11 bg-muted/30" placeholder="0" inputMode="numeric" />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-semibold opacity-80">Alerta Stock Bajo</Label>
              <div className="relative">
                <Plus className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-orange-500" />
                <Input value={stockMinUnits} onChange={(e) => setStockMinUnits(e.target.value)} className="pl-9 h-11 bg-orange-500/5 border-orange-500/20" placeholder="5" inputMode="numeric" />
              </div>
            </div>
          </div>

          <div className="flex gap-3 pt-4">
            <Button type="button" variant="outline" className="flex-1 h-11" onClick={() => setOpen(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button type="submit" className="flex-1 h-11 font-bold shadow-lg" disabled={!canSubmit || saving || esGananciaNegativa}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Crear Producto"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
