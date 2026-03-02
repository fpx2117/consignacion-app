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
// Importamos Select de Shadcn
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
  Trash2,
  Layers,
  Plus,
  PlusCircle,
  Check,
  Image as ImageIcon,
  Percent,
  BadgePercent
} from "lucide-react";
import { ImageUpload } from "@/components/image-upload";
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

  // --- ESTADOS DE DESCUENTO ---
  const [tieneDescuento, setTieneDescuento] = React.useState(producto.tieneDescuento ?? false);
  const [descuentoCantidadMin, setDescuentoCantidadMin] = React.useState(producto.descuentoCantidadMin ? String(producto.descuentoCantidadMin) : "");
  const [descuentoPorcentaje, setDescuentoPorcentaje] = React.useState(producto.descuentoPorcentaje ? String(producto.descuentoPorcentaje) : "");

  // --- ESTADOS DE CATEGORÍA ---
  const [categorias, setCategorias] = React.useState<{ id: number | string, nombre: string, color?: string }[]>([]);
  const [categoriaId, setCategoriaId] = React.useState<string>(producto.categoriaId?.toString() || "");
  const [nuevaCategoria, setNuevaCategoria] = React.useState("");
  const [nuevaCatColor, setNuevaCatColor] = React.useState<CategoryColorKey>("sky");
  const [isCreandoNuevaCat, setIsCreandoNuevaCat] = React.useState(false);

  // --- ESTADOS DE EDICIÓN DE CATEGORÍA ---
  const [isEditandoCat, setIsEditandoCat] = React.useState(false);
  const [editCatId, setEditCatId] = React.useState<number | string | null>(null);
  const [editCatNombre, setEditCatNombre] = React.useState("");
  const [editCatColor, setEditCatColor] = React.useState<CategoryColorKey>("sky");
  const [savingCatEdit, setSavingCatEdit] = React.useState(false);

  // Sincronizar y Cargar categorías
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
      setTieneDescuento(producto.tieneDescuento ?? false);
      setDescuentoCantidadMin(producto.descuentoCantidadMin ? String(producto.descuentoCantidadMin) : "");
      setDescuentoPorcentaje(producto.descuentoPorcentaje ? String(producto.descuentoPorcentaje) : "");

      // Cargar lista de categorías desde API
      apiService.getCategorias()
        .then((data) => {
          console.log("Categorías cargadas (edit):", data);
          setCategorias(Array.isArray(data) ? data : []);
        })
        .catch((err) => {
          console.error(err);
          setCategorias([]);
        });
    }
  }, [open, producto]);

  const pv = toNumber(precioVenta) || 0;
  const pc = toNumber(precioCosto) || 0;
  const gananciaUnitaria = pv - pc;
  const margenPorcentaje = pv > 0 ? (gananciaUnitaria / pv) * 100 : 0;
  const esGananciaNegativa = pv > 0 && pc > 0 && gananciaUnitaria < 0;

  // Validación: requiere nombre, precios y categoría (existente o nueva)
  const canSubmit =
    nombre.trim().length >= 2 &&
    pv > 0 &&
    pc > 0 &&
    (categoriaId !== "" || (isCreandoNuevaCat && nuevaCategoria.trim().length > 0));

  async function save() {
    if (!canSubmit || saving) return;
    setSaving(true);
    try {
      let finalCategoriaId: number | null = categoriaId ? Number(categoriaId) : null;

      // 1. Si el usuario creó una categoría nueva en la edición
      if (isCreandoNuevaCat && nuevaCategoria.trim()) {
        const catCreada = await apiService.createCategoria({ nombre: nuevaCategoria.trim(), color: nuevaCatColor });
        finalCategoriaId = Number(catCreada.id);
      }

      const payload: UpdateProductoInput = {
        nombre: nombre.trim(),
        codigoBarra: codigoBarra.trim() || undefined,
        precioVenta: pv,
        precioCosto: pc,
        stockMinUnits: toInt(stockMinUnits) || 0,
        fechaVencimiento: fechaVencimiento || null,
        categoriaId: finalCategoriaId,
        imagenUrl: imagenUrl || null,
        tieneDescuento,
        descuentoCantidadMin: tieneDescuento ? (toInt(descuentoCantidadMin) || null) : null,
        descuentoPorcentaje: tieneDescuento ? (toNumber(descuentoPorcentaje) || null) : null,
      };

      await apiService.updateProducto(producto.id, payload);
      toast.success("Producto actualizado correctamente");
      setOpen(false);
      setIsCreandoNuevaCat(false);
      setNuevaCategoria("");
      onUpdated?.();
    } catch (err: any) {
      toast.error(err.message || "Error al actualizar");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!window.confirm("¿Estás seguro de que deseas eliminar este producto?")) return;

    setDeleting(true);
    try {
      await apiService.deleteProducto(producto.id);
      toast.success("Producto eliminado");
      setOpen(false);
      onUpdated?.();
    } catch (err: any) {
      toast.error("Error al eliminar el producto");
    } finally {
      setDeleting(false);
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

          {/* Identificación y Imagen */}
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

            {/* --- SECCIÓN CATEGORÍA --- */}
            <div className="space-y-2 sm:col-span-2">
              <Label className="text-xs font-bold uppercase text-muted-foreground">Categoría</Label>
              {!isCreandoNuevaCat && !isEditandoCat ? (
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
                  {categoriaId && (
                    <Button
                      type="button"
                      variant="outline"
                      title="Editar categoría seleccionada"
                      className="h-11 px-3 border-border/60 text-muted-foreground hover:text-primary hover:border-primary/40 hover:bg-primary/5"
                      onClick={() => {
                        const cat = categorias.find(c => c.id.toString() === categoriaId);
                        if (cat) {
                          setEditCatId(cat.id);
                          setEditCatNombre(cat.nombre);
                          setEditCatColor((cat.color || "sky") as CategoryColorKey);
                          setIsEditandoCat(true);
                        }
                      }}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                  )}
                  <Button
                    type="button"
                    variant="outline"
                    className="h-11 px-3 border-dashed border-primary/40 text-primary hover:bg-primary/5"
                    onClick={() => { setIsCreandoNuevaCat(true); setCategoriaId(""); setNuevaCatColor("sky"); }}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              ) : isEditandoCat ? (
                /* --- EDIT EXISTING CATEGORY MODE --- */
                <div className="space-y-3 animate-in slide-in-from-left-2 duration-200">
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Pencil className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-amber-500" />
                      <Input
                        value={editCatNombre}
                        onChange={(e) => setEditCatNombre(e.target.value)}
                        placeholder="Nombre de la categoría"
                        className="pl-9 h-11 border-amber-500/40 bg-amber-500/5"
                        autoFocus
                      />
                    </div>
                    <Button
                      type="button"
                      variant="default"
                      className="h-11 px-4 text-xs font-bold"
                      disabled={savingCatEdit || !editCatNombre.trim()}
                      onClick={async () => {
                        if (!editCatId) return;
                        setSavingCatEdit(true);
                        try {
                          await apiService.updateCategoria(Number(editCatId), {
                            nombre: editCatNombre.trim(),
                            color: editCatColor,
                          });
                          const updated = await apiService.getCategorias();
                          setCategorias(updated);
                          setIsEditandoCat(false);
                          setEditCatId(null);
                          toast.success("Categoría actualizada");
                        } catch {
                          toast.error("Error al actualizar");
                        } finally {
                          setSavingCatEdit(false);
                        }
                      }}
                    >
                      {savingCatEdit ? <Loader2 className="h-4 w-4 animate-spin" /> : "Guardar"}
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      className="h-11 text-xs hover:bg-destructive/10 hover:text-destructive"
                      onClick={() => { setIsEditandoCat(false); setEditCatId(null); }}
                    >
                      Cancelar
                    </Button>
                  </div>
                  {/* Edit Color Palette */}
                  <div className="flex flex-wrap gap-1.5 p-2 rounded-xl bg-amber-500/5 border border-amber-500/20">
                    {CATEGORY_PALETTE.map((color) => (
                      <button
                        key={color.key}
                        type="button"
                        onClick={() => setEditCatColor(color.key as CategoryColorKey)}
                        className={cn(
                          "h-7 w-7 rounded-lg transition-all duration-150 flex items-center justify-center",
                          "hover:scale-110 active:scale-95",
                          editCatColor === color.key
                            ? "ring-2 ring-primary ring-offset-1 ring-offset-background scale-110"
                            : "opacity-60 hover:opacity-100"
                        )}
                        style={{ backgroundColor: color.hex }}
                        title={color.label}
                      >
                        {editCatColor === color.key && (
                          <Check className="h-3.5 w-3.5 text-white drop-shadow-md" />
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="space-y-3 animate-in slide-in-from-left-2 duration-200">
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <PlusCircle className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-primary" />
                      <Input
                        value={nuevaCategoria}
                        onChange={(e) => setNuevaCategoria(e.target.value)}
                        placeholder="Nueva categoría..."
                        className="pl-9 h-11 border-primary/40 bg-primary/5"
                        autoFocus
                      />
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      className="h-11 text-xs"
                      onClick={() => { setIsCreandoNuevaCat(false); setNuevaCategoria(""); setNuevaCatColor("sky"); }}
                    >
                      Cancelar
                    </Button>
                  </div>
                  {/* Inline Color Palette */}
                  <div className="flex flex-wrap gap-1.5 p-2 rounded-xl bg-muted/30 border border-border/50">
                    {CATEGORY_PALETTE.map((color) => (
                      <button
                        key={color.key}
                        type="button"
                        onClick={() => setNuevaCatColor(color.key as CategoryColorKey)}
                        className={cn(
                          "h-7 w-7 rounded-lg transition-all duration-150 flex items-center justify-center",
                          "hover:scale-110 active:scale-95",
                          nuevaCatColor === color.key
                            ? "ring-2 ring-primary ring-offset-1 ring-offset-background scale-110"
                            : "opacity-60 hover:opacity-100"
                        )}
                        style={{ backgroundColor: color.hex }}
                        title={color.label}
                      >
                        {nuevaCatColor === color.key && (
                          <Check className="h-3.5 w-3.5 text-white drop-shadow-md" />
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-2 sm:col-span-1">
              <Label className="text-xs font-bold uppercase text-muted-foreground">Vencimiento</Label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input type="date" value={fechaVencimiento} onChange={(e) => setFechaVencimiento(e.target.value)} className="pl-9 h-11 bg-muted/30" />
              </div>
            </div>
          </div>

          {/* Precios */}
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

          {/* Rentabilidad */}
          {(pv > 0 || pc > 0) && (
            <div className={`rounded-xl border p-3 ${esGananciaNegativa ? 'bg-destructive/10 border-destructive/20' : 'bg-emerald-500/5 border-emerald-500/20'}`}>
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2 text-[10px] font-bold text-muted-foreground uppercase">
                  <TrendingUp className={`h-3 w-3 ${esGananciaNegativa ? 'text-destructive' : 'text-emerald-500'}`} />
                  Rentabilidad Proyectada
                </div>
                <span className={`text-sm font-black ${esGananciaNegativa ? 'text-destructive' : 'text-emerald-500'}`}>
                  ${gananciaUnitaria.toLocaleString()} ({margenPorcentaje.toFixed(1)}%)
                </span>
              </div>
            </div>
          )}

          {/* Stock Info & Alerta */}
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

          {/* SECCIÓN: Descuento por Cantidad */}
          <div className="rounded-xl border border-border/50 p-4 space-y-3 bg-muted/10">
            <label className="flex items-center gap-3 cursor-pointer select-none">
              <div className="relative">
                <input
                  type="checkbox"
                  checked={tieneDescuento}
                  onChange={(e) => setTieneDescuento(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-10 h-6 bg-muted rounded-full peer-checked:bg-primary transition-colors" />
                <div className="absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform peer-checked:translate-x-4" />
              </div>
              <div className="flex items-center gap-2">
                <BadgePercent className={`h-4 w-4 ${tieneDescuento ? 'text-primary' : 'text-muted-foreground'}`} />
                <span className={`text-sm font-semibold ${tieneDescuento ? 'text-foreground' : 'text-muted-foreground'}`}>
                  Descuento por Cantidad
                </span>
              </div>
            </label>

            {tieneDescuento && (
              <div className="grid grid-cols-2 gap-3 animate-in slide-in-from-top-2 duration-200">
                <div className="space-y-2">
                  <Label className="text-xs font-bold uppercase text-muted-foreground">Cantidad Mínima</Label>
                  <div className="relative">
                    <Package className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-primary" />
                    <Input
                      value={descuentoCantidadMin}
                      onChange={(e) => setDescuentoCantidadMin(e.target.value)}
                      placeholder="Ej: 3"
                      className="pl-9 h-11 bg-primary/5 border-primary/20"
                      inputMode="numeric"
                    />
                  </div>
                  <p className="text-[10px] text-muted-foreground">Llevando esta cantidad o más</p>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-bold uppercase text-muted-foreground">Descuento (%)</Label>
                  <div className="relative">
                    <Percent className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-primary" />
                    <Input
                      value={descuentoPorcentaje}
                      onChange={(e) => setDescuentoPorcentaje(e.target.value)}
                      placeholder="Ej: 10"
                      className="pl-9 h-11 bg-primary/5 border-primary/20"
                      inputMode="decimal"
                    />
                  </div>
                  <p className="text-[10px] text-muted-foreground">Porcentaje de descuento</p>
                </div>
              </div>
            )}
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