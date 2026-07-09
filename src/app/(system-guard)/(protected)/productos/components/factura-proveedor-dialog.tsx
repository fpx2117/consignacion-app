"use client";

import * as React from "react";
import {
  apiService,
  type FacturaProveedor,
  type FacturaProveedorItem,
  type FacturaProveedorUsage,
  type Proveedor,
  type UpdateFacturaProveedorInput,
  type UpdateFacturaProveedorItemInput,
} from "@/lib/apiService";
import type { Producto } from "@/lib/types";
import { useDolarBlue } from "@/hooks/useDolarBlue";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ScanText, Loader2, AlertTriangle, CheckCircle2, XCircle, HelpCircle, Sparkles, Check, X, FileText, User, Building2, Hash, Calendar, CircleDollarSign, ScanLine, Package, Plus, PencilLine } from "lucide-react";
import { toast } from "sonner";
import { CreateProductoDialog, type CreateProductoInitialValues, type ProductoCreado } from "./create-producto-dialog";
import { EditProductoDialog } from "./edit-producto-dialog";
import { cn } from "@/lib/utils";

const ESTADOS_TERMINALES = new Set(["CONFIRMADO", "PRODUCTO_CREADO", "IGNORADO"]);

function badgeEstado(item: FacturaProveedorItem) {
  switch (item.estado) {
    case "COINCIDENCIA_SEGURA":
      return { label: `${item.producto?.nombre ?? "Producto sugerido"} (${Math.round((item.matchScore ?? 0) * 100)}%)`, cls: "text-[color:var(--status-success-strong)]", icon: CheckCircle2 };
    case "COINCIDENCIA_PROBABLE":
      return { label: `${item.producto?.nombre ?? "Producto sugerido"} (${Math.round((item.matchScore ?? 0) * 100)}%)`, cls: "text-[color:var(--status-success-strong)]", icon: CheckCircle2 };
    case "REQUIERE_REVISION":
      return { label: "Revisar manualmente", cls: "text-[color:var(--status-warning)]", icon: HelpCircle };
    case "SIN_COINCIDENCIA":
      return { label: "Sin coincidencia", cls: "text-muted-foreground", icon: XCircle };
    case "CONFIRMADO":
      return { label: "Confirmado", cls: "text-[color:var(--status-success-strong)]", icon: CheckCircle2 };
    case "PRODUCTO_CREADO":
      return { label: "Producto creado", cls: "text-[color:var(--status-success-strong)]", icon: Sparkles };
    case "IGNORADO":
      return { label: "Ignorado", cls: "text-muted-foreground", icon: XCircle };
    default:
      return { label: "Pendiente", cls: "text-muted-foreground", icon: HelpCircle };
  }
}

function normalizarNombreSugerido(textoOriginal: string): string {
  return textoOriginal.trim();
}

function inferirCodigoBarra(item: FacturaProveedorItem): string | null {
  const candidato = item.codigoProveedor?.trim() ?? "";
  if (!/^\d{8,14}$/.test(candidato)) return null;
  return candidato;
}

const TIPS_FOTO: { ok: boolean; texto: string }[] = [
  { ok: true, texto: "Buena iluminación" },
  { ok: true, texto: "Texto legible" },
  { ok: true, texto: "Factura completa visible" },
  { ok: false, texto: "Sin reflejos ni sombras" },
  { ok: false, texto: "No capturas de pantalla" },
];

const ACCEPT_FACTURA = "image/png,image/jpeg,image/webp,application/pdf";
const FACTURA_FIELD_CLASS = "h-12 rounded-xl border-border bg-background text-sm shadow-xs";
const ITEM_FIELD_CLASS = "h-11 rounded-xl border-border bg-background text-sm shadow-xs";
const ITEM_LABEL_CLASS = "text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground xl:hidden";
const ITEM_TABLE_COLUMNS = "xl:grid-cols-[minmax(0,2.1fr)_88px_150px_minmax(0,1.65fr)_136px]";
const ITEM_ACTION_ICON_CLASS = "size-10 rounded-xl border transition-colors focus-visible:ring-2 focus-visible:ring-primary/60";

type FacturaProveedorItemConCatalogoGlobal = FacturaProveedorItem & {
  candidatoGlobalNombre?: string | null;
  candidatoGlobalCodigoBarras?: string | null;
  candidatoGlobalScore?: number | null;
};

