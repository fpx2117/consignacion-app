"use client";

import * as React from "react";
import type { CreateProductoInput } from "@/lib/types";
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
  DollarSign,
  Tag,
  Loader2,
  TrendingUp,
  Package,
  Barcode,
  Calendar,
  Layers,
  AlertCircle,
  Plus,
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

export interface ProductoCreado {
  id: number;
  nombre: string;
  sku?: string | null;
  codigoBarra?: string | null;
  stockDisponibleUnits: number;
}

export interface CreateProductoInitialValues {
  nombre?: string;
  precioCosto?: number;
  stockDisponibleUnits?: number;
  codigoBarra?: string | null;
  atributosExtra?: Record<string, string> | null;
}

export function CreateProductoDialog({
  trigger,
  onCreated,
  onProductoCreado,
  initialValues,
  submitFn,
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
}: {
  trigger?: React.ReactNode;
  onCreated?: () => void;
  onProductoCreado?: (producto: ProductoCreado) => void;
  /** Prellenado opcional (ej: desde un item de factura OCR). El usuario puede editar todo antes de crear. */
  initialValues?: CreateProductoInitialValues;
  /** Override del submit por defecto (apiService.createProducto). Lo usa el flujo de OCR para pegarle al
   * endpoint que además suma stock/costo/alias asociados a un item de factura, en vez del alta genérica. */
  submitFn?: (payload: CreateProductoInput) => Promise<ProductoCreado>;
  /** Control externo del dialog (para abrirlo programáticamente, ej. desde la pantalla de revisión de OCR). */
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

  // Estados del formulario
  const [nombre, setNombre] = React.useState("");
  const [codigoBarra, setCodigoBarra] = React.useState("");
  const [barcodeCameraOpen, setBarcodeCameraOpen] = React.useState(false);
  const [precioVenta, setPrecioVenta] = React.useState("");
  const [precioCosto, setPrecioCosto] = React.useState("");
  const [stockDisponibleUnits, setStockDisponibleUnits] = React.useState("");
  const [stockMinUnits, setStockMinUnits] = React.useState("");
  const [fechaVencimiento, setFechaVencimiento] = React.useState("");
  const [imagenUrl, setImagenUrl] = React.useState<string | null>(null);

  // Descuento
  const [descuentoActivo, setDescuentoActivo] = React.useState(false);
  const [tipoDescuento, setTipoDescuento] = React.useState<"porcentaje" | "monto">("porcentaje");
  const [descuentoPorcentaje, setDescuentoPorcentaje] = React.useState("");
  const [descuentoMonto, setDescuentoMonto] = React.useState("");
  const [descuentoDesde, setDescuentoDesde] = React.useState("");
  const [descuentoHasta, setDescuentoHasta] = React.useState("");

  // Categorías
  const [categorias, setCategorias] = React.useState<{ id: number | string; nombre: string; color?: string }[]>([]);
  const [categoriaId, setCategoriaId] = React.useState<string>("");
  const [subcategorias, setSubcategorias] = React.useState<{ id: number; nombre: string }[]>([]);
  const [subcategoriaId, setSubcategoriaId] = React.useState<string>("");

  // Atributos adicionales (lote, vencimiento, talle, color, etc.)
  const [atributosExtra, setAtributosExtra] = React.useState<Record<string, string> | null>(null);
  const [mostrarAtributos, setMostrarAtributos] = React.useState(false);
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
      // Precio de venta NUNCA se prellena desde el costo de factura — el usuario
      // siempre lo completa a mano (ver reglas de negocio de OCR de facturas).
      setNombre(initialValues?.nombre ?? "");
      setCodigoBarra(initialValues?.codigoBarra ?? "");
      setBarcodeCameraOpen(false);
      setPrecioVenta("");
      setPrecioCosto(initialValues?.precioCosto !== undefined ? String(initialValues.precioCosto) : "");
      setStockDisponibleUnits(initialValues?.stockDisponibleUnits !== undefined ? String(initialValues.stockDisponibleUnits) : "");
      setStockMinUnits("");
      setFechaVencimiento("");
      setImagenUrl(null);
      setImageUploading(false);
      setCategoriaId("");
      setDescuentoActivo(false);
      setTipoDescuento("porcentaje");
      setDescuentoPorcentaje("");
      setDescuentoMonto("");
      setDescuentoDesde("");
      setDescuentoHasta("");
      setAtributosExtra(initialValues?.atributosExtra ?? null);
      setMostrarAtributos(!!initialValues?.atributosExtra && Object.keys(initialValues.atributosExtra).length > 0);

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

      setSubcategorias([]);
      setSubcategoriaId("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- initialValues se lee sólo al abrir, no en cada render
  }, [open]);

  // Cargar subcategorías al cambiar categoría
  React.useEffect(() => {
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

  const canSubmit = nombre.trim().length >= 2 && pv > 0 && pc > 0 && categoriaId !== "";

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit || saving) return;
    setSaving(true);
    try {
      const dpct = toNumber(descuentoPorcentaje);
      const dmonto = toNumber(descuentoMonto);
      const payload = {
        nombre: nombre.trim(),
        codigoBarra: codigoBarra.trim() || undefined,
        precioVenta: pv,
        precioCosto: pc,
        stockDisponibleUnits: toInt(stockDisponibleUnits) || 0,
        stockTotalUnits: toInt(stockDisponibleUnits) || 0,
        stockMinUnits: toInt(stockMinUnits) || 0,
        fechaVencimiento: fechaVencimiento || null,
        categoriaId: Number(categoriaId),
        subcategoriaId: subcategoriaId ? Number(subcategoriaId) : undefined,
        imagenUrl,
        descuentoActivo,
        tipoDescuento,
        descuentoPorcentaje: tipoDescuento === "porcentaje" ? (dpct ?? null) : null,
        descuentoMonto: tipoDescuento === "monto" ? (dmonto ?? null) : null,
        descuentoDesde: descuentoDesde ? new Date(descuentoDesde).toISOString() : null,
        descuentoHasta: descuentoHasta ? new Date(descuentoHasta).toISOString() : null,
        atributosExtra,
      };

      const crear = submitFn ?? ((p: CreateProductoInput) =>
        apiService.createProducto(p).then((created) => ({
          id: Number(created.id),
          nombre: created.nombre,
          sku: (created as { sku?: string | null }).sku ?? null,
          codigoBarra: created.codigoBarra ?? null,
          stockDisponibleUnits: Number((created as { stockDisponibleUnits?: unknown }).stockDisponibleUnits ?? 0),
        })));

      const created = await crear(payload as unknown as CreateProductoInput);
      toast.success("Producto creado con éxito");
      setOpen(false);
      onCreated?.();
      onProductoCreado?.(created);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Error al crear producto");
    } finally {
      setSaving(false);
    }
  }

  // Cuando el dialog es controlado externamente (open/onOpenChange provistos, ej. desde
  // la revisión de OCR) y no se pasó un trigger explícito, no renderizamos ningún botón
  // propio — el padre decide cuándo abrirlo (ej. al tocar "Crear producto nuevo" en una fila).
  const mostrarTriggerPropio = trigger !== undefined || controlledOpen === undefined;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {mostrarTriggerPropio && (
        <DialogTrigger asChild>
          {trigger || (
            <Button className="h-11 rounded-full font-bold shadow-lg shadow-primary/20">
              Nuevo Producto
            </Button>
          )}
        </DialogTrigger>
      )}

      <DialogContent className="sm:max-w-[550px] p-0 overflow-hidden border-none shadow-2xl bg-background">
        <DialogHeader className="p-6 pb-2 border-b bg-muted/20">
          <div className="flex items-center gap-2 text-primary">
            <Package className="h-5 w-5" />
            <DialogTitle className="text-xl font-bold italic tracking-tight">Nuevo Producto</DialogTitle>
          </div>
          <DialogDescription>Completa la información base del producto</DialogDescription>
        </DialogHeader>

        <form onSubmit={save} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto w-full">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 items-start">
            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase text-muted-foreground">Imagen del Producto</Label>
              <ImageUpload value={imagenUrl} onChange={setImagenUrl} onUploadingChange={setImageUploading} />
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
                <div className="space-y-2">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                    <div className="relative flex-1">
                      <Barcode className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        ref={codigoBarraInputRef}
                        value={codigoBarra}
                        onChange={(e) => setCodigoBarra(e.target.value)}
                        className="pl-9 h-11 bg-muted/30"
                        inputMode="numeric"
                        autoComplete="off"
                        placeholder="Escaneá o escribí el código"
                        aria-describedby="codigo-barra-help"
                      />
                    </div>
                    <Button
                      type="button"
                      variant="secondary"
                      className="h-11 rounded-lg px-4 sm:shrink-0"
                      onClick={() => setBarcodeCameraOpen(true)}
                      aria-label="Escanear código de barras con cámara"
                    >
                      <Barcode className="mr-2 h-4 w-4" />
                      Escanear con cámara
                    </Button>
                  </div>
                  <p id="codigo-barra-help" className="text-[11px] text-muted-foreground">
                    Si usás pistola o scanner físico, apoyate en este campo y escaneá directo. El botón es solo para usar la cámara.
                  </p>
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
            <div className={`rounded-xl border p-4 space-y-2 transition-all ${esGananciaNegativa ? 'bg-destructive/10 border-destructive/20' : 'bg-[color:var(--status-success-strong)]/5 border-[color:var(--status-success-strong)]/20'}`}>
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                  <TrendingUp className={`h-3.5 w-3.5 ${esGananciaNegativa ? 'text-destructive' : 'text-[color:var(--status-success-strong)]'}`} />
                  RENTABILIDAD ESTIMADA
                  {muestraDescuento && (
                    <span className="text-[10px] font-bold text-[color:var(--status-warning)] bg-[color:var(--status-warning)]/10 px-1.5 py-0.5 rounded-full">c/desc.</span>
                  )}
                </div>
                <span className={`text-sm font-black ${esGananciaNegativa ? 'text-destructive' : 'text-[color:var(--status-success-strong)]'}`}>
                  $${gananciaUnitaria.toLocaleString()} (${margenPorcentaje.toFixed(1)}%)
                </span>
              </div>
              {esGananciaNegativa && (
                <div className="flex items-center gap-1.5 text-destructive text-[10px] font-bold uppercase">
                  <AlertCircle className="h-3 w-3" />
                  {muestraDescuento ? "Atención: Precio con descuento bajo el costo" : "Atención: Precio de venta bajo el costo"}
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
                <Plus className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[color:var(--status-warning)]" />
                <Input value={stockMinUnits} onChange={(e) => setStockMinUnits(e.target.value)} className="pl-9 h-11 bg-[color:var(--status-warning)]/5 border-[color:var(--status-warning)]/20" placeholder="5" inputMode="numeric" />
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

          {/* Sección Atributos adicionales — colapsada por default */}
          <div className="rounded-xl border border-dashed border-muted-foreground/30 p-4 space-y-3 bg-muted/10">
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

          <div className="flex gap-3 pt-4">
            <Button type="button" variant="outline" className="flex-1 h-11" onClick={() => setOpen(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button type="submit" className="flex-1 h-11 font-bold shadow-lg" disabled={!canSubmit || saving || imageUploading || esGananciaNegativa}>
              {saving || imageUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Crear Producto"}
            </Button>
          </div>
        </form>
      </DialogContent>
      <BarcodeCameraSheet open={barcodeCameraOpen} onOpenChange={setBarcodeCameraOpen} onDetected={applyBarcode} />
    </Dialog>
  );
}
