const fs = require('fs');
const path = require('path');

const file1 = path.join(__dirname, 'src', 'app', '(system-guard)', '(protected)', 'productos', 'components', 'edit-producto-dialog.tsx');

const content = `/* eslint-disable */
// @ts-nocheck
"use client";

import * as React from "react";
import type { Producto, UpdateProductoInput } from "@/lib/types";
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
  Pencil,
  DollarSign,
  Tag,
  Loader2,
  TrendingUp,
  Package,
  Barcode,
  BellRing,
  Calendar,
  Layers,
  AlertCircle
} from "lucide-react";
import { ImageUpload } from "@/components/image-upload";
import { CreateCategoriaDialog } from "./create-categoria-dialog";
import { toast } from "sonner";

function toNumber(v: string): number | undefined {
  const t = String(v).replace(",", ".").trim();
  if (!t) return undefined;
  const n = Number(t);
  return Number.isFinite(n) ? n : undefined;
}

function toInt(v: string): number | undefined {
  const t = String(v).trim();
  if (!t) return undefined;
  const n = Number(t);
  return Number.isFinite(n) ? Math.trunc(n) : undefined;
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
  const [deleting, setDeleting] = React.useState(false);

  // Estados del formulario
  const [nombre, setNombre] = React.useState(producto.nombre);
  const [codigoBarra, setCodigoBarra] = React.useState(producto.codigoBarra || "");
  const [precioVenta, setPrecioVenta] = React.useState(String(producto.precioVenta));
  const [precioCosto, setPrecioCosto] = React.useState(String(producto.precioCosto));
  const [stockMinUnits, setStockMinUnits] = React.useState(String(producto.stockMinUnits || ""));
  const [fechaVencimiento, setFechaVencimiento] = React.useState(
    producto.fechaVencimiento ? new Date(producto.fechaVencimiento).toISOString().split('T')[0] : ""
  );
  const [imagenUrl, setImagenUrl] = React.useState<string | null>(producto.imagenUrl || null);

  // --- ESTADOS DE CATEGORÍA ---
  const [categorias, setCategorias] = React.useState<{ id: number | string; nombre: string; color?: string }[]>([]);
  const [categoriaId, setCategoriaId] = React.useState<string>(producto.categoriaId?.toString() || "");

  React.useEffect(() => {
    if (open) {
      setNombre(producto.nombre);
      setCodigoBarra(producto.codigoBarra || "");
      setPrecioVenta(String(producto.precioVenta));
      setPrecioCosto(String(producto.precioCosto));
      setStockMinUnits(String(producto.stockMinUnits || ""));
      setFechaVencimiento(producto.fechaVencimiento ? new Date(producto.fechaVencimiento).toISOString().split('T')[0] : "");
      setCategoriaId(producto.categoriaId?.toString() || "");
      setImagenUrl(producto.imagenUrl || null);

      apiService.getCategorias()
        .then((data) => {
          setCategorias(Array.isArray(data) ? data : []);
        })
        .catch(() => setCategorias([]));
    }
  }, [open, producto]);

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
        codigoBarra: codigoBarra.trim() || undefined,
        precioVenta: pv,
        precioCosto: pc,
        stockMinUnits: toInt(stockMinUnits) || 0,
        fechaVencimiento: fechaVencimiento || null,
        categoriaId: categoriaId ? Number(categoriaId) : null,
        imagenUrl: imagenUrl || null,
      };

      await apiService.updateProducto(producto.id, payload);
      toast.success("Producto actualizado correctamente");
      setOpen(false);
      onUpdated?.();
    } catch (err: any) {
      toast.error(err.message || "Error al actualizar");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>

      <DialogContent className="sm:max-w-[550px] p-0 overflow-hidden border-none shadow-2xl bg-background">
        <DialogHeader className="p-6 pb-2 border-b bg-muted/20">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-primary">
              <Pencil className="h-5 w-5" />
              <DialogTitle className="text-xl font-bold italic tracking-tight">Editar Producto</DialogTitle>
            </div>
          </div>
          <DialogDescription>
            Ajusta la ficha técnica y comercial del producto.
          </DialogDescription>
        </DialogHeader>

        <div className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 items-start">
            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase text-muted-foreground">Imagen del Producto</Label>
              <ImageUpload value={imagenUrl} onChange={setImagenUrl} />
            </div>

            <div className="space-y-4">
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
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2 sm:col-span-2">
              <Label className="text-xs font-bold uppercase text-muted-foreground">Categoría</Label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Layers className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground z-10" />
                  <Select value={categoriaId} onValueChange={setCategoriaId}>
                    <SelectTrigger className="pl-9 h-11 bg-muted/30">
                      <SelectValue placeholder="Sin categoría" />
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
              <Label className="text-xs font-bold uppercase text-muted-foreground">Vencimiento</Label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input type="date" value={fechaVencimiento} onChange={(e) => setFechaVencimiento(e.target.value)} className="pl-9 h-11 bg-muted/30" />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase text-muted-foreground">Costo</Label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input value={precioCosto} onChange={(e) => setPrecioCosto(e.target.value)} className="pl-9 h-11 bg-muted/30" inputMode="decimal" />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase text-primary">Precio Venta</Label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-primary" />
                <Input value={precioVenta} onChange={(e) => setPrecioVenta(e.target.value)} className="pl-9 h-11 bg-primary/5 border-primary/20 font-bold" inputMode="decimal" />
              </div>
            </div>
          </div>

          {(pv > 0 || pc > 0) && (
            <div className={\`rounded-xl border p-3 \${esGananciaNegativa ? 'bg-destructive/10 border-destructive/20' : 'bg-emerald-500/5 border-emerald-500/20'}\`}>
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2 text-[10px] font-bold text-muted-foreground uppercase">
                  <TrendingUp className={\`h-3 w-3 \${esGananciaNegativa ? 'text-destructive' : 'text-emerald-500'}\`} />
                  Rentabilidad Proyectada
                </div>
                <span className={\`text-sm font-black \${esGananciaNegativa ? 'text-destructive' : 'text-emerald-500'}\`}>
                  $\${gananciaUnitaria.toLocaleString()} (\${margenPorcentaje.toFixed(1)}%)
                </span>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="flex items-center gap-2 p-3 bg-muted/20 rounded-lg border border-dashed">
              <Package className="h-4 w-4 text-muted-foreground" />
              <div className="flex flex-col">
                <span className="text-[10px] uppercase font-bold text-muted-foreground">Stock Actual</span>
                <span className="text-sm font-bold">{producto.stockDisponibleUnits} u.</span>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-[10px] font-bold uppercase text-orange-500">Mínimo para Alerta</Label>
              <div className="relative">
                <BellRing className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-orange-500" />
                <Input value={stockMinUnits} onChange={(e) => setStockMinUnits(e.target.value)} className="pl-9 h-11 bg-orange-500/5 border-orange-500/20" placeholder="5" />
              </div>
            </div>
          </div>

          <div className="flex gap-3 pt-4">
            <Button type="button" variant="outline" className="flex-1 h-11" onClick={() => setOpen(false)} disabled={saving || deleting}>
              Cancelar
            </Button>
            <Button onClick={save} className="flex-1 h-11 font-bold shadow-lg" disabled={!canSubmit || saving || deleting || esGananciaNegativa}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Guardar Cambios
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
`;

fs.writeFileSync(file1, content);
console.log("Edit producto dialog rebuilt");
