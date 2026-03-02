"use client";

import * as React from "react";
import { toast } from "sonner";
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
  Package,
  DollarSign,
  Tag,
  Loader2,
  PlusCircle,
  TrendingUp,
  AlertCircle,
  Barcode,
  Calendar,
  Layers,
  Plus,
  Check,
  Pencil,
  Image as ImageIcon
} from "lucide-react";
import { ImageUpload } from "@/components/image-upload";

// Helpers de conversión
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

  // Estados del formulario
  const [nombre, setNombre] = React.useState("");
  const [codigoBarra, setCodigoBarra] = React.useState("");
  const [precioVenta, setPrecioVenta] = React.useState("");
  const [precioCosto, setPrecioCosto] = React.useState("");
  const [stockDisponibleUnits, setStockDisponibleUnits] = React.useState("");
  const [stockMinUnits, setStockMinUnits] = React.useState("");
  const [fechaVencimiento, setFechaVencimiento] = React.useState("");
  const [imagenUrl, setImagenUrl] = React.useState<string | null>(null);

  // --- ESTADOS DE CATEGORÍA ---
  // Mantenemos string para compatibilidad con componentes de UI
  const [categorias, setCategorias] = React.useState<{ id: number | string, nombre: string, color?: string }[]>([]);
  const [categoriaId, setCategoriaId] = React.useState<string>("");
  const [nuevaCategoria, setNuevaCategoria] = React.useState("");
  const [nuevaCatColor, setNuevaCatColor] = React.useState<CategoryColorKey>("sky");
  const [isCreandoNuevaCat, setIsCreandoNuevaCat] = React.useState(false);

  // --- ESTADOS DE EDICIÓN DE CATEGORÍA ---
  const [isEditandoCat, setIsEditandoCat] = React.useState(false);
  const [editCatId, setEditCatId] = React.useState<number | string | null>(null);
  const [editCatNombre, setEditCatNombre] = React.useState("");
  const [editCatColor, setEditCatColor] = React.useState<CategoryColorKey>("sky");
  const [savingCatEdit, setSavingCatEdit] = React.useState(false);

  // Cargar categorías al abrir el diálogo
  React.useEffect(() => {
    if (open) {
      apiService.getCategorias()
        .then((data) => {
          console.log("Categorías cargadas:", data);
          setCategorias(Array.isArray(data) ? data : []);
        })
        .catch((err) => {
          console.error("Error loading categories:", err);
          setCategorias([]);
        });
    }
  }, [open]);

  // Cálculos reactivos
  const pv = toNumber(precioVenta) || 0;
  const pc = toNumber(precioCosto) || 0;
  const unidades = toInt(stockDisponibleUnits) || 0;
  const minStock = toInt(stockMinUnits) || 0;

  const gananciaUnitaria = pv - pc;
  const margenPorcentaje = pv > 0 ? (gananciaUnitaria / pv) * 100 : 0;
  const esGananciaNegativa = pv > 0 && pc > 0 && gananciaUnitaria < 0;

  // Validación: requiere nombre, precios y categoría
  const canSubmit =
    nombre.trim().length >= 2 &&
    pv > 0 &&
    pc > 0 &&
    (categoriaId !== "" || (isCreandoNuevaCat && nuevaCategoria.trim().length > 0));

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit || saving) return;
    setSaving(true);

    try {
      let finalCategoriaId: number | undefined = categoriaId ? Number(categoriaId) : undefined;

      // 1. Si se crea una nueva categoría, guardarla primero
      if (isCreandoNuevaCat && nuevaCategoria.trim()) {
        const catCreada = await apiService.createCategoria({ nombre: nuevaCategoria.trim(), color: nuevaCatColor });
        finalCategoriaId = Number(catCreada.id);
      }

      // 2. Crear el producto con el ID numérico
      await apiService.createProducto({
        nombre: nombre.trim(),
        codigoBarra: codigoBarra.trim() || undefined,
        precioVenta: pv,
        precioCosto: pc,
        stockDisponibleUnits: unidades,
        stockMinUnits: minStock,
        fechaVencimiento: fechaVencimiento || undefined,
        categoriaId: finalCategoriaId,
        imagenUrl: imagenUrl || undefined,
      });

      // Éxito: Cerrar y Limpiar
      setOpen(false);
      resetForm();
      onCreated?.();
    } catch (err) {
      console.error("Error al crear producto:", err);
    } finally {
      setSaving(false);
    }
  }

  const resetForm = () => {
    setNombre(""); setCodigoBarra(""); setPrecioVenta(""); setPrecioCosto("");
    setStockDisponibleUnits(""); setStockMinUnits(""); setFechaVencimiento("");
    setCategoriaId(""); setNuevaCategoria(""); setNuevaCatColor("sky"); setIsCreandoNuevaCat(false);
    setImagenUrl(null);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>

      <DialogContent className="sm:max-w-[550px] p-0 overflow-hidden border-none shadow-2xl bg-background">
        <DialogHeader className="p-6 pb-2 border-b bg-muted/20">
          <div className="flex items-center gap-2 text-primary">
            <PlusCircle className="h-5 w-5" />
            <DialogTitle className="text-xl font-bold italic tracking-tight">Nuevo Producto</DialogTitle>
          </div>
          <DialogDescription>
            Registra los datos técnicos y comerciales del artículo.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">

          {/* SECCIÓN: Imagen y Identificación */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 items-start">
            <div className="space-y-2">
              <Label className="text-sm font-semibold opacity-80">Imagen del Producto</Label>
              <ImageUpload value={imagenUrl} onChange={setImagenUrl} />
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label className="text-sm font-semibold opacity-80">Nombre del Producto</Label>
                <div className="relative">
                  <Tag className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Ej: Speed XL 500ml" className="pl-9 h-11 bg-muted/30" />
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-semibold opacity-80">Código de Barras</Label>
                <div className="relative">
                  <Barcode className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input value={codigoBarra} onChange={(e) => setCodigoBarra(e.target.value)} placeholder="Escanear..." className="pl-9 h-11 bg-muted/30" />
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

            {/* --- SELECT DE CATEGORÍA --- */}
            <div className="space-y-2 sm:col-span-2">
              <Label className="text-sm font-semibold opacity-80">Categoría</Label>
              {!isCreandoNuevaCat && !isEditandoCat ? (
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
                    title="Crear nueva categoría"
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
                        placeholder="Nombre de la nueva categoría"
                        className="pl-9 h-11 border-primary/40 bg-primary/5"
                        autoFocus
                      />
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      className="h-11 text-xs hover:bg-destructive/10 hover:text-destructive"
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
              <Label className="text-sm font-semibold opacity-80">Vencimiento (Opcional)</Label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input type="date" value={fechaVencimiento} onChange={(e) => setFechaVencimiento(e.target.value)} className="pl-9 h-11 bg-muted/30" />
              </div>
            </div>
          </div>

          {/* SECCIÓN: Precios */}
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

          {/* PANEL DE RENTABILIDAD */}
          {(pv > 0 || pc > 0) && (
            <div className={`rounded-xl border p-4 space-y-2 transition-all ${esGananciaNegativa ? 'bg-destructive/10 border-destructive/20' : 'bg-emerald-500/5 border-emerald-500/20'}`}>
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                  <TrendingUp className={`h-3.5 w-3.5 ${esGananciaNegativa ? 'text-destructive' : 'text-emerald-500'}`} />
                  RENTABILIDAD ESTIMADA
                </div>
                <span className={`text-sm font-black ${esGananciaNegativa ? 'text-destructive' : 'text-emerald-500'}`}>
                  ${gananciaUnitaria.toLocaleString()} ({margenPorcentaje.toFixed(1)}%)
                </span>
              </div>
              {esGananciaNegativa && (
                <div className="flex items-center gap-1.5 text-destructive text-[10px] font-bold uppercase">
                  <AlertCircle className="h-3 w-3" /> Atención: Precio de venta bajo el costo
                </div>
              )}
            </div>
          )}

          {/* SECCIÓN: Inventario */}
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