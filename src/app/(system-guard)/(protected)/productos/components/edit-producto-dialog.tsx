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
import { AtributosExtraEditor } from "./atributos-extra-editor";
import { getAtributosTipicos } from "@/modules/invoices/config/rubros";
import { toast } from "sonner";
import { useBarcodeScanner } from "@/hooks/useBarcodeScanner";
import { BarcodeCameraSheet } from "./barcode-camera-sheet";

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
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
}: {
  trigger: React.ReactNode;
  producto: ProductoEditable;
  onUpdated?: () => void;
  /** Control externo opcional (ej. para trackear si este dialog anidado está
   * abierto desde un padre, y así evitar que un Escape/click-afuera dentro
   * de este dialog cierre en cascada el dialog padre). Sin estos props, el
   * componente sigue siendo no controlado como antes. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const [internalOpen, setInternalOpen] = React.useState(false);
  const open = controlledOpen ?? internalOpen;
  const setOpen = React.useCallback((value: boolean) => {
    controlledOnOpenChange?.(value);
    if (controlledOpen === undefined) setInternalOpen(value);
  }, [controlledOnOpenChange, controlledOpen]);
  const [saving, setSaving] = React.useState(false);
  const [imageUploading, setImageUploading] = React.useState(false);
  const deleting = false;

  // Estados del formulario
  const [nombre, setNombre] = React.useState(producto.nombre);
  const [codigoBarra, setCodigoBarra] = React.useState(producto.codigoBarra || "");
  const [barcodeCameraOpen, setBarcodeCameraOpen] = React.useState(false);
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

  // Atributos adicionales (lote, vencimiento, talle, color, etc.)
  const [atributosExtra, setAtributosExtra] = React.useState<Record<string, string> | null>(producto.atributosExtra ?? null);
  const [mostrarAtributos, setMostrarAtributos] = React.useState(!!producto.atributosExtra && Object.keys(producto.atributosExtra).length > 0);
  const [sugerenciasAtributos, setSugerenciasAtributos] = React.useState<string[]>([]);
  const codigoBarraInputRef = React.useRef<HTMLInputElement | null>(null);

  const applyBarcode = React.useCallback((code: string) => {
    setCodigoBarra(code);
    requestAnimationFrame(() => {
      codigoBarraInputRef.current?.focus();
      codigoBarraInputRef.current?.select();
    });
  }, []);

  useBarcodeScanner({
    enabled: open,
    onScan: applyBarcode,
  });

  React.useEffect(() => {
    if (open) {
      setNombre(producto.nombre);
      setCodigoBarra(producto.codigoBarra || "");
      setBarcodeCameraOpen(false);
      setPrecioVenta(String(producto.precioVenta));
      setPrecioCosto(String(producto.precioCosto));
      setStockMinUnits(String(producto.stockMinUnits || ""));
      setFechaVencimiento(producto.fechaVencimiento ? new Date(producto.fechaVencimiento).toISOString().split('T')[0] : "");
      setCategoriaId(producto.categoriaId?.toString() || "");
      setImagenUrl(producto.imagenUrl || null);
      setImageUploading(false);
      setDescuentoActivo(producto.descuentoActivo ?? false);
      setTipoDescuento((producto.tipoDescuento as "porcentaje" | "monto") ?? "porcentaje");
      setDescuentoPorcentaje(producto.descuentoPorcentaje ? String(producto.descuentoPorcentaje) : "");
      setDescuentoMonto(producto.descuentoMonto ? String(producto.descuentoMonto) : "");
      setDescuentoDesde(producto.descuentoDesde ? new Date(producto.descuentoDesde).toISOString().slice(0, 16) : "");
      setDescuentoHasta(producto.descuentoHasta ? new Date(producto.descuentoHasta).toISOString().slice(0, 16) : "");
      setAtributosExtra(producto.atributosExtra ?? null);
      setMostrarAtributos(!!producto.atributosExtra && Object.keys(producto.atributosExtra).length > 0);

      apiService.getCategorias()
        .then((data) => {
          setCategorias(Array.isArray(data) ? data : []);
        })
        .catch(() => setCategorias([]));

      apiService.getConfiguracionGeneral()
        .then((config) => {
          const hint = getAtributosTipicos(config?.rubroNegocio);
          setSugerenciasAtributos(hint ? hint.split(", ").filter(Boolean) : []);
        })
        .catch(() => setSugerenciasAtributos([]));

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
        codigoBarra: codigoBarra.trim() || null,
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
        atributosExtra,
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

      <DialogContent className="max-w-xl sm:max-w-2xl p-0 overflow-hidden border-none shadow-2xl bg-background">
        <DialogHeader className="px-5 pt-5 pb-3 border-b bg-muted/20">
          <div className="flex items-center gap-2 text-primary">
            <Pencil className="h-5 w-5" />
            <DialogTitle className="text-xl font-bold italic tracking-tight">Editar Producto</DialogTitle>
          </div>
          <DialogDescription>
            Ajustá la ficha técnica y comercial del producto.
          </DialogDescription>
        </DialogHeader>

        <div className="px-5 py-4 space-y-3 max-h-[80vh] overflow-y-auto">

          {/* Fila 1: imagen + nombre + código de barras */}
          <div className="flex gap-4 items-start">
            {/* Imagen — cuadrado compacto */}
            <div className="shrink-0 w-[88px] space-y-1">
              <Label className="text-[10px] font-bold uppercase text-muted-foreground">Imagen</Label>
              <ImageUpload value={imagenUrl} onChange={setImagenUrl} onUploadingChange={setImageUploading} />
            </div>

            {/* Nombre + código de barras */}
            <div className="min-w-0 flex-1 space-y-2.5">
              <div className="space-y-1">
                <Label className="text-xs font-bold uppercase text-muted-foreground">Nombre</Label>
                <div className="relative">
                  <Tag className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input value={nombre} onChange={(e) => setNombre(e.target.value)} className="pl-9 h-10 bg-muted/30" />
                </div>
              </div>

              <div className="space-y-1">
                <Label htmlFor="edit-codigo-barra" className="text-xs font-bold uppercase text-muted-foreground">
                  Código de barras
                </Label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Barcode className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="edit-codigo-barra"
                      ref={codigoBarraInputRef}
                      value={codigoBarra}
                      onChange={(e) => setCodigoBarra(e.target.value)}
                      className="h-10 bg-muted/30 pl-9"
                      inputMode="numeric"
                      autoComplete="off"
                      placeholder="Ej.: 7791234567890"
                      aria-describedby="edit-codigo-barra-hint"
                    />
                  </div>
                  <Button
                    type="button"
                    variant="secondary"
                    className="h-10 rounded-lg px-3 shrink-0"
                    onClick={() => setBarcodeCameraOpen(true)}
                    aria-label="Escanear código de barras con cámara"
                  >
                    <Barcode className="h-4 w-4" />
                    <span className="hidden sm:inline ml-2">Cámara</span>
                  </Button>
                </div>
                <p id="edit-codigo-barra-hint" className="text-[11px] text-muted-foreground leading-tight">
                  <span className="font-medium text-foreground">Manual</span>, <span className="font-medium text-foreground">pistola</span> o <span className="font-medium text-foreground">cámara</span> — dejá el cursor aquí al escanear con pistola.
                </p>
              </div>
            </div>
          </div>

          {/* Fila 2: categoría + subcategoría + vencimiento */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1 sm:col-span-2">
              <Label className="text-xs font-bold uppercase text-muted-foreground">Categoría</Label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Layers className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground z-10" />
                  <Select value={categoriaId} onValueChange={setCategoriaId}>
                    <SelectTrigger className="pl-9 h-10 bg-muted/30">
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
              <div className="space-y-1 sm:col-span-2 animate-in fade-in slide-in-from-top-2 duration-300">
                <Label className="text-xs font-bold uppercase text-muted-foreground">Subcategoría (Opcional)</Label>
                <div className="relative">
                  <Tag className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground z-10" />
                  <Select value={subcategoriaId} onValueChange={setSubcategoriaId}>
                    <SelectTrigger className="pl-9 h-10 bg-muted/30">
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

            <div className="space-y-1">
              <Label className="text-xs font-bold uppercase text-muted-foreground">Vencimiento</Label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input type="date" value={fechaVencimiento} onChange={(e) => setFechaVencimiento(e.target.value)} className="pl-9 h-10 bg-muted/30" />
              </div>
            </div>
          </div>

          {/* Fila 3: precios */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs font-bold uppercase text-muted-foreground">Costo</Label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input value={precioCosto} onChange={(e) => setPrecioCosto(e.target.value)} className="pl-9 h-10 bg-muted/30" inputMode="decimal" />
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-bold uppercase text-primary">Precio venta</Label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-primary" />
                <Input value={precioVenta} onChange={(e) => setPrecioVenta(e.target.value)} className="pl-9 h-10 bg-primary/5 border-primary/20 font-bold" inputMode="decimal" />
              </div>
            </div>
          </div>

          {/* Rentabilidad */}
          {(pv > 0 || pc > 0) && (
            <div className={`rounded-lg border px-4 py-2.5 flex items-center justify-between gap-2 ${esGananciaNegativa ? 'bg-destructive/10 border-destructive/20' : 'bg-[color:var(--status-success-strong)]/5 border-[color:var(--status-success-strong)]/20'}`}>
              <div className="flex items-center gap-1.5 text-[10px] font-bold text-muted-foreground uppercase">
                <TrendingUp className={`h-3 w-3 ${esGananciaNegativa ? 'text-destructive' : 'text-[color:var(--status-success-strong)]'}`} />
                Rentabilidad proyectada
                {muestraDescuento && (
                  <span className="text-[9px] font-bold text-[color:var(--status-warning)] bg-[color:var(--status-warning)]/10 px-1.5 py-0.5 rounded-full">c/desc.</span>
                )}
              </div>
              <span className={`text-sm font-black shrink-0 ${esGananciaNegativa ? 'text-destructive' : 'text-[color:var(--status-success-strong)]'}`}>
                ${gananciaUnitaria.toLocaleString()} ({margenPorcentaje.toFixed(1)}%)
              </span>
            </div>
          )}

          {/* Fila 4: stock actual (readonly) + alerta mínimo */}
          <div className="grid grid-cols-2 gap-3">
            <div className="flex items-center gap-2 p-3 bg-muted/20 rounded-lg border border-dashed">
              <Package className="h-4 w-4 text-muted-foreground shrink-0" />
              <div className="flex flex-col min-w-0">
                <span className="text-[10px] uppercase font-bold text-muted-foreground">Stock actual</span>
                <span className="text-sm font-bold truncate">{producto.stockDisponibleUnits} u.</span>
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-[10px] font-bold uppercase text-[color:var(--status-warning)]">Mínimo para alerta</Label>
              <div className="relative">
                <BellRing className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[color:var(--status-warning)]" />
                <Input value={stockMinUnits} onChange={(e) => setStockMinUnits(e.target.value)} className="pl-9 h-10 bg-[color:var(--status-warning)]/5 border-[color:var(--status-warning)]/20" placeholder="5" />
              </div>
            </div>
          </div>

          {/* Sección Descuento */}
          <div className="rounded-xl border border-dashed border-muted-foreground/30 p-3 space-y-3 bg-muted/10">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Percent className="h-4 w-4 text-muted-foreground" />
                <span className="text-xs font-bold uppercase text-muted-foreground">Descuento en catálogo</span>
              </div>
              <Switch checked={descuentoActivo} onCheckedChange={setDescuentoActivo} />
            </div>

            {descuentoActivo && (
              <div className="space-y-3 animate-in fade-in slide-in-from-top-2 duration-200">
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

                <div className="space-y-1">
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
                          className="pl-9 h-10 bg-muted/30"
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
                          className="pl-9 h-10 bg-muted/30"
                          placeholder="ej: 500"
                          inputMode="decimal"
                        />
                      </div>
                    </>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs font-bold uppercase text-muted-foreground">Desde (opcional)</Label>
                    <Input
                      type="datetime-local"
                      value={descuentoDesde}
                      onChange={(e) => setDescuentoDesde(e.target.value)}
                      className="h-10 bg-muted/30"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs font-bold uppercase text-muted-foreground">Hasta (opcional)</Label>
                    <Input
                      type="datetime-local"
                      value={descuentoHasta}
                      onChange={(e) => setDescuentoHasta(e.target.value)}
                      className="h-10 bg-muted/30"
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

          {/* Sección Atributos adicionales — colapsada por default */}
          <div className="rounded-xl border border-dashed border-muted-foreground/30 p-3 space-y-3 bg-muted/10">
            <button
              type="button"
              onClick={() => setMostrarAtributos((v) => !v)}
              className="flex items-center justify-between w-full text-left"
            >
              <span className="text-xs font-bold uppercase text-muted-foreground">Atributos adicionales (opcional)</span>
              <span className="text-[10px] text-muted-foreground">{mostrarAtributos ? "Ocultar" : "Mostrar"}</span>
            </button>
            {mostrarAtributos && (
              <div className="animate-in fade-in slide-in-from-top-2 duration-200">
                <AtributosExtraEditor
                  value={atributosExtra}
                  onChange={setAtributosExtra}
                  sugerencias={sugerenciasAtributos}
                  disabled={saving}
                />
              </div>
            )}
          </div>

          <div className="flex gap-3 pt-2">
            <Button type="button" variant="outline" className="flex-1 h-10" onClick={() => setOpen(false)} disabled={saving || deleting}>
              Cancelar
            </Button>
            <Button onClick={save} className="flex-1 h-10 font-bold shadow-lg" disabled={!canSubmit || saving || imageUploading || deleting || esGananciaNegativa}>
              {saving || imageUploading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Guardar Cambios
            </Button>
          </div>
        </div>
      </DialogContent>
      <BarcodeCameraSheet open={barcodeCameraOpen} onOpenChange={setBarcodeCameraOpen} onDetected={applyBarcode} />
    </Dialog>
  );
}