export function FacturaProveedorDialog({
  trigger,
  onCreated,
}: {
  trigger?: React.ReactNode;
  onCreated?: () => void;
}) {
  const [open, setOpen] = React.useState(false);
  const [subiendo, setSubiendo] = React.useState(false);
  const [procesando, setProcesando] = React.useState(false);
  const [factura, setFactura] = React.useState<FacturaProveedor | null>(null);
  const [items, setItems] = React.useState<FacturaProveedorItem[] | null>(null);
  const [productos, setProductos] = React.useState<Producto[]>([]);
  const [proveedores, setProveedores] = React.useState<Proveedor[]>([]);
  const [busyItemId, setBusyItemId] = React.useState<number | null>(null);
  const { rate: cotizacionDolar } = useDolarBlue();
  const [confirmandoTodos, setConfirmandoTodos] = React.useState(false);
  const [itemParaCrear, setItemParaCrear] = React.useState<FacturaProveedorItem | null>(null);
  const [itemIdParaEditar, setItemIdParaEditar] = React.useState<number | null>(null);
  // Trackea si hay un dialog anidado (crear/editar producto) abierto, para
  // que el dialog padre no se cierre en cascada cuando el anidado detecta
  // un click/Escape "afuera" (ambos son overlays de Radix portados a
  // document.body — sin esto, el padre confunde esa interacción como si
  // fuera afuera de sí mismo).
  const nestedDialogOpen = itemParaCrear !== null || itemIdParaEditar !== null;
  const [selectedFile, setSelectedFile] = React.useState<File | null>(null);
  const [dragActive, setDragActive] = React.useState(false);
  const [usage, setUsage] = React.useState<FacturaProveedorUsage | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  // Evita que Radix cierre el Dialog al volver del selector nativo de
  // archivos (cámara/galería) en mobile — ver openspec/changes/fix-carga-factura-mobile.
  const selectorArchivoAbiertoRef = React.useRef(false);

  // Consulta el cupo al montar para decidir si mostrar el disparador: los
  // planes sin OCR (hasFeature === false) ocultan el botón por completo.
  React.useEffect(() => {
    apiService.getFacturaProveedorUsage().then(setUsage).catch(() => setUsage(null));
  }, []);

  React.useEffect(() => {
    if (!open) {
      setFactura(null);
      setItems(null);
      setSubiendo(false);
      setProcesando(false);
      setSelectedFile(null);
      setDragActive(false);
      setItemParaCrear(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }
    apiService.getProductos().then(setProductos).catch(() => setProductos([]));
    apiService.getProveedores().then(setProveedores).catch(() => setProveedores([]));
    // Refresca el contador cada vez que se abre (puede haber cambiado el uso).
    apiService.getFacturaProveedorUsage().then(setUsage).catch(() => setUsage(null));
  }, [open]);

  const trabajando = subiendo || procesando;
  const sinCupo = usage != null && (!usage.hasFeature || (usage.limit !== -1 && usage.used >= usage.limit));

  // Red de seguridad: si el navegador no dispara "cancel" en el <input
  // type="file"> (algunos no lo hacen), limpiar el guard cuando la ventana
  // recupera el foco — pasa siempre al volver de la cámara/galería nativa,
  // se haya elegido un archivo o no.
  React.useEffect(() => {
    function onWindowFocus() {
      if (!selectorArchivoAbiertoRef.current) return;
      window.setTimeout(() => {
        selectorArchivoAbiertoRef.current = false;
      }, 300);
    }
    window.addEventListener("focus", onWindowFocus);
    return () => window.removeEventListener("focus", onWindowFocus);
  }, []);

  // El tipado de React no incluye el evento nativo "cancel" de <input
  // type="file"> — se engancha imperativamente en vez de vía JSX onCancel.
  React.useEffect(() => {
    const input = fileInputRef.current;
    if (!input) return;
    function onCancel() {
      selectorArchivoAbiertoRef.current = false;
    }
    input.addEventListener("cancel", onCancel);
    return () => input.removeEventListener("cancel", onCancel);
  }, []);

  function abrirSelectorArchivo() {
    if (trabajando || sinCupo) return;
    selectorArchivoAbiertoRef.current = true;
    fileInputRef.current?.click();
  }

  function elegirArchivo(file: File | null | undefined) {
    if (!file || trabajando) return;
    setSelectedFile(file);
  }

  function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    selectorArchivoAbiertoRef.current = false;
    elegirArchivo(e.target.files?.[0]);
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragActive(false);
    elegirArchivo(e.dataTransfer.files?.[0]);
  }

  async function analizarFactura() {
    if (!selectedFile || trabajando) return;

    setSubiendo(true);
    try {
      const subida = await apiService.uploadFacturaProveedor(selectedFile);
      setSubiendo(false);
      setProcesando(true);
      const procesada = await apiService.processFacturaProveedor(subida.id);
      setFactura(procesada);
      setItems(procesada.items ?? []);
      if ((procesada.items ?? []).length === 0) {
        toast.warning("No se detectaron líneas de producto en la factura. Probá con otra foto más nítida.");
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Error al procesar la factura");
      setFactura(null);
      setItems(null);
    } finally {
      setSubiendo(false);
      setProcesando(false);
    }
  }

  function updateItem(itemId: number, patch: Partial<FacturaProveedorItem>) {
    setItems((prev) => prev?.map((i) => (i.id === itemId ? { ...i, ...patch } : i)) ?? null);
  }

  // Todos los campos detectados por OCR/IA son editables antes de confirmar:
  // guarda optimistamente en el estado local y persiste con un PATCH al perder foco.
  function updateFacturaLocal(patch: Partial<FacturaProveedor>) {
    setFactura((prev) => (prev ? { ...prev, ...patch } : prev));
  }

  async function guardarCampoFactura(patch: UpdateFacturaProveedorInput) {
    if (!factura) return;
    updateFacturaLocal(patch as Partial<FacturaProveedor>);
    try {
      const actualizada = await apiService.updateFacturaProveedor(factura.id, patch);
      setFactura(actualizada);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Error al guardar el cambio");
    }
  }

  async function guardarCampoItem(item: FacturaProveedorItem, patch: UpdateFacturaProveedorItemInput) {
    updateItem(item.id, patch as Partial<FacturaProveedorItem>);
    try {
      const actualizado = await apiService.updateFacturaProveedorItem(item.id, patch);
      updateItem(item.id, actualizado);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Error al guardar el cambio");
    }
  }

  async function confirmarItem(item: FacturaProveedorItem, productoIdElegido?: number) {
    const productoId = productoIdElegido ?? item.productoId;
    if (!productoId) {
      toast.error("Elegí un producto antes de confirmar");
      return;
    }
    setBusyItemId(item.id);
    try {
      const resultado = await apiService.confirmFacturaProveedorItem(item.id, productoId);
      updateItem(item.id, resultado.data);
      if (resultado.variacionCosto.alerta === "alerta_fuerte") {
        toast.warning(`El costo varió más del 40% respecto al histórico para "${item.textoOriginal}"`);
      } else if (resultado.variacionCosto.alerta === "advertencia") {
        toast.message(`El costo varió respecto al histórico para "${item.textoOriginal}"`);
      }
      if (resultado.tipoCambioAplicado) {
        toast.message(`Costo convertido a ARS con cotización $${resultado.tipoCambioAplicado.toLocaleString("es-AR")}`);
      } else if (resultado.advertenciaConversion) {
        toast.warning(resultado.advertenciaConversion);
      }
      onCreated?.();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Error al confirmar el item");
    } finally {
      setBusyItemId(null);
    }
  }

  async function ignorarItem(item: FacturaProveedorItem) {
    setBusyItemId(item.id);
    try {
      const actualizado = await apiService.ignoreFacturaProveedorItem(item.id);
      updateItem(item.id, actualizado);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Error al ignorar el item");
    } finally {
      setBusyItemId(null);
    }
  }

  async function confirmarTodosSeguros() {
    if (!factura) return;
    setConfirmandoTodos(true);
    try {
      const resultado = await apiService.confirmAllFacturaProveedor(factura.id);
      if (resultado.confirmados > 0) toast.success(`${resultado.confirmados} producto(s) confirmado(s)`);
      if (resultado.errores.length > 0) {
        resultado.errores.forEach((e) => toast.error(`Item ${e.itemId}: ${e.error}`));
      }
      const facturaActualizada = await apiService.getFacturaProveedor(factura.id);
      setFactura(facturaActualizada);
      setItems(facturaActualizada.items ?? []);
      onCreated?.();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Error al confirmar en lote");
    } finally {
      setConfirmandoTodos(false);
    }
  }

  function initialValuesParaNuevoProducto(item: FacturaProveedorItemConCatalogoGlobal): CreateProductoInitialValues {
    // El costo final que persiste el backend siempre queda en ARS (ver
    // create-product/route.ts) — acá sólo se prellena una estimación con la
    // cotización del momento para que el campo no se vea con un número en
    // USD sin aclarar. El valor real, autoritativo, lo calcula el backend.
    const moneda = (factura?.moneda ?? "ARS").trim().toUpperCase();
    const precioEstimadoArs =
      item.precioUnitario != null && moneda === "USD" && cotizacionDolar
        ? item.precioUnitario * cotizacionDolar
        : item.precioUnitario ?? undefined;

    return {
      // Si hay una sugerencia del catálogo global, su nombre normalizado es
      // más limpio que el texto OCR crudo — pero sigue siendo editable, no se
      // fuerza nada (ver openspec/changes/catalogo-global-api).
      nombre: normalizarNombreSugerido(item.candidatoGlobalNombre ?? item.textoOriginal),
      precioCosto: precioEstimadoArs,
      stockDisponibleUnits: item.cantidad,
      codigoBarra: inferirCodigoBarra(item) ?? item.candidatoGlobalCodigoBarras,
    };
  }

  const facturaBloqueada = factura?.estado === "CONFIRMADA" || factura?.estado === "CANCELADA";
  const monedaFactura = (factura?.moneda ?? "ARS").trim().toUpperCase();

  function parseNumeroOpcional(valor: string): number | null {
    if (!valor.trim()) return null;
    const n = Number(valor);
    return Number.isFinite(n) ? n : null;
  }

  // La factura puede venir en una moneda extranjera (ej. USD). Para que el
  // usuario vea siempre los precios en pesos, se convierte en vivo con la
  // cotización del dólar blue. El backend hace la conversión autoritativa al
  // confirmar; acá es solo visual.
  const facturaEnMonedaExtranjera = monedaFactura !== "ARS";
  const puedeConvertir = facturaEnMonedaExtranjera && !!cotizacionDolar;

  function convertirAArs(valor: number | null | undefined): number | null {
    if (valor == null) return null;
    if (!facturaEnMonedaExtranjera) return valor;
    return cotizacionDolar ? valor * cotizacionDolar : null;
  }

  function formatearArs(valor: number): string {
    return `$${valor.toLocaleString("es-AR", { maximumFractionDigits: 0 })}`;
  }

  // El código de proveedor no se muestra por separado si ya viene embebido en
  // la descripción detectada (evita duplicar el dato en pantalla).
  function codigoYaEnDescripcion(item: FacturaProveedorItem): boolean {
    const cod = item.codigoProveedor?.trim();
    if (!cod) return false;
    return item.textoOriginal.toLowerCase().includes(cod.toLowerCase());
  }

  // Ocultar el disparador si el plan no incluye la carga de facturas con IA.
  // Mientras se resuelve el cupo (usage === null) se muestra de forma
  // optimista: la mayoría de los planes tienen la feature habilitada, así
  // que el botón aparece de inmediato en el caso común en vez de esperar la
  // red — a costa de un posible flash breve para la minoría sin acceso.
  if (usage != null && !usage.hasFeature) return null;

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          {trigger || (
            <Button variant="ghost" size="sm" className="h-9 px-3 rounded-lg font-bold text-sm">
              <ScanText className="h-3.5 w-3.5 mr-1.5" />
              Cargar por factura
            </Button>
          )}
        </DialogTrigger>

        <DialogContent
          className="p-0 gap-0 flex flex-col overflow-hidden border border-border bg-background rounded-[28px] sm:rounded-[28px] shadow-2xl w-[92vw] max-w-[1320px] sm:max-w-[1320px] max-h-[85vh]"
          onInteractOutside={(e) => { if (nestedDialogOpen || selectorArchivoAbiertoRef.current) e.preventDefault(); }}
          onEscapeKeyDown={(e) => { if (nestedDialogOpen) e.preventDefault(); }}
        >
          <DialogHeader className="shrink-0 border-b border-border px-8 py-7">
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <ScanText className="h-7 w-7" />
              </div>
              <div className="space-y-1">
                <DialogTitle className="text-2xl font-black tracking-tight">Escanear factura de compra</DialogTitle>
                <DialogDescription className="text-sm text-muted-foreground">
                  Subí o sacá una foto de la factura del proveedor para cargar stock automáticamente con IA.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          {!items && (
            <div className="flex-1 min-h-0 overflow-y-auto px-8 py-6 space-y-4">
              <input
                ref={fileInputRef}
                type="file"
                accept={ACCEPT_FACTURA}
                onChange={handleFileInput}
                disabled={trabajando}
                className="hidden"
              />

              {usage && (
                <div className="flex items-center justify-between rounded-xl border border-border bg-card px-4 py-3 text-sm">
                  <span className="text-muted-foreground">Escaneos usados este mes</span>
                  <span className="font-semibold tabular-nums">
                    {usage.used} / {usage.limit === -1 ? "∞" : usage.limit}
                  </span>
                </div>
              )}

              <div
                role="button"
                tabIndex={0}
                onClick={() => abrirSelectorArchivo()}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    abrirSelectorArchivo();
                  }
                }}
                onDragOver={(e) => { e.preventDefault(); if (!trabajando && !sinCupo) setDragActive(true); }}
                onDragLeave={(e) => { e.preventDefault(); setDragActive(false); }}
                onDrop={(e) => { if (sinCupo) { e.preventDefault(); return; } handleDrop(e); }}
                aria-disabled={sinCupo}
                className={`rounded-2xl border-2 border-dashed p-8 text-center transition-colors outline-none ${
                  sinCupo
                    ? "opacity-50 cursor-not-allowed border-border"
                    : "cursor-pointer focus-visible:ring-2 focus-visible:ring-primary"
                } ${
                  dragActive
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-primary/60 hover:bg-muted/40"
                }`}
              >
                  <div className="relative mx-auto mb-5 flex h-32 w-28 items-center justify-center">
                    {/* Marco de escáner */}
                    <span className="pointer-events-none absolute left-0 top-0 h-5 w-5 rounded-tl-md border-l-2 border-t-2 border-primary" />
                    <span className="pointer-events-none absolute right-0 top-0 h-5 w-5 rounded-tr-md border-r-2 border-t-2 border-primary" />
                    <span className="pointer-events-none absolute bottom-0 left-0 h-5 w-5 rounded-bl-md border-b-2 border-l-2 border-primary" />
                    <span className="pointer-events-none absolute bottom-0 right-0 h-5 w-5 rounded-br-md border-b-2 border-r-2 border-primary" />
                    {/* Documento simulado */}
                    <div className="flex h-24 w-16 flex-col gap-1.5 rounded-md bg-muted/60 p-2">
                      <span className="h-1.5 w-3/4 rounded-full bg-primary/70" />
                      <span className="h-1 w-full rounded-full bg-foreground/20" />
                      <span className="h-1 w-5/6 rounded-full bg-foreground/20" />
                      <span className="h-1 w-full rounded-full bg-foreground/20" />
                      <span className="h-1 w-2/3 rounded-full bg-foreground/20" />
                      <span className="mt-auto h-1.5 w-1/2 rounded-full bg-primary/70" />
                    </div>
                    {/* Check de éxito */}
                    <span className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full bg-[color:var(--status-success-strong)] text-white shadow">
                      <Check className="h-4 w-4" strokeWidth={3} />
                    </span>
                  </div>

                  {trabajando ? (
                    <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      {subiendo ? "Subiendo factura..." : "Procesando con IA, puede tardar unos segundos..."}
                    </div>
                  ) : selectedFile ? (
                    <div className="flex items-center justify-center gap-2 text-sm font-semibold text-foreground">
                      <FileText className="h-4 w-4 text-primary" />
                      <span className="max-w-[280px] truncate" title={selectedFile.name}>{selectedFile.name}</span>
                    </div>
                  ) : (
                    <>
                      <p className="text-sm font-bold text-foreground">Tocá para subir o arrastrá un archivo</p>
                      <p className="mt-1 text-xs text-muted-foreground">Foto (JPG, PNG, WEBP · 5 MB) o PDF · 10 MB</p>
                    </>
                  )}

                  <div className="mx-auto mt-5 grid max-w-md grid-cols-1 gap-x-6 gap-y-1.5 text-left text-xs sm:grid-cols-2">
                    {TIPS_FOTO.map((tip) => (
                      <div key={tip.texto} className="flex items-center gap-1.5">
                        {tip.ok ? (
                          <Check className="h-3.5 w-3.5 shrink-0 text-[color:var(--status-success-strong)]" strokeWidth={3} />
                        ) : (
                          <X className="h-3.5 w-3.5 shrink-0 text-destructive" strokeWidth={3} />
                        )}
                        <span className={tip.ok ? "text-[color:var(--status-success-strong)]" : "text-destructive"}>{tip.texto}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

          {items && factura && (
            <div className="flex-1 min-h-0 flex flex-col gap-5 px-8 py-6 overflow-hidden">
              {/* Card de datos de la factura (siempre visible, no scrollea) */}
              <div className="shrink-0 rounded-2xl border border-border bg-card p-6">
                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
                  <div>
                    <Label className="mb-2 block text-xs font-medium text-muted-foreground">Proveedor (existente)</Label>
                    <div className="relative">
                      <User className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Select
                        value={factura.proveedorId ? String(factura.proveedorId) : "none"}
                        onValueChange={(v) => guardarCampoFactura({ proveedorId: v === "none" ? null : Number(v) })}
                        disabled={facturaBloqueada}
                      >
                        <SelectTrigger className={cn(FACTURA_FIELD_CLASS, "w-full pl-10")}>
                          <SelectValue placeholder="Sin asignar" />
                        </SelectTrigger>
                        <SelectContent position="popper" align="start" sideOffset={4}>
                          <SelectItem value="none">Sin asignar</SelectItem>
                          {proveedores.map((p) => (
                            <SelectItem key={p.id} value={String(p.id)}>{p.nombre}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div>
                    <Label className="mb-2 block text-xs font-medium text-muted-foreground">Nombre detectado</Label>
                    <div className="relative">
                      <Building2 className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        value={factura.proveedorNombreDetectado ?? ""}
                        onChange={(e) => updateFacturaLocal({ proveedorNombreDetectado: e.target.value })}
                        onBlur={(e) => guardarCampoFactura({ proveedorNombreDetectado: e.target.value || null })}
                        disabled={facturaBloqueada}
                        placeholder="No detectado"
                        className={cn(FACTURA_FIELD_CLASS, "pl-10")}
                      />
                    </div>
                  </div>
                  <div>
                    <Label className="mb-2 block text-xs font-medium text-muted-foreground">CUIT detectado</Label>
                    <div className="relative">
                      <ScanLine className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        value={factura.proveedorCuitDetectado ?? ""}
                        onChange={(e) => updateFacturaLocal({ proveedorCuitDetectado: e.target.value })}
                        onBlur={(e) => guardarCampoFactura({ proveedorCuitDetectado: e.target.value || null })}
                        disabled={facturaBloqueada}
                        placeholder="No detectado"
                        className={cn(FACTURA_FIELD_CLASS, "pl-10")}
                      />
                    </div>
                  </div>
                  <div>
                    <Label className="mb-2 block text-xs font-medium text-muted-foreground">N° de factura</Label>
                    <div className="relative">
                      <Hash className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        value={factura.numeroFactura ?? ""}
                        onChange={(e) => updateFacturaLocal({ numeroFactura: e.target.value })}
                        onBlur={(e) => guardarCampoFactura({ numeroFactura: e.target.value || null })}
                        disabled={facturaBloqueada}
                        placeholder="—"
                        className={cn(FACTURA_FIELD_CLASS, "pl-10")}
                      />
                    </div>
                  </div>
                </div>

                <div className="mt-5 grid grid-cols-1 gap-5 xl:grid-cols-3">
                  <div>
                    <Label className="mb-2 block text-xs font-medium text-muted-foreground">Fecha</Label>
                    <div className="relative">
                      <Calendar className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        type="date"
                        value={factura.fecha ? factura.fecha.slice(0, 10) : ""}
                        onChange={(e) => updateFacturaLocal({ fecha: e.target.value || null })}
                        onBlur={(e) => guardarCampoFactura({ fecha: e.target.value || null })}
                        disabled={facturaBloqueada}
                        className={cn(FACTURA_FIELD_CLASS, "pl-10")}
                      />
                    </div>
                  </div>
                  <div>
                    <Label className="mb-2 block text-xs font-medium text-muted-foreground">Moneda</Label>
                    <div className="relative">
                      <CircleDollarSign className="pointer-events-none absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Select
                        value={monedaFactura}
                        onValueChange={(v) => guardarCampoFactura({ moneda: v })}
                        disabled={facturaBloqueada}
                      >
                        <SelectTrigger className={cn(FACTURA_FIELD_CLASS, "w-full pl-10")}>
                          <SelectValue placeholder="ARS" />
                        </SelectTrigger>
                        <SelectContent position="popper" align="start" sideOffset={4}>
                          <SelectItem value="ARS">ARS</SelectItem>
                          <SelectItem value="USD">USD</SelectItem>
                          {monedaFactura !== "ARS" && monedaFactura !== "USD" && (
                            <SelectItem value={monedaFactura}>{monedaFactura}</SelectItem>
                          )}
                        </SelectContent>
                      </Select>
                    </div>
                    {facturaEnMonedaExtranjera && (
                      <p className="mt-1 text-[11px] text-muted-foreground">
                        {puedeConvertir
                          ? `Convirtiendo a ARS con dólar blue ($${cotizacionDolar?.toLocaleString("es-AR")}). El backend recalcula al confirmar.`
                          : "El costo se convierte a ARS al confirmar cada item."}
                      </p>
                    )}
                  </div>
                  <div>
                    <Label className="mb-2 block text-xs font-medium text-muted-foreground">Total ({monedaFactura})</Label>
                    <div className="relative">
                      <FileText className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        type="number"
                        step="0.01"
                        value={factura.totalDetectado ?? ""}
                        onChange={(e) => updateFacturaLocal({ totalDetectado: parseNumeroOpcional(e.target.value) })}
                        onBlur={(e) => guardarCampoFactura({ totalDetectado: parseNumeroOpcional(e.target.value) })}
                        disabled={facturaBloqueada}
                        placeholder="—"
                        className={cn(FACTURA_FIELD_CLASS, "pl-10")}
                      />
                    </div>
                    {puedeConvertir && factura.totalDetectado != null && (
                      <p className="mt-1 text-[11px] font-semibold text-primary">
                        = {formatearArs(convertirAArs(factura.totalDetectado)!)} ARS
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {items.length > 0 ? (
                <>
                  {/* Banner de advertencia */}
                  <div className="shrink-0 flex items-center gap-2 rounded-xl border border-[color:var(--status-warning)]/30 bg-[color:var(--status-warning)]/10 px-4 py-3 text-sm text-[color:var(--status-warning)]">
                    <AlertTriangle className="h-4 w-4 shrink-0" />
                    Revisá cada línea antes de confirmar. Nada actualiza tu stock hasta que lo apruebes.
                  </div>

                  {/* Tabla de productos detectados (scroll interno) */}
                  <TooltipProvider>
                  <div className="min-h-0 flex flex-col overflow-hidden rounded-2xl border border-border bg-card/60">
                    {/* Encabezado de columnas (solo desktop) */}
                    <div className={cn("hidden xl:grid shrink-0 gap-4 border-b border-border bg-muted/40 px-5 h-12 items-center text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground", ITEM_TABLE_COLUMNS)}>
                      <span>Descripción detectada</span>
                      <span>Cant.</span>
                      <span>Costo unit.{facturaEnMonedaExtranjera ? " → ARS" : ""}</span>
                      <span>Coincidencia</span>
                      <span className="text-right">Acciones</span>
                    </div>

                    <div className="overflow-y-auto max-h-[320px] divide-y divide-border [scrollbar-width:thin] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-border">
                      {items.map((item) => {
                        const badge = badgeEstado(item);
                        const BadgeIcon = badge.icon;
                        const terminal = ESTADOS_TERMINALES.has(item.estado);
                        const busy = busyItemId === item.id;
                        const mostrarCodigo = !codigoYaEnDescripcion(item);
                        const costoArs = puedeConvertir ? convertirAArs(item.precioUnitario) : null;
                        const requiereAlta = !item.productoId;

                        return (
                          <div
                            key={item.id}
                            className={cn(
                              "grid grid-cols-1 gap-4 px-5 py-4 min-h-[96px] items-start xl:items-center",
                              ITEM_TABLE_COLUMNS,
                              terminal ? "opacity-60 bg-muted/30" : "hover:bg-muted/30"
                            )}
                          >
                            {/* Descripción — siempre editable: si no hay producto existente que coincida, no hay ninguna existencia previa que la fije */}
                            <div className="flex items-start gap-3 min-w-0">
                              <div className="mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-primary/15">
                                <Package className="h-4 w-4" />
                              </div>
                              <div className="min-w-0 flex-1 space-y-1">
                                <Label className={ITEM_LABEL_CLASS}>Descripción detectada</Label>
                                <Input
                                  aria-label={`Descripción detectada para línea ${item.id}`}
                                  value={item.textoOriginal}
                                  onChange={(e) => updateItem(item.id, { textoOriginal: e.target.value })}
                                  onBlur={(e) => guardarCampoItem(item, { textoOriginal: e.target.value })}
                                  disabled={terminal || busy}
                                  className={cn(ITEM_FIELD_CLASS, "font-medium")}
                                />
                                {mostrarCodigo && item.codigoProveedor && (
                                  <p className="text-[11px] font-mono text-muted-foreground">#{item.codigoProveedor}</p>
                                )}
                                {item.advertencias.length > 0 && (
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <div className="flex items-start gap-1 pt-0.5 text-[11px] text-[color:var(--status-warning)] cursor-help">
                                        <AlertTriangle className="h-3 w-3 shrink-0 mt-0.5" />
                                        <span className="line-clamp-1">Revisar: posible desalineación de cantidad/precio</span>
                                      </div>
                                    </TooltipTrigger>
                                    <TooltipContent side="bottom" sideOffset={4} className="max-w-xs">
                                      {item.advertencias.map((advertencia, i) => (
                                        <p key={i}>{advertencia}</p>
                                      ))}
                                    </TooltipContent>
                                  </Tooltip>
                                )}
                                {item.atributosExtra && Object.keys(item.atributosExtra).length > 0 && (
                                  <div className="flex flex-wrap gap-1 pt-0.5">
                                    {Object.entries(item.atributosExtra).map(([clave, valor]) => (
                                      <Badge key={clave} variant="outline" className="text-[10px] h-5 px-1.5 font-normal text-muted-foreground border-border/60 bg-background/50 rounded-md">
                                        {clave}: {valor}
                                      </Badge>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* Cantidad */}
                            <div className="space-y-1">
                              <Label className={ITEM_LABEL_CLASS}>Cantidad</Label>
                              <Input
                                aria-label={`Cantidad para ${item.textoOriginal}`}
                                type="number"
                                min={1}
                                step="1"
                                value={item.cantidad}
                                onChange={(e) => {
                                  const n = Number(e.target.value);
                                  if (Number.isFinite(n)) updateItem(item.id, { cantidad: n });
                                }}
                                onBlur={(e) => {
                                  const n = Math.max(1, Math.trunc(Number(e.target.value) || item.cantidad));
                                  guardarCampoItem(item, { cantidad: n });
                                }}
                                disabled={terminal || busy}
                                className={cn(ITEM_FIELD_CLASS, "text-center tabular-nums")}
                              />
                            </div>

                            {/* Costo unitario (con conversión a ARS en vivo) */}
                            <div className="space-y-1">
                              <Label className={ITEM_LABEL_CLASS}>Costo unit. ({monedaFactura})</Label>
                              <Input
                                aria-label={`Costo unitario para ${item.textoOriginal} en ${monedaFactura}`}
                                type="number"
                                step="0.01"
                                value={item.precioUnitario ?? ""}
                                onChange={(e) => updateItem(item.id, { precioUnitario: parseNumeroOpcional(e.target.value) })}
                                onBlur={(e) => guardarCampoItem(item, { precioUnitario: parseNumeroOpcional(e.target.value) })}
                                disabled={terminal || busy}
                                placeholder="—"
                                className={cn(ITEM_FIELD_CLASS, "tabular-nums")}
                              />
                              {costoArs != null && (
                                <p className="text-[11px] font-semibold text-primary">
                                  = {formatearArs(costoArs)} ARS
                                </p>
                              )}
                            </div>

                            {/* Coincidencia */}
                            <div className="space-y-1 min-w-0">
                              <Label className={ITEM_LABEL_CLASS}>Coincidencia</Label>
                              <span className={`flex items-center gap-1.5 text-xs font-medium ${badge.cls}`}>
                                <BadgeIcon className="h-3.5 w-3.5 shrink-0" />
                                <span className="truncate">{badge.label}</span>
                              </span>
                              {!terminal && (
                                <>
                                  <Select
                                    value={item.productoId ? String(item.productoId) : "none"}
                                    onValueChange={(v) => updateItem(item.id, { productoId: v === "none" ? null : Number(v) })}
                                    disabled={busy}
                                  >
                                    <SelectTrigger aria-label={`Producto existente para ${item.textoOriginal}`} className={cn(ITEM_FIELD_CLASS, "w-full text-sm")}>
                                      <SelectValue placeholder="Elegir producto existente" />
                                    </SelectTrigger>
                                    <SelectContent position="popper" align="start" sideOffset={4}>
                                      <SelectItem value="none">Sin producto (crear nuevo)</SelectItem>
                                      {productos.map((p) => (
                                        <SelectItem key={p.id} value={String(p.id)}>{p.nombre}</SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                  {requiereAlta && (
                                    <p className="text-[11px] text-muted-foreground">
                                      Si no existe, abrilo con <span className="font-semibold text-primary">crear producto</span> para completar precio de venta, categoría y stock inicial.
                                    </p>
                                  )}
                                  {requiereAlta && item.candidatoGlobalNombre && (
                                    <p className="flex items-start gap-1 text-[11px] text-primary">
                                      <Sparkles className="h-3 w-3 shrink-0 mt-0.5" />
                                      <span>
                                        Catálogo global sugiere: <span className="font-semibold">{item.candidatoGlobalNombre}</span>
                                        {item.candidatoGlobalScore != null && ` (${Math.round(item.candidatoGlobalScore)}%)`}
                                      </span>
                                    </p>
                                  )}
                                </>
                              )}
                            </div>

                            {/* Acciones */}
                            <div className="xl:justify-self-end xl:self-center">
                              {!terminal && (
                                <div role="group" aria-label={`Acciones para ${item.textoOriginal}`} className="flex items-center justify-start gap-2 xl:justify-end">
                                  {item.productoId && (
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <Button
                                          type="button"
                                          size="icon-sm"
                                          aria-label={`Confirmar coincidencia para ${item.textoOriginal}`}
                                          className={cn(ITEM_ACTION_ICON_CLASS, "border-[color:var(--status-success-strong)]/35 bg-[color:var(--status-success-strong)]/14 text-[color:var(--status-success-strong)] hover:bg-[color:var(--status-success-strong)]/22")}
                                          onClick={() => confirmarItem(item)}
                                          disabled={busy}
                                        >
                                          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                                        </Button>
                                      </TooltipTrigger>
                                      <TooltipContent side="top" sideOffset={8}>Confirmar coincidencia</TooltipContent>
                                    </Tooltip>
                                  )}

                                  {requiereAlta ? (
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <Button
                                          type="button"
                                          size="icon-sm"
                                          variant="outline"
                                          aria-label={`Crear producto para ${item.textoOriginal}`}
                                          className={cn(ITEM_ACTION_ICON_CLASS, "border-[color:var(--status-warning)]/35 bg-[color:var(--status-warning)]/12 text-[color:var(--status-warning)] hover:bg-[color:var(--status-warning)]/20")}
                                          onClick={() => setItemParaCrear(item)}
                                          disabled={busy}
                                        >
                                          <Plus className="h-4 w-4" />
                                        </Button>
                                      </TooltipTrigger>
                                      <TooltipContent side="top" sideOffset={8}>Crear producto nuevo con datos precargados</TooltipContent>
                                    </Tooltip>
                                  ) : (
                                    (() => {
                                      const productoMatch = productos.find((p) => p.id === item.productoId);
                                      if (!productoMatch) return null;
                                      return (
                                        <Tooltip>
                                          <TooltipTrigger asChild>
                                            <EditProductoDialog
                                              producto={productoMatch}
                                              onUpdated={() => apiService.getProductos().then(setProductos).catch(() => {})}
                                              open={itemIdParaEditar === item.id}
                                              onOpenChange={(v) => setItemIdParaEditar(v ? item.id : null)}
                                              trigger={
                                                <Button
                                                  type="button"
                                                  size="icon-sm"
                                                  variant="outline"
                                                  aria-label={`Editar producto existente para ${item.textoOriginal}`}
                                                  className={cn(ITEM_ACTION_ICON_CLASS, "border-primary/30 bg-primary/10 text-primary hover:bg-primary/18")}
                                                  disabled={busy}
                                                >
                                                  <PencilLine className="h-4 w-4" />
                                                </Button>
                                              }
                                            />
                                          </TooltipTrigger>
                                          <TooltipContent side="top" sideOffset={8}>Editar el producto ya existente que coincidió</TooltipContent>
                                        </Tooltip>
                                      );
                                    })()
                                  )}

                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Button
                                        type="button"
                                        size="icon-sm"
                                        variant="ghost"
                                        aria-label={`Ignorar línea ${item.textoOriginal}`}
                                        className={cn(ITEM_ACTION_ICON_CLASS, "border-border bg-transparent text-muted-foreground hover:border-[color:var(--status-warning)]/40 hover:bg-[color:var(--status-warning)]/10 hover:text-[color:var(--status-warning)]")}
                                        onClick={() => ignorarItem(item)}
                                        disabled={busy}
                                      >
                                        <X className="h-4 w-4" />
                                      </Button>
                                    </TooltipTrigger>
                                    <TooltipContent side="top" sideOffset={8}>Ignorar línea</TooltipContent>
                                  </Tooltip>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  </TooltipProvider>
                </>
              ) : (
                <div className="flex-1 min-h-0 flex items-center justify-center text-sm text-muted-foreground">
                  No se detectaron líneas de producto. Probá con otra imagen.
                </div>
              )}
            </div>
          )}

          <div className="shrink-0 flex items-center justify-between gap-3 border-t border-border px-8 py-5">
            <div className="flex min-w-0 items-center gap-2 text-sm text-muted-foreground">
              {selectedFile && (
                <>
                  <FileText className="h-4 w-4 shrink-0" />
                  <span className="truncate" title={selectedFile.name}>{selectedFile.name}</span>
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-[color:var(--status-success-strong)]" />
                </>
              )}
            </div>
            <div className="flex shrink-0 gap-3">
              <Button
                type="button"
                variant="outline"
                className="h-11 shrink-0 whitespace-nowrap px-6"
                onClick={() => setOpen(false)}
                disabled={trabajando}
              >
                Cancelar
              </Button>
              {items && factura ? (
                <Button
                  type="button"
                  className="h-11 shrink-0 whitespace-nowrap px-6 font-semibold"
                  onClick={confirmarTodosSeguros}
                  disabled={confirmandoTodos || facturaBloqueada}
                >
                  {confirmandoTodos ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                  Confirmar todo
                </Button>
              ) : (
                <Button
                  type="button"
                  className="h-11 shrink-0 whitespace-nowrap px-6 font-semibold"
                  onClick={analizarFactura}
                  disabled={!selectedFile || trabajando || sinCupo}
                >
                  {trabajando ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <ScanText className="h-4 w-4" />
                  )}
                  Analizar factura
                </Button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {itemParaCrear && (
        <CreateProductoDialog
          open={Boolean(itemParaCrear)}
          onOpenChange={(v) => { if (!v) setItemParaCrear(null); }}
          initialValues={initialValuesParaNuevoProducto(itemParaCrear)}
          submitFn={(payload) => apiService.createProductoDesdeFacturaItem(itemParaCrear.id, payload).then((res): ProductoCreado => {
            if (res.tipoCambioAplicado) {
              toast.message(`Costo convertido a ARS con cotización $${res.tipoCambioAplicado.toLocaleString("es-AR")}`);
            } else if (res.advertenciaConversion) {
              toast.warning(res.advertenciaConversion);
            }
            return {
              id: res.producto.id,
              nombre: res.producto.nombre,
              sku: null,
              codigoBarra: res.producto.codigoBarra ?? null,
              stockDisponibleUnits: Number((res.producto as { stockDisponibleUnits?: unknown }).stockDisponibleUnits ?? 0),
            };
          })}
          onProductoCreado={() => {
            updateItem(itemParaCrear.id, { estado: "PRODUCTO_CREADO" });
            setItemParaCrear(null);
            onCreated?.();
          }}
        />
      )}
    </>
  );
}
