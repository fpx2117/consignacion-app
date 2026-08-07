"use client";

import * as React from "react";
import type {
  CreateProductoInput,
  Producto,
  UpdateProductoInput,
} from "@/lib/types";
import { apiService } from "@/lib/apiService";
import { getCategoryColorByKey } from "@/lib/category-colors";
import { cn } from "@/lib/utils";
import { digitosAMonto, formatearInputMonto } from "@/lib/money-input";

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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
  Percent,
  Pencil,
  BellRing,
  Camera,
  ScanLine,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { ImageUpload } from "@/components/image-upload";
import { CreateCategoriaDialog } from "./create-categoria-dialog";
import { AtributosExtraEditor } from "./atributos-extra-editor";
import { AtributosFijosForm } from "./atributos-fijos-form";
import {
  getAtributosTipicos,
  getRubroLabel,
} from "@/modules/invoices/config/rubros";
import {
  componerNombreProducto,
  getAtributosFijos,
} from "@/modules/invoices/config/rubro-atributos";
import { validarAtributosFijosProducto } from "@/lib/validators/producto-atributos-fijos";
import { toast } from "sonner";
import { useBarcodeScanner } from "@/hooks/useBarcodeScanner";
import { BarcodeCameraSheet } from "./barcode-camera-sheet";

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

export type ProductoEditable = Producto & {
  subcategoriaId?: number | null;
};

type UpdateProductoPayload = UpdateProductoInput & {
  subcategoriaId?: number | null;
};

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
  precioVenta?: number;
  stockDisponibleUnits?: number;
  codigoBarra?: string | null;
  atributosExtra?: Record<string, string> | null;
}

type BarcodeSource = "camera" | "pistola";

const STEPS = [
  { label: "Datos básicos" },
  { label: "Código de barras" },
  { label: "Precio y stock" },
  { label: "Extras y confirmación" },
] as const;

