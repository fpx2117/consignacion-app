"use client";

import * as React from "react";
import type { Producto, UpdateProductoInput } from "@/lib/types";
import { apiService } from "@/lib/apiService";
import { getCategoryColorByKey } from "@/lib/category-colors";
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
  Percent,
} from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { ImageUpload } from "@/components/image-upload";
import { CreateCategoriaDialog } from "./create-categoria-dialog";
import { toast } from "sonner";

type ProductoEditable = Producto & {
  subcategoriaId?: number | null;
};

type UpdateProductoPayload = UpdateProductoInput & {
  subcategoriaId?: number | null;
};

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
  producto: ProductoEditable;
  onUpdated?: () => void;
}) {
  const [open, setOpen] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const deleting = false;

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
  const [descuentoActivo, setDescuentoActivo] = React.useState(producto.descuentoActivo ?? false);
  const [tipoDescuento, setTipoDescuento] = React.useState<"porcentaje" | "monto">(
    (producto.tipoDescuento as "porcentaje" | "monto") ?? "porcentaje"
  );
  const [descuentoPorcentaje, setDescuentoPorcentaje] = React.useState(
    producto.descuentoPorcentaje ? String(producto.descuentoPorcentaje) : ""
  );
  const [descuentoMonto, setDescuentoMonto] = React.useState(
    producto.descuentoMonto ? String(producto.descuentoMonto) : ""
  );
  const [descuentoDesde, setDescuentoDesde] = React.useState(
    producto.descuentoDesde ? new Date(producto.descuentoDesde).toISOString().slice(0, 16) : ""
  );
  const [descuentoHasta, setDescuentoHasta] = React.useState(
    producto.descuentoHasta ? new Date(producto.descuentoHasta).toISOString().slice(0, 16) : ""
  );

  // --- ESTADOS DE CATEGORÍA ---
  const [categorias, setCategorias] = React.useState<{ id: number | string; nombre: string; color?: string }[]>([]);
  const [categoriaId, setCategoriaId] = React.useState<string>(producto.categoriaId?.toString() || "");
  const [subcategorias, setSubcategorias] = React.useState<{ id: number; nombre: string }[]>([]);
  const [subcategoriaId, setSubcategoriaId] = React.useState<string>(producto.subcategoriaId?.toString() || "");

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
      setDescuentoActivo(producto.descuentoActivo ?? false);
      setTipoDescuento((producto.tipoDescuento as "porcentaje" | "monto") ?? "porcentaje");
      setDescuentoPorcentaje(producto.descuentoPorcentaje ? String(producto.descuentoPorcentaje) : "");
      setDescuentoMonto(producto.descuentoMonto ? String(producto.descuentoMonto) : "");
      setDescuentoDesde(producto.descuentoDesde ? new Date(producto.descuentoDesde).toISOString().slice(0, 16) : "");
      setDescuentoHasta(producto.descuentoHasta ? new Date(producto.descuentoHasta).toISOString().slice(0, 16) : "");

      apiService.getCategorias()
        .then((data) => {
          setCategorias(Array.isArray(data) ? data : []);
        })
        .catch(() => setCategorias([]));

      if (producto.categoriaId) {
        apiService.getSubcategorias(producto.categoriaId)
          .then(setSubcategorias)
          .catch(() => setSubcategorias([]));
      } else {
        setSubcategorias([]);
      }
      setSubcategoriaId(producto.subcategoriaId?.toString() || "");
    }
  }, [open, producto]);

  // Cargar subcategorías al cambiar categoría (solo si es un cambio manual, no inicial)
  const isFirstRender = React.useRef(true);
  React.useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    if (categoriaId) {
      apiService.getSubcategorias(Number(categoriaId))
        .then(setSubcategorias)
        .catch(() => setSubcategorias([]));
      setSubcategoriaId("");
    } else {
      setSubcategorias([]);
      setSubcategoriaId("");
    }
  }, [categoriaId]);

  const pv = toNumber(precioVenta) || 0;
  const pc = toNumber(precioCosto) || 0;
  const dpct = descuentoActivo && tipoDescuento === "porcentaje" ? (toNumber(descuentoPorcentaje) ?? 0) : 0;
  const dmonto = descuentoActivo && tipoDescuento === "monto" ? (toNumber(descuentoMonto) ?? 0) : 0;
  const precioEfectivo = descuentoActivo
    ? tipoDescuento === "porcentaje" && dpct > 0
      ? pv * (1 - dpct / 100)
      : tipoDescuento === "monto" && dmonto > 0
        ? Math.max(0, pv - Math.min(dmonto, pv))
        : pv
    : pv;
  const gananciaUnitaria = precioEfectivo - pc;
  const margenPorcentaje = precioEfectivo > 0 ? (gananciaUnitaria / precioEfectivo) * 100 : 0;
  const esGananciaNegativa = precioEfectivo > 0 && pc > 0 && gananciaUnitaria < 0;
  const muestraDescuento = descuentoActivo && ((tipoDescuento === "porcentaje" && dpct > 0) || (tipoDescuento === "monto" && dmonto > 0));

  const canSubmit = nombre.trim().length >= 2 && pv > 0 && pc > 0;

  async function save() {
    if (!canSubmit || saving) return;
    setSaving(true);
    try {
      const dpct = toNumber(descuentoPorcentaje);
      const dmonto = toNumber(descuentoMonto);
      const payload: UpdateProductoPayload = {
        nombre: nombre.trim(),
        codigoBarra: codigoBarra.trim() || undefined,
        precioVenta: pv,
        precioCosto: pc,
        stockMinUnits: toInt(stockMinUnits) || 0,
        fechaVencimiento: fechaVencimiento || null,
        categoriaId: categoriaId ? Number(categoriaId) : null,
        subcategoriaId: subcategoriaId ? Number(subcategoriaId) : null,
        imagenUrl: imagenUrl || null,
        descuentoActivo,
        tipoDescuento,
        descuentoPorcentaje: tipoDescuento === "porcentaje" ? (dpct ?? null) : null,
        descuentoMonto: tipoDescuento === "monto" ? (dmonto ?? null) : null,
        descuentoDesde: descuentoDesde ? new Date(descuentoDesde).toISOString() : null,
        descuentoHasta: descuentoHasta ? new Date(descuentoHasta).toISOString() : null,
      };

      await apiService.updateProducto(producto.id, payload);
      toast.success("Producto actualizado correctamente");
      setOpen(false);
      onUpdated?.();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Error al actualizar");
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

            {categoriaId && subcategorias.length > 0 && (
              <div className="space-y-2 sm:col-span-2 animate-in fade-in slide-in-from-top-2 duration-300">
                <Label className="text-xs font-bold uppercase text-muted-foreground">Subcategoría (Opcional)</Label>
                <div className="relative">
                  <Tag className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground z-10" />
                  <Select value={subcategoriaId} onValueChange={setSubcategoriaId}>
                    <SelectTrigger className="pl-9 h-11 bg-muted/30">
                      <SelectValue placeholder="Seleccionar subcategoría..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Sin subcategoría</SelectItem>
                      {subcategorias.map((sub) => (
                        <SelectItem key={sub.id} value={sub.id.toString()}>
                          {sub.nombre}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

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
            <div className={`rounded-xl border p-3 space-y-2 ${esGananciaNegativa ? 'bg-destructive/10 border-destructive/20' : 'bg-[color:var(--status-success-strong)]/5 border-[color:var(--status-success-strong)]/20'}`}>
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2 text-[10px] font-bold text-muted-foreground uppercase">
                  <TrendingUp className={`h-3 w-3 ${esGananciaNegativa ? 'text-destructive' : 'text-[color:var(--status-success-strong)]'}`} />
                  Rentabilidad Proyectada
                  {muestraDescuento && (
                    <span className="text-[9px] font-bold text-[color:var(--status-warning)] bg-[color:var(--status-warning)]/10 px-1.5 py-0.5 rounded-full">c/desc.</span>
                  )}
                </div>
                <span className={`text-sm font-black ${esGananciaNegativa ? 'text-destructive' : 'text-[color:var(--status-success-strong)]'}`}>
                  $${gananciaUnitaria.toLocaleString()} (${margenPorcentaje.toFixed(1)}%)
                </span>
              </div>
              {esGananciaNegativa && (
                <div className="flex items-center gap-1.5 text-destructive text-[10px] font-bold uppercase">
                  {muestraDescuento ? "Atención: Precio con descuento bajo el costo" : "Atención: Precio de venta bajo el costo"}
                </div>
              )}
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
              <Label className="text-[10px] font-bold uppercase text-[color:var(--status-warning)]">Mínimo para Alerta</Label>
              <div className="relative">
                <BellRing className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[color:var(--status-warning)]" />
                <Input value={stockMinUnits} onChange={(e) => setStockMinUnits(e.target.value)} className="pl-9 h-11 bg-[color:var(--status-warning)]/5 border-[color:var(--status-warning)]/20" placeholder="5" />
              </div>
            </div>
          </div>

          {/* Sección Descuento */}
          <div className="rounded-xl border border-dashed border-muted-foreground/30 p-4 space-y-3 bg-muted/10">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Percent className="h-4 w-4 text-muted-foreground" />
                <span className="text-xs font-bold uppercase text-muted-foreground">Descuento en catálogo</span>
              </div>
              <Switch checked={descuentoActivo} onCheckedChange={setDescuentoActivo} />
            </div>

            {descuentoActivo && (
              <div className="space-y-3 animate-in fade-in slide-in-from-top-2 duration-200">
                {/* Selector de tipo */}
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setTipoDescuento("porcentaje")}
                    className={cn(
                      "h-9 rounded-lg text-xs font-bold border transition-colors",
                      tipoDescuento === "porcentaje"
                        ? "bg-destructive text-white border-destructive"
                        : "bg-muted/30 text-muted-foreground border-muted-foreground/20 hover:border-muted-foreground/40"
                    )}
                  >
                    % Porcentaje
                  </button>
                  <button
                    type="button"
                    onClick={() => setTipoDescuento("monto")}
                    className={cn(
                      "h-9 rounded-lg text-xs font-bold border transition-colors",
                      tipoDescuento === "monto"
                        ? "bg-destructive text-white border-destructive"
                        : "bg-muted/30 text-muted-foreground border-muted-foreground/20 hover:border-muted-foreground/40"
                    )}
                  >
                    $ Monto fijo
                  </button>
                </div>

                <div className="space-y-2">
                  {tipoDescuento === "porcentaje" ? (
                    <>
                      <Label className="text-xs font-bold uppercase text-muted-foreground">Porcentaje (%)</Label>
                      <div className="relative">
                        <Percent className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          type="number"
                          min={1}
                          max={99}
                          value={descuentoPorcentaje}
                          onChange={(e) => setDescuentoPorcentaje(e.target.value)}
                          className="pl-9 h-11 bg-muted/30"
                          placeholder="ej: 20"
                          inputMode="numeric"
                        />
                      </div>
                    </>
                  ) : (
                    <>
                      <Label className="text-xs font-bold uppercase text-muted-foreground">Monto de descuento ($)</Label>
                      <div className="relative">
                        <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          type="number"
                          min={0.01}
                          value={descuentoMonto}
                          onChange={(e) => setDescuentoMonto(e.target.value)}
                          className="pl-9 h-11 bg-muted/30"
                          placeholder="ej: 500"
                          inputMode="decimal"
                        />
                      </div>
                    </>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label className="text-xs font-bold uppercase text-muted-foreground">Desde (opcional)</Label>
                    <Input
                      type="datetime-local"
                      value={descuentoDesde}
                      onChange={(e) => setDescuentoDesde(e.target.value)}
                      className="h-11 bg-muted/30"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-bold uppercase text-muted-foreground">Hasta (opcional)</Label>
                    <Input
                      type="datetime-local"
                      value={descuentoHasta}
                      onChange={(e) => setDescuentoHasta(e.target.value)}
                      className="h-11 bg-muted/30"
                    />
                  </div>
                </div>

                {/* Preview de precio */}
                {(() => {
                  const dpct = toNumber(descuentoPorcentaje);
                  const dmonto = toNumber(descuentoMonto);
                  const precioFinal = tipoDescuento === "porcentaje"
                    ? (dpct && pv > 0 ? pv * (1 - dpct / 100) : null)
                    : (dmonto && pv > 0 ? pv - Math.min(dmonto, pv) : null);
                  if (!precioFinal || pv <= 0) return null;
                  const ahorro = pv - precioFinal;
                  const pctCalc = Math.round((ahorro / pv) * 100);
                  return (
                    <div className="rounded-lg bg-destructive/5 border border-destructive/20 px-3 py-2 flex items-center justify-between">
                      <span className="text-xs text-muted-foreground line-through">${pv.toLocaleString("es-AR")}</span>
                      <span className="text-sm font-black text-destructive">${precioFinal.toLocaleString("es-AR")}</span>
                      <span className="text-xs font-bold text-destructive bg-destructive/10 px-2 py-0.5 rounded-full">
                        -{pctCalc}%
                      </span>
                    </div>
                  );
                })()}
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