export function ProductoWizardDialog({
  mode,
  trigger,
  producto,
  onCreated,
  onProductoCreado,
  onUpdated,
  onCategoriasChanged,
  initialValues,
  submitFn,
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
}: {
  mode: "create" | "edit";
  trigger?: React.ReactNode;
  /** Requerido en mode="edit". */
  producto?: ProductoEditable;
  onCreated?: () => void;
  onProductoCreado?: (producto: ProductoCreado) => void;
  onUpdated?: () => void;
  /** Notifica al padre cuando se crea/edita/elimina una categoría desde este wizard,
   * para que pueda refrescar listados de categorías fuera del dialog (ej. filtros). */
  onCategoriasChanged?: () => void;
  /** Prellenado opcional (ej: desde un item de factura OCR). Solo mode="create". */
  initialValues?: CreateProductoInitialValues;
  /** Override del submit por defecto (apiService.createProducto). Solo mode="create". */
  submitFn?: (payload: CreateProductoInput) => Promise<ProductoCreado>;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const isEdit = mode === "edit";

  const [internalOpen, setInternalOpen] = React.useState(false);
  const open = controlledOpen ?? internalOpen;
  const setOpen = React.useCallback(
    (value: boolean) => {
      controlledOnOpenChange?.(value);
      if (controlledOpen === undefined) setInternalOpen(value);
    },
    [controlledOnOpenChange, controlledOpen],
  );

  const [step, setStep] = React.useState(0);
  const [saving, setSaving] = React.useState(false);
  const [imageUploading, setImageUploading] = React.useState(false);

  // Estados del formulario
  const [nombre, setNombre] = React.useState(
    producto?.nombre ?? initialValues?.nombre ?? "",
  );
  const [codigoBarra, setCodigoBarra] = React.useState(
    producto?.codigoBarra ?? initialValues?.codigoBarra ?? "",
  );
  const [barcodeCameraOpen, setBarcodeCameraOpen] = React.useState(false);
  const [pendingBarcode, setPendingBarcode] = React.useState<{
    code: string;
    source: BarcodeSource;
  } | null>(null);
  const [precioVenta, setPrecioVenta] = React.useState(
    producto
      ? formatearInputMonto(Number(producto.precioVenta))
      : initialValues?.precioVenta !== undefined
        ? formatearInputMonto(initialValues.precioVenta)
        : "",
  );
  const [precioCosto, setPrecioCosto] = React.useState(
    producto
      ? formatearInputMonto(Number(producto.precioCosto))
      : initialValues?.precioCosto !== undefined
        ? formatearInputMonto(initialValues.precioCosto)
        : "",
  );
  const [stockDisponibleUnits, setStockDisponibleUnits] = React.useState(
    !producto && initialValues?.stockDisponibleUnits !== undefined
      ? String(initialValues.stockDisponibleUnits)
      : "",
  );
  const [stockMinUnits, setStockMinUnits] = React.useState(
    producto ? String(producto.stockMinUnits || "") : "",
  );
  const [fechaVencimiento, setFechaVencimiento] = React.useState(
    producto?.fechaVencimiento
      ? new Date(producto.fechaVencimiento).toISOString().split("T")[0]
      : "",
  );
  const [imagenUrl, setImagenUrl] = React.useState<string | null>(
    producto?.imagenUrl ?? null,
  );

  // Descuento
  const [descuentoActivo, setDescuentoActivo] = React.useState(
    producto?.descuentoActivo ?? false,
  );
  const [tipoDescuento, setTipoDescuento] = React.useState<
    "porcentaje" | "monto"
  >((producto?.tipoDescuento as "porcentaje" | "monto") ?? "porcentaje");
  const [descuentoPorcentaje, setDescuentoPorcentaje] = React.useState(
    producto?.descuentoPorcentaje ? String(producto.descuentoPorcentaje) : "",
  );
  const [descuentoMonto, setDescuentoMonto] = React.useState(
    producto?.descuentoMonto ? String(producto.descuentoMonto) : "",
  );
  const [descuentoDesde, setDescuentoDesde] = React.useState(
    producto?.descuentoDesde
      ? new Date(producto.descuentoDesde).toISOString().slice(0, 16)
      : "",
  );
  const [descuentoHasta, setDescuentoHasta] = React.useState(
    producto?.descuentoHasta
      ? new Date(producto.descuentoHasta).toISOString().slice(0, 16)
      : "",
  );

  // Categorías
  const [categorias, setCategorias] = React.useState<
    { id: number | string; nombre: string; color?: string }[]
  >([]);
  const [categoriaId, setCategoriaId] = React.useState<string>(
    producto?.categoriaId?.toString() ?? "",
  );
  const [subcategorias, setSubcategorias] = React.useState<
    { id: number; nombre: string }[]
  >([]);
  const [subcategoriaId, setSubcategoriaId] = React.useState<string>(
    producto?.subcategoriaId?.toString() ?? "",
  );

  // Atributos adicionales (lote, vencimiento, talle, color, etc.)
  const [atributosExtra, setAtributosExtra] = React.useState<Record<
    string,
    string
  > | null>(producto?.atributosExtra ?? initialValues?.atributosExtra ?? null);
  const [mostrarAtributos, setMostrarAtributos] = React.useState(() => {
    const extra = producto?.atributosExtra ?? initialValues?.atributosExtra;
    return !!extra && Object.keys(extra).length > 0;
  });
  const [sugerenciasAtributos, setSugerenciasAtributos] = React.useState<
    string[]
  >([]);
  const [rubroNegocio, setRubroNegocio] = React.useState<string | null>(null);
  const codigoBarraInputRef = React.useRef<HTMLInputElement | null>(null);

  const confirmBarcode = React.useCallback(() => {
    setPendingBarcode((current) => {
      if (!current) return null;
      setCodigoBarra(current.code);
      requestAnimationFrame(() => {
        codigoBarraInputRef.current?.focus();
        codigoBarraInputRef.current?.select();
      });
      return null;
    });
  }, []);

  const rejectBarcode = React.useCallback(() => {
    setPendingBarcode((current) => {
      if (current?.source === "camera") {
        setBarcodeCameraOpen(true);
      }
      return null;
    });
  }, []);

  useBarcodeScanner({
    enabled: open && step === 1,
    onScan: (code) => setPendingBarcode({ code, source: "pistola" }),
  });

  React.useEffect(() => {
    if (!open) return;
    setStep(0);
    setNombre(producto?.nombre ?? initialValues?.nombre ?? "");
    setCodigoBarra(producto?.codigoBarra ?? initialValues?.codigoBarra ?? "");
    setBarcodeCameraOpen(false);
    setPendingBarcode(null);
    setPrecioVenta(
      producto
        ? formatearInputMonto(Number(producto.precioVenta))
        : initialValues?.precioVenta !== undefined
          ? formatearInputMonto(initialValues.precioVenta)
          : "",
    );
    setPrecioCosto(
      producto
        ? formatearInputMonto(Number(producto.precioCosto))
        : initialValues?.precioCosto !== undefined
          ? formatearInputMonto(initialValues.precioCosto)
          : "",
    );
    setStockDisponibleUnits(
      !producto && initialValues?.stockDisponibleUnits !== undefined
        ? String(initialValues.stockDisponibleUnits)
        : "",
    );
    setStockMinUnits(producto ? String(producto.stockMinUnits || "") : "");
    setFechaVencimiento(
      producto?.fechaVencimiento
        ? new Date(producto.fechaVencimiento).toISOString().split("T")[0]
        : "",
    );
    setImagenUrl(producto?.imagenUrl ?? null);
    setImageUploading(false);
    setCategoriaId(producto?.categoriaId?.toString() ?? "");
    setDescuentoActivo(producto?.descuentoActivo ?? false);
    setTipoDescuento(
      (producto?.tipoDescuento as "porcentaje" | "monto") ?? "porcentaje",
    );
    setDescuentoPorcentaje(
      producto?.descuentoPorcentaje ? String(producto.descuentoPorcentaje) : "",
    );
    setDescuentoMonto(
      producto?.descuentoMonto ? String(producto.descuentoMonto) : "",
    );
    setDescuentoDesde(
      producto?.descuentoDesde
        ? new Date(producto.descuentoDesde).toISOString().slice(0, 16)
        : "",
    );
    setDescuentoHasta(
      producto?.descuentoHasta
        ? new Date(producto.descuentoHasta).toISOString().slice(0, 16)
        : "",
    );
    const extra =
      producto?.atributosExtra ?? initialValues?.atributosExtra ?? null;
    setAtributosExtra(extra);
    setMostrarAtributos(!!extra && Object.keys(extra).length > 0);

    apiService
      .getCategorias()
      .then((data) => setCategorias(Array.isArray(data) ? data : []))
      .catch(() => setCategorias([]));

    apiService
      .getConfiguracionGeneral()
      .then((config) => {
        const hint = getAtributosTipicos(config?.rubroNegocio);
        setSugerenciasAtributos(hint ? hint.split(", ").filter(Boolean) : []);
        setRubroNegocio(config?.rubroNegocio ?? null);
      })
      .catch(() => {
        setSugerenciasAtributos([]);
        setRubroNegocio(null);
      });

    if (producto?.categoriaId) {
      apiService
        .getSubcategorias(producto.categoriaId)
        .then(setSubcategorias)
        .catch(() => setSubcategorias([]));
    } else {
      setSubcategorias([]);
    }
    setSubcategoriaId(producto?.subcategoriaId?.toString() ?? "");
    // eslint-disable-next-line react-hooks/exhaustive-deps -- producto/initialValues se leen sólo al abrir
  }, [open]);

  // Cargar subcategorías al cambiar categoría (solo si es un cambio manual, no el prellenado inicial)
  const isFirstRender = React.useRef(true);
  React.useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    if (categoriaId) {
      apiService
        .getSubcategorias(Number(categoriaId))
        .then(setSubcategorias)
        .catch(() => setSubcategorias([]));
      setSubcategoriaId("");
    } else {
      setSubcategorias([]);
      setSubcategoriaId("");
    }
  }, [categoriaId]);

  // Atributos fijos del rubro activo: se muestran como campos estructurados
  // (AtributosFijosForm); el resto de las claves sigue en el editor libre.
  const atributosFijos = React.useMemo(
    () => getAtributosFijos(rubroNegocio),
    [rubroNegocio],
  );
  const clavesFijas = React.useMemo(
    () => new Set(atributosFijos.map((def) => def.clave)),
    [atributosFijos],
  );
  // Es una propiedad del RUBRO (no de lo que ya se tipeó): si el rubro
  // define marca+sabor, el nombre siempre se va a auto-componer en el
  // paso "Extras" (ver componerNombreProducto) — el input de "Nombre" del
  // paso 1 no tiene sentido en ese caso, se descartaría igual.
  const rubroComponeNombre = React.useMemo(
    () =>
      atributosFijos.some((d) => d.clave === "marca") &&
      atributosFijos.some((d) => d.clave === "sabor"),
    [atributosFijos],
  );
  const atributosExtraLibres = React.useMemo(() => {
    if (!atributosExtra) return null;
    const entries = Object.entries(atributosExtra).filter(
      ([clave]) => !clavesFijas.has(clave),
    );
    return entries.length > 0 ? Object.fromEntries(entries) : null;
  }, [atributosExtra, clavesFijas]);
  const atributosFijosValidacion = React.useMemo(
    () => validarAtributosFijosProducto(atributosExtra, rubroNegocio),
    [atributosExtra, rubroNegocio],
  );
  // Para rubros con forma marca+sabor (ej. vapes), el nombre final se
  // compone solo a partir de esos atributos — lo que se tipeó en "Nombre"
  // en el paso 1 es un placeholder temporal hasta llegar a este cálculo.
  const nombreCompuesto = React.useMemo(
    () => componerNombreProducto(atributosFijos, atributosExtra),
    [atributosFijos, atributosExtra],
  );
  const nombreFinal = nombreCompuesto ?? nombre.trim();

  function actualizarAtributoFijo(clave: string, valor: string) {
    setAtributosExtra((prev) => {
      const next = { ...(prev ?? {}) };
      if (valor.trim() === "") {
        delete next[clave];
      } else {
        next[clave] = valor;
      }
      return Object.keys(next).length > 0 ? next : null;
    });
  }

  function actualizarAtributosLibres(
    valorLibres: Record<string, string> | null,
  ) {
    setAtributosExtra((prev) => {
      const fijos = Object.fromEntries(
        Object.entries(prev ?? {}).filter(([clave]) => clavesFijas.has(clave)),
      );
      const merged = { ...fijos, ...(valorLibres ?? {}) };
      return Object.keys(merged).length > 0 ? merged : null;
    });
  }

  // precioVenta/precioCosto vienen del input de máscara "caja registradora"
  // (formatearInputMonto, con "." de miles y "," decimal) — toNumber() solo
  // sabe convertir la coma decimal y rompe con montos >= 1000 (el punto de
  // miles queda como si fuera otro separador decimal). digitosAMonto() es el
  // inverso real de formatearInputMonto() y parsea esto correctamente.
  const pv = digitosAMonto(precioVenta) ?? 0;
  const pc = digitosAMonto(precioCosto) ?? 0;
  const dpct =
    descuentoActivo && tipoDescuento === "porcentaje"
      ? (toNumber(descuentoPorcentaje) ?? 0)
      : 0;
  const dmonto =
    descuentoActivo && tipoDescuento === "monto"
      ? (toNumber(descuentoMonto) ?? 0)
      : 0;
  const precioEfectivo = descuentoActivo
    ? tipoDescuento === "porcentaje" && dpct > 0
      ? pv * (1 - dpct / 100)
      : tipoDescuento === "monto" && dmonto > 0
        ? Math.max(0, pv - Math.min(dmonto, pv))
        : pv
    : pv;
  const gananciaUnitaria = precioEfectivo - pc;
  const margenPorcentaje =
    precioEfectivo > 0 ? (gananciaUnitaria / precioEfectivo) * 100 : 0;
  const esGananciaNegativa =
    precioEfectivo > 0 && pc > 0 && gananciaUnitaria < 0;
  const muestraDescuento =
    descuentoActivo &&
    ((tipoDescuento === "porcentaje" && dpct > 0) ||
      (tipoDescuento === "monto" && dmonto > 0));

  const step0Valid =
    (rubroComponeNombre || nombre.trim().length >= 2) &&
    (isEdit || categoriaId !== "") &&
    !atributosFijosValidacion;
  const step2Valid = pv > 0 && pc > 0 && !esGananciaNegativa;
  const canSubmit = step0Valid && step2Valid;

  function canAdvanceFrom(i: number) {
    if (i === 0) return step0Valid;
    if (i === 2) return step2Valid;
    return true;
  }

  function goNext() {
    if (!canAdvanceFrom(step)) return;
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  }

  function goBack() {
    setStep((s) => Math.max(s - 1, 0));
  }

  async function save() {
    if (!canSubmit || saving) return;
    setSaving(true);
    try {
      const dpctVal = toNumber(descuentoPorcentaje);
      const dmontoVal = toNumber(descuentoMonto);

      if (mode === "create") {
        const payload = {
          nombre: nombreFinal,
          codigoBarra: codigoBarra.trim() || undefined,
          precioVenta: pv,
          precioCosto: pc,
          stockDisponibleUnits: toInt(stockDisponibleUnits) || 0,
          stockTotalUnits: toInt(stockDisponibleUnits) || 0,
          stockMinUnits: toInt(stockMinUnits) || 0,
          fechaVencimiento: fechaVencimiento || null,
          categoriaId: categoriaId ? Number(categoriaId) : null,
          subcategoriaId: subcategoriaId ? Number(subcategoriaId) : undefined,
          imagenUrl,
          descuentoActivo,
          tipoDescuento,
          descuentoPorcentaje:
            tipoDescuento === "porcentaje" ? (dpctVal ?? null) : null,
          descuentoMonto:
            tipoDescuento === "monto" ? (dmontoVal ?? null) : null,
          descuentoDesde: descuentoDesde
            ? new Date(descuentoDesde).toISOString()
            : null,
          descuentoHasta: descuentoHasta
            ? new Date(descuentoHasta).toISOString()
            : null,
          atributosExtra,
        };

        const crear =
          submitFn ??
          ((p: CreateProductoInput) =>
            apiService.createProducto(p).then((created) => ({
              id: Number(created.id),
              nombre: created.nombre,
              sku: (created as { sku?: string | null }).sku ?? null,
              codigoBarra: created.codigoBarra ?? null,
              stockDisponibleUnits: Number(
                (created as { stockDisponibleUnits?: unknown })
                  .stockDisponibleUnits ?? 0,
              ),
            })));

        const created = await crear(payload as unknown as CreateProductoInput);
        toast.success("Producto creado con éxito");
        setOpen(false);
        onCreated?.();
        onProductoCreado?.(created);
      } else {
        const payload: UpdateProductoPayload = {
          nombre: nombreFinal,
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
          descuentoPorcentaje:
            tipoDescuento === "porcentaje" ? (dpctVal ?? null) : null,
          descuentoMonto:
            tipoDescuento === "monto" ? (dmontoVal ?? null) : null,
          descuentoDesde: descuentoDesde
            ? new Date(descuentoDesde).toISOString()
            : null,
          descuentoHasta: descuentoHasta
            ? new Date(descuentoHasta).toISOString()
            : null,
          atributosExtra,
        };

        await apiService.updateProducto(producto!.id, payload);
        toast.success("Producto actualizado correctamente");
        setOpen(false);
        onUpdated?.();
      }
    } catch (err: unknown) {
      toast.error(
        err instanceof Error
          ? err.message
          : mode === "create"
            ? "Error al crear producto"
            : "Error al actualizar",
      );
    } finally {
      setSaving(false);
    }
  }

  // Cuando el dialog es controlado externamente (open/onOpenChange provistos) y no se pasó
  // un trigger explícito, no renderizamos ningún botón propio — el padre decide cuándo abrirlo.
  const mostrarTriggerPropio =
    isEdit || trigger !== undefined || controlledOpen === undefined;

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

      <DialogContent
        className={cn(
          "top-0 left-0 flex h-[100dvh] w-screen max-w-none translate-x-0 translate-y-0 flex-col gap-0 overflow-hidden rounded-none border-none bg-background p-0 shadow-2xl",
          "sm:top-[50%] sm:left-[50%] sm:h-auto sm:max-h-[90vh] sm:w-full sm:max-w-2xl sm:translate-x-[-50%] sm:translate-y-[-50%] sm:rounded-2xl sm:border",
        )}
      >
        <DialogHeader className="shrink-0 border-b bg-muted/20 px-5 pt-5 pb-3">
          <div className="flex items-center gap-2 text-primary">
            {isEdit ? (
              <Pencil className="h-5 w-5" />
            ) : (
              <Package className="h-5 w-5" />
            )}
            <DialogTitle className="text-xl font-bold italic tracking-tight">
              {isEdit ? "Editar Producto" : "Nuevo Producto"}
            </DialogTitle>
          </div>
          <DialogDescription>
            {isEdit
              ? "Ajustá la ficha técnica y comercial del producto."
              : "Completá la información base del producto"}
          </DialogDescription>

          <div className="pt-1">
            <div className="flex items-center gap-1.5">
              {STEPS.map((s, i) => (
                <div
                  key={s.label}
                  className={cn(
                    "h-1.5 flex-1 rounded-full transition-colors",
                    i <= step ? "bg-primary" : "bg-muted",
                  )}
                />
              ))}
            </div>
            <p className="pt-1.5 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
              Paso {step + 1} de {STEPS.length} · {STEPS[step].label}
            </p>
          </div>
        </DialogHeader>

        <div className="flex-1 space-y-3 overflow-y-auto px-5 py-4">
          {step === 0 && (
            <>
              {/* Imagen + nombre (el nombre no se muestra si el rubro lo
                  auto-compone desde sus atributos — ver más abajo). */}
              <div className="flex gap-4 items-start">
                <div
                  className={cn(
                    "space-y-1",
                    rubroComponeNombre ? "w-full" : "shrink-0 w-[88px]",
                  )}
                >
                  <Label className="text-[10px] font-bold uppercase text-muted-foreground">
                    Imagen
                  </Label>
                  <ImageUpload
                    value={imagenUrl}
                    onChange={setImagenUrl}
                    onUploadingChange={setImageUploading}
                  />
                </div>

                {!rubroComponeNombre && (
                  <div className="min-w-0 flex-1 space-y-1">
                    <Label className="text-xs font-bold uppercase text-muted-foreground">
                      Nombre
                    </Label>
                    <div className="relative">
                      <Tag className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        value={nombre}
                        onChange={(e) => setNombre(e.target.value)}
                        className="pl-9 h-10 bg-muted/30"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Atributos fijos del rubro activo — son el dato principal
                  del producto (marca, sabor, puffs...), van primero. */}
              {atributosFijos.length > 0 && (
                <div className="space-y-3 pt-3 border-t border-border/50">
                  <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                    Atributos de {getRubroLabel(rubroNegocio) || "este rubro"}
                  </p>
                  <AtributosFijosForm
                    definiciones={atributosFijos}
                    valores={atributosExtra}
                    onChange={actualizarAtributoFijo}
                    errores={
                      atributosFijosValidacion?.fieldErrors.atributosExtra
                    }
                    disabled={saving}
                  />
                </div>
              )}

              {/* Vencimiento + Categoría/Subcategoría — datos secundarios,
                  agrupados juntos al final del paso. */}
              <div className="space-y-3 pt-3 border-t border-border/50">
                <div className="space-y-1">
                  <Label className="text-xs font-bold uppercase text-muted-foreground">
                    Vencimiento (Opcional)
                  </Label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      type="date"
                      value={fechaVencimiento}
                      onChange={(e) => setFechaVencimiento(e.target.value)}
                      className="pl-9 h-10 bg-muted/30"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div
                    className={cn(
                      "space-y-1",
                      categoriaId && subcategorias.length > 0
                        ? "sm:col-span-1"
                        : "sm:col-span-2",
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <Label className="text-xs font-bold uppercase text-muted-foreground">
                        Categoría
                      </Label>
                      <CreateCategoriaDialog
                        onCreated={() => {
                          apiService
                            .getCategorias()
                            .then((data) =>
                              setCategorias(Array.isArray(data) ? data : []),
                            );
                          onCategoriasChanged?.();
                        }}
                        trigger={
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-5 w-5 text-muted-foreground hover:text-primary"
                            title="Administrar categorías"
                          >
                            <Pencil className="h-3 w-3" />
                          </Button>
                        }
                      />
                    </div>
                    <div className="relative">
                      <Layers className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground z-10" />
                      <Select
                        value={categoriaId}
                        onValueChange={setCategoriaId}
                      >
                        <SelectTrigger className="pl-9 h-10 bg-muted/30">
                          <SelectValue
                            placeholder={
                              isEdit
                                ? "Sin categoría"
                                : "Seleccionar categoría..."
                            }
                          />
                        </SelectTrigger>
                        <SelectContent>
                          {categorias.map((cat) => {
                            const catColor = getCategoryColorByKey(cat.color);
                            return (
                              <SelectItem
                                key={cat.id}
                                value={cat.id.toString()}
                              >
                                <span className="flex items-center gap-2">
                                  <span
                                    className={cn(
                                      "h-2 w-2 rounded-full shrink-0",
                                      catColor.dot,
                                    )}
                                  />
                                  {cat.nombre}
                                </span>
                              </SelectItem>
                            );
                          })}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {categoriaId && subcategorias.length > 0 && (
                    <div className="space-y-1 sm:col-span-1 animate-in fade-in slide-in-from-top-2 duration-300">
                      <Label className="text-xs font-bold uppercase text-muted-foreground">
                        Subcategoría (Opcional)
                      </Label>
                      <div className="relative">
                        <Tag className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground z-10" />
                        <Select
                          value={subcategoriaId}
                          onValueChange={setSubcategoriaId}
                        >
                          <SelectTrigger className="pl-9 h-10 bg-muted/30">
                            <SelectValue placeholder="Seleccionar subcategoría..." />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">
                              Sin subcategoría
                            </SelectItem>
                            {subcategorias.map((sub) => (
                              <SelectItem
                                key={sub.id}
                                value={sub.id.toString()}
                              >
                                {sub.nombre}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}

          {step === 1 && (
            <>
              <div className="space-y-1">
                <Label
                  htmlFor="wizard-codigo-barra"
                  className="text-xs font-bold uppercase text-muted-foreground"
                >
                  Código de barras
                </Label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Barcode className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="wizard-codigo-barra"
                      ref={codigoBarraInputRef}
                      value={codigoBarra}
                      onChange={(e) => setCodigoBarra(e.target.value)}
                      className="h-10 bg-muted/30 pl-9"
                      inputMode="numeric"
                      autoComplete="off"
                      placeholder="Ej.: 7791234567890"
                      aria-describedby="wizard-codigo-barra-hint"
                    />
                  </div>
                  <Button
                    type="button"
                    variant="secondary"
                    className="h-10 rounded-lg px-3 shrink-0"
                    onClick={() => setBarcodeCameraOpen(true)}
                    aria-label="Escanear código de barras con cámara"
                  >
                    <Camera className="h-4 w-4" />
                    <span className="hidden sm:inline ml-2">Cámara</span>
                  </Button>
                </div>
                <p
                  id="wizard-codigo-barra-hint"
                  className="text-[11px] text-muted-foreground leading-tight"
                >
                  Escribilo{" "}
                  <span className="font-medium text-foreground">
                    manualmente
                  </span>
                  , apuntá la{" "}
                  <span className="font-medium text-foreground">cámara</span> al
                  código, o usá la{" "}
                  <span className="font-medium text-foreground">
                    pistola lectora
                  </span>{" "}
                  en cualquier parte de esta pantalla — no hace falta hacer
                  click en el campo. Un código leído por cámara o pistola pide
                  confirmación antes de aplicarse.
                </p>
              </div>

              {codigoBarra ? (
                <div className="flex items-center gap-2 rounded-lg border border-[color:var(--status-success-strong)]/30 bg-[color:var(--status-success-strong)]/5 px-3 py-2.5 text-sm animate-in fade-in">
                  <CheckCircle2 className="h-4 w-4 text-[color:var(--status-success-strong)] shrink-0" />
                  <span className="text-muted-foreground">
                    Código asignado:{" "}
                    <span className="font-mono font-bold text-foreground">
                      {codigoBarra}
                    </span>
                  </span>
                </div>
              ) : (
                <div className="rounded-lg border border-dashed border-muted-foreground/30 px-3 py-2.5 text-sm text-muted-foreground">
                  Todavía no hay código de barras cargado (es opcional).
                </div>
              )}
            </>
          )}

          {step === 2 && (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs font-bold uppercase text-muted-foreground">
                    Costo unitario
                  </Label>
                  <div className="relative">
                    <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      value={precioCosto}
                      onChange={(e) =>
                        setPrecioCosto(
                          formatearInputMonto(digitosAMonto(e.target.value)),
                        )
                      }
                      className="pl-9 h-10 bg-muted/30"
                      placeholder="0,00"
                      inputMode="decimal"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-bold uppercase text-primary">
                    Precio de venta
                  </Label>
                  <div className="relative">
                    <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-primary" />
                    <Input
                      value={precioVenta}
                      onChange={(e) =>
                        setPrecioVenta(
                          formatearInputMonto(digitosAMonto(e.target.value)),
                        )
                      }
                      className="pl-9 h-10 bg-primary/5 border-primary/20 font-bold text-primary"
                      placeholder="0,00"
                      inputMode="decimal"
                    />
                  </div>
                </div>
              </div>

              {(pv > 0 || pc > 0) && (
                <div
                  className={`rounded-lg border px-4 py-2.5 flex items-center justify-between gap-2 transition-all ${esGananciaNegativa ? "bg-destructive/10 border-destructive/20" : "bg-[color:var(--status-success-strong)]/5 border-[color:var(--status-success-strong)]/20"}`}
                >
                  <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                    <TrendingUp
                      className={`h-3.5 w-3.5 ${esGananciaNegativa ? "text-destructive" : "text-[color:var(--status-success-strong)]"}`}
                    />
                    Rentabilidad estimada
                    {muestraDescuento && (
                      <span className="text-[10px] font-bold text-[color:var(--status-warning)] bg-[color:var(--status-warning)]/10 px-1.5 py-0.5 rounded-full">
                        c/desc.
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {esGananciaNegativa && (
                      <AlertCircle className="h-3.5 w-3.5 text-destructive" />
                    )}
                    <span
                      className={`text-sm font-black ${esGananciaNegativa ? "text-destructive" : "text-[color:var(--status-success-strong)]"}`}
                    >
                      ${gananciaUnitaria.toLocaleString("es-AR")} (
                      {margenPorcentaje.toFixed(1)}%)
                    </span>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {isEdit ? (
                  <div className="flex items-center gap-2 p-3 bg-muted/20 rounded-lg border border-dashed">
                    <Package className="h-4 w-4 text-muted-foreground shrink-0" />
                    <div className="flex flex-col min-w-0">
                      <span className="text-[10px] uppercase font-bold text-muted-foreground">
                        Stock actual
                      </span>
                      <span className="text-sm font-bold truncate">
                        {producto!.stockDisponibleUnits} u.
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-1">
                    <Label className="text-xs font-bold uppercase text-muted-foreground">
                      Stock inicial
                    </Label>
                    <div className="relative">
                      <Package className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        value={stockDisponibleUnits}
                        onChange={(e) =>
                          setStockDisponibleUnits(e.target.value)
                        }
                        className="pl-9 h-10 bg-muted/30"
                        placeholder="0"
                        inputMode="numeric"
                      />
                    </div>
                  </div>
                )}

                <div className="space-y-1">
                  <Label className="text-xs font-bold uppercase text-[color:var(--status-warning)]">
                    Alerta stock bajo
                  </Label>
                  <div className="relative">
                    <BellRing className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[color:var(--status-warning)]" />
                    <Input
                      value={stockMinUnits}
                      onChange={(e) => setStockMinUnits(e.target.value)}
                      className="pl-9 h-10 bg-[color:var(--status-warning)]/5 border-[color:var(--status-warning)]/20"
                      placeholder="5"
                      inputMode="numeric"
                    />
                  </div>
                </div>
              </div>
            </>
          )}

          {step === 3 && (
            <>
              {/* Sección Descuento */}
              <div className="rounded-xl border border-dashed border-muted-foreground/30 p-3 space-y-3 bg-muted/10">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Percent className="h-4 w-4 text-muted-foreground" />
                    <span className="text-xs font-bold uppercase text-muted-foreground">
                      Descuento en catálogo
                    </span>
                  </div>
                  <Switch
                    checked={descuentoActivo}
                    onCheckedChange={setDescuentoActivo}
                  />
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
                            : "bg-muted/30 text-muted-foreground border-muted-foreground/20 hover:border-muted-foreground/40",
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
                            : "bg-muted/30 text-muted-foreground border-muted-foreground/20 hover:border-muted-foreground/40",
                        )}
                      >
                        $ Monto fijo
                      </button>
                    </div>

                    <div className="space-y-1">
                      {tipoDescuento === "porcentaje" ? (
                        <>
                          <Label className="text-xs font-bold uppercase text-muted-foreground">
                            Porcentaje (%)
                          </Label>
                          <div className="relative">
                            <Percent className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                              type="number"
                              min={1}
                              max={99}
                              value={descuentoPorcentaje}
                              onChange={(e) =>
                                setDescuentoPorcentaje(e.target.value)
                              }
                              className="pl-9 h-10 bg-muted/30"
                              placeholder="ej: 20"
                              inputMode="numeric"
                            />
                          </div>
                        </>
                      ) : (
                        <>
                          <Label className="text-xs font-bold uppercase text-muted-foreground">
                            Monto de descuento ($)
                          </Label>
                          <div className="relative">
                            <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                              type="number"
                              min={0.01}
                              value={descuentoMonto}
                              onChange={(e) =>
                                setDescuentoMonto(e.target.value)
                              }
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
                        <Label className="text-xs font-bold uppercase text-muted-foreground">
                          Desde (opcional)
                        </Label>
                        <Input
                          type="datetime-local"
                          value={descuentoDesde}
                          onChange={(e) => setDescuentoDesde(e.target.value)}
                          className="h-10 bg-muted/30"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs font-bold uppercase text-muted-foreground">
                          Hasta (opcional)
                        </Label>
                        <Input
                          type="datetime-local"
                          value={descuentoHasta}
                          onChange={(e) => setDescuentoHasta(e.target.value)}
                          className="h-10 bg-muted/30"
                        />
                      </div>
                    </div>

                    {(() => {
                      const dpctPreview = toNumber(descuentoPorcentaje);
                      const dmontoPreview = toNumber(descuentoMonto);
                      const precioFinal =
                        tipoDescuento === "porcentaje"
                          ? dpctPreview && pv > 0
                            ? pv * (1 - dpctPreview / 100)
                            : null
                          : dmontoPreview && pv > 0
                            ? pv - Math.min(dmontoPreview, pv)
                            : null;
                      if (!precioFinal || pv <= 0) return null;
                      const ahorro = pv - precioFinal;
                      const pctCalc = Math.round((ahorro / pv) * 100);
                      return (
                        <div className="rounded-lg bg-destructive/5 border border-destructive/20 px-3 py-2 flex items-center justify-between">
                          <span className="text-xs text-muted-foreground line-through">
                            ${pv.toLocaleString("es-AR")}
                          </span>
                          <span className="text-sm font-black text-destructive">
                            ${precioFinal.toLocaleString("es-AR")}
                          </span>
                          <span className="text-xs font-bold text-destructive bg-destructive/10 px-2 py-0.5 rounded-full">
                            -{pctCalc}%
                          </span>
                        </div>
                      );
                    })()}
                  </div>
                )}
              </div>

              {/* Sección de atributos libres — colapsada por default */}
              <div className="rounded-xl border border-dashed border-muted-foreground/30 p-3 space-y-3 bg-muted/10">
                <button
                  type="button"
                  onClick={() => setMostrarAtributos((v) => !v)}
                  className="flex items-center justify-between w-full text-left"
                >
                  <span className="text-xs font-bold uppercase text-muted-foreground">
                    {atributosFijos.length > 0
                      ? "Otros atributos (opcional)"
                      : "Atributos adicionales (opcional)"}
                  </span>
                  <span className="text-[10px] text-muted-foreground">
                    {mostrarAtributos ? "Ocultar" : "Mostrar"}
                  </span>
                </button>
                {mostrarAtributos && (
                  <div className="animate-in fade-in slide-in-from-top-2 duration-200">
                    <AtributosExtraEditor
                      value={
                        atributosFijos.length > 0
                          ? atributosExtraLibres
                          : atributosExtra
                      }
                      onChange={
                        atributosFijos.length > 0
                          ? actualizarAtributosLibres
                          : setAtributosExtra
                      }
                      sugerencias={sugerenciasAtributos}
                      disabled={saving}
                    />
                  </div>
                )}
              </div>

              {/* Resumen final */}
              <div className="rounded-xl border bg-muted/10 p-3 space-y-2">
                <p className="text-xs font-bold uppercase text-muted-foreground">
                  Resumen
                </p>
                <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-sm">
                  <span className="text-muted-foreground">
                    Nombre
                    {nombreCompuesto && (
                      <span className="block text-[9px] normal-case font-normal text-muted-foreground/70">
                        auto: marca + sabor + puffs
                      </span>
                    )}
                  </span>
                  <span className="font-medium text-right truncate">
                    {nombreFinal || "—"}
                  </span>
                  <span className="text-muted-foreground">Categoría</span>
                  <span className="font-medium text-right truncate">
                    {categorias.find((c) => String(c.id) === categoriaId)
                      ?.nombre || "—"}
                  </span>
                  <span className="text-muted-foreground">
                    Código de barras
                  </span>
                  <span className="font-mono text-right truncate">
                    {codigoBarra || "—"}
                  </span>
                  <span className="text-muted-foreground">Precio de venta</span>
                  <span className="font-bold text-right">
                    ${pv.toLocaleString("es-AR")}
                  </span>
                  <span className="text-muted-foreground">Margen</span>
                  <span
                    className={cn(
                      "font-bold text-right",
                      esGananciaNegativa
                        ? "text-destructive"
                        : "text-[color:var(--status-success-strong)]",
                    )}
                  >
                    {margenPorcentaje.toFixed(1)}%
                  </span>
                  <span className="text-muted-foreground">Stock</span>
                  <span className="font-medium text-right">
                    {isEdit
                      ? producto!.stockDisponibleUnits
                      : toInt(stockDisponibleUnits) || 0}{" "}
                    u.
                  </span>
                </div>
              </div>
            </>
          )}
        </div>

        <div className="shrink-0 flex gap-3 border-t bg-background px-5 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
          {step === 0 ? (
            <Button
              type="button"
              variant="outline"
              className="flex-1 h-10"
              onClick={() => setOpen(false)}
              disabled={saving}
            >
              Cancelar
            </Button>
          ) : (
            <Button
              type="button"
              variant="outline"
              className="flex-1 h-10"
              onClick={goBack}
              disabled={saving}
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              Atrás
            </Button>
          )}

          {step < STEPS.length - 1 ? (
            <Button
              type="button"
              className="flex-1 h-10 font-bold"
              onClick={goNext}
              disabled={!canAdvanceFrom(step)}
            >
              Siguiente
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          ) : (
            <Button
              type="button"
              className="flex-1 h-10 font-bold shadow-lg"
              onClick={save}
              disabled={!canSubmit || saving || imageUploading}
            >
              {saving || imageUploading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : isEdit ? (
                "Guardar Cambios"
              ) : (
                "Crear Producto"
              )}
            </Button>
          )}
        </div>
      </DialogContent>

      <BarcodeCameraSheet
        open={barcodeCameraOpen}
        onOpenChange={setBarcodeCameraOpen}
        onDetected={(code) => setPendingBarcode({ code, source: "camera" })}
      />

      <AlertDialog
        open={pendingBarcode !== null}
        onOpenChange={(o) => {
          if (!o) setPendingBarcode(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center justify-center gap-2">
              {pendingBarcode?.source === "camera" ? (
                <Camera className="h-5 w-5 text-primary" />
              ) : (
                <ScanLine className="h-5 w-5 text-primary" />
              )}
              Código detectado
            </AlertDialogTitle>
            <AlertDialogDescription>
              {pendingBarcode?.source === "camera"
                ? "Detectado con la cámara."
                : "Detectado con la pistola lectora."}{" "}
              Confirmá que es correcto antes de aplicarlo.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="rounded-xl border bg-muted/30 px-4 py-3 text-center">
            <span className="font-mono text-xl font-black tracking-wider break-all">
              {pendingBarcode?.code}
            </span>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={rejectBarcode}>
              Volver a escanear
            </AlertDialogCancel>
            <AlertDialogAction onClick={confirmBarcode}>
              Confirmar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
}
