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
import { Textarea } from "@/components/ui/textarea";
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
import { ScanText, Loader2, AlertTriangle, CheckCircle2, XCircle, HelpCircle, Sparkles, Check, X, FileText } from "lucide-react";
import { toast } from "sonner";
import { CreateProductoDialog, type CreateProductoInitialValues, type ProductoCreado } from "./create-producto-dialog";

const ESTADOS_TERMINALES = new Set(["CONFIRMADO", "PRODUCTO_CREADO", "IGNORADO"]);

function badgeEstado(item: FacturaProveedorItem) {
  switch (item.estado) {
    case "COINCIDENCIA_SEGURA":
      return { label: `${item.producto?.nombre ?? "Producto sugerido"} (${Math.round((item.matchScore ?? 0) * 100)}%)`, cls: "text-[color:var(--status-success-strong)]", icon: CheckCircle2 };
    case "COINCIDENCIA_PROBABLE":
      return { label: `${item.producto?.nombre ?? "Producto sugerido"} (${Math.round((item.matchScore ?? 0) * 100)}%)`, cls: "text-[color:var(--status-success-strong)]", icon: CheckCircle2 };
    case "REQUIERE_REVISION":
      return { label: item.producto ? `${item.producto.nombre} (${Math.round((item.matchScore ?? 0) * 100)}%) — revisar` : "Revisar manualmente", cls: "text-[color:var(--status-warning)]", icon: HelpCircle };
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

const TIPS_FOTO: { ok: boolean; texto: string }[] = [
  { ok: true, texto: "Buena iluminación" },
  { ok: true, texto: "Texto legible" },
  { ok: true, texto: "Factura completa visible" },
  { ok: false, texto: "Sin reflejos ni sombras" },
  { ok: false, texto: "No capturas de pantalla" },
];

const ACCEPT_FACTURA = "image/png,image/jpeg,image/webp,application/pdf";

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
  const [selectedFile, setSelectedFile] = React.useState<File | null>(null);
  const [dragActive, setDragActive] = React.useState(false);
  const [usage, setUsage] = React.useState<FacturaProveedorUsage | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (!open) {
      setFactura(null);
      setItems(null);
      setSubiendo(false);
      setProcesando(false);
      setSelectedFile(null);
      setDragActive(false);
      setUsage(null);
      setItemParaCrear(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }
    apiService.getProductos().then(setProductos).catch(() => setProductos([]));
    apiService.getProveedores().then(setProveedores).catch(() => setProveedores([]));
    apiService.getFacturaProveedorUsage().then(setUsage).catch(() => setUsage(null));
  }, [open]);

  const trabajando = subiendo || procesando;
  const sinCupo = usage != null && (!usage.hasFeature || (usage.limit !== -1 && usage.used >= usage.limit));

  function elegirArchivo(file: File | null | undefined) {
    if (!file || trabajando) return;
    setSelectedFile(file);
  }

  function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
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

  function initialValuesParaNuevoProducto(item: FacturaProveedorItem): CreateProductoInitialValues {
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
      nombre: normalizarNombreSugerido(item.textoOriginal),
      precioCosto: precioEstimadoArs,
      stockDisponibleUnits: item.cantidad,
    };
  }

  const haySeguros = (items ?? []).some((i) => i.estado === "COINCIDENCIA_SEGURA");
  const facturaBloqueada = factura?.estado === "CONFIRMADA" || factura?.estado === "CANCELADA";
  const monedaFactura = (factura?.moneda ?? "ARS").trim().toUpperCase();

  function parseNumeroOpcional(valor: string): number | null {
    if (!valor.trim()) return null;
    const n = Number(valor);
    return Number.isFinite(n) ? n : null;
  }

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          {trigger || (
            <Button variant="ghost" size="sm" className="h-9 px-3 rounded-lg font-bold text-sm">
              <ScanText className="h-3.5 w-3.5 mr-1.5" />
              Cargar por factura (OCR)
            </Button>
          )}
        </DialogTrigger>

        <DialogContent className="sm:max-w-[900px] p-0 overflow-hidden border-none shadow-2xl bg-background">
          <DialogHeader className="p-6 pb-2 border-b bg-muted/20">
            <div className="flex items-center gap-2 text-primary">
              <ScanText className="h-5 w-5" />
              <DialogTitle className="text-xl font-bold tracking-tight">Escanear factura de compra</DialogTitle>
            </div>
            <DialogDescription>
              Subí o sacá una foto de la factura del proveedor para cargar stock automáticamente con IA.
            </DialogDescription>
          </DialogHeader>

          <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto w-full">
            {!items && (
              <div className="space-y-4">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept={ACCEPT_FACTURA}
                  onChange={handleFileInput}
                  disabled={trabajando}
                  className="hidden"
                />

                {usage && usage.hasFeature && (
                  <div className="flex items-center justify-between rounded-lg border bg-muted/30 px-4 py-3 text-sm">
                    <span className="text-muted-foreground">Escaneos usados este mes</span>
                    <span className="font-semibold tabular-nums">
                      {usage.used} / {usage.limit === -1 ? "∞" : usage.limit}
                    </span>
                  </div>
                )}

                {usage && !usage.hasFeature && (
                  <div className="flex items-start gap-2 rounded-lg border border-[color:var(--status-warning)]/40 bg-[color:var(--status-warning)]/10 px-4 py-3 text-sm text-[color:var(--status-warning)]">
                    <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                    La carga de facturas con IA está disponible sólo en el plan Enterprise. Actualizá tu plan para usarla.
                  </div>
                )}

                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => !trabajando && !sinCupo && fileInputRef.current?.click()}
                  onKeyDown={(e) => {
                    if ((e.key === "Enter" || e.key === " ") && !trabajando && !sinCupo) {
                      e.preventDefault();
                      fileInputRef.current?.click();
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
                      : "border-border hover:border-primary/60 hover:bg-muted/20"
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
              <>
                <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
                  <p className="text-[10px] font-bold uppercase text-muted-foreground">
                    Datos de la factura {facturaBloqueada ? "(confirmada, ya no editable)" : "— corregí lo que la IA haya leído mal"}
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-[10px] font-bold uppercase text-muted-foreground">Proveedor (existente)</Label>
                      <Select
                        value={factura.proveedorId ? String(factura.proveedorId) : "none"}
                        onValueChange={(v) => guardarCampoFactura({ proveedorId: v === "none" ? null : Number(v) })}
                        disabled={facturaBloqueada}
                      >
                        <SelectTrigger className="h-9 bg-background text-sm">
                          <SelectValue placeholder="Sin asignar" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Sin asignar</SelectItem>
                          {proveedores.map((p) => (
                            <SelectItem key={p.id} value={String(p.id)}>{p.nombre}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px] font-bold uppercase text-muted-foreground">Nombre detectado</Label>
                      <Input
                        value={factura.proveedorNombreDetectado ?? ""}
                        onChange={(e) => updateFacturaLocal({ proveedorNombreDetectado: e.target.value })}
                        onBlur={(e) => guardarCampoFactura({ proveedorNombreDetectado: e.target.value || null })}
                        disabled={facturaBloqueada}
                        placeholder="No detectado"
                        className="h-9 bg-background text-sm"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px] font-bold uppercase text-muted-foreground">CUIT detectado</Label>
                      <Input
                        value={factura.proveedorCuitDetectado ?? ""}
                        onChange={(e) => updateFacturaLocal({ proveedorCuitDetectado: e.target.value })}
                        onBlur={(e) => guardarCampoFactura({ proveedorCuitDetectado: e.target.value || null })}
                        disabled={facturaBloqueada}
                        placeholder="No detectado"
                        className="h-9 bg-background text-sm"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px] font-bold uppercase text-muted-foreground">N° de factura</Label>
                      <Input
                        value={factura.numeroFactura ?? ""}
                        onChange={(e) => updateFacturaLocal({ numeroFactura: e.target.value })}
                        onBlur={(e) => guardarCampoFactura({ numeroFactura: e.target.value || null })}
                        disabled={facturaBloqueada}
                        placeholder="—"
                        className="h-9 bg-background text-sm"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px] font-bold uppercase text-muted-foreground">Fecha</Label>
                      <Input
                        type="date"
                        value={factura.fecha ? factura.fecha.slice(0, 10) : ""}
                        onChange={(e) => updateFacturaLocal({ fecha: e.target.value || null })}
                        onBlur={(e) => guardarCampoFactura({ fecha: e.target.value || null })}
                        disabled={facturaBloqueada}
                        className="h-9 bg-background text-sm"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px] font-bold uppercase text-muted-foreground">Moneda</Label>
                      <Input
                        value={factura.moneda}
                        onChange={(e) => updateFacturaLocal({ moneda: e.target.value.toUpperCase() })}
                        onBlur={(e) => guardarCampoFactura({ moneda: e.target.value.trim().toUpperCase() || "ARS" })}
                        disabled={facturaBloqueada}
                        placeholder="ARS"
                        className="h-9 bg-background text-sm uppercase"
                      />
                      {monedaFactura !== "ARS" && (
                        <p className="text-[10px] text-muted-foreground">
                          El costo se convierte a ARS con la cotización del dólar blue al confirmar cada item.
                        </p>
                      )}
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px] font-bold uppercase text-muted-foreground">Total</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={factura.totalDetectado ?? ""}
                        onChange={(e) => updateFacturaLocal({ totalDetectado: parseNumeroOpcional(e.target.value) })}
                        onBlur={(e) => guardarCampoFactura({ totalDetectado: parseNumeroOpcional(e.target.value) })}
                        disabled={facturaBloqueada}
                        placeholder="—"
                        className="h-9 bg-background text-sm"
                      />
                    </div>
                  </div>
                </div>

                {items.length > 0 && (
                  <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground bg-muted/30 rounded-lg p-3">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 shrink-0 text-[color:var(--status-warning)]" />
                      Revisá cada línea antes de confirmar. Nada actualiza tu stock hasta que lo apruebes.
                    </div>
                    {haySeguros && (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-8 shrink-0"
                        onClick={confirmarTodosSeguros}
                        disabled={confirmandoTodos}
                      >
                        {confirmandoTodos ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Confirmar todas las coincidencias seguras"}
                      </Button>
                    )}
                  </div>
                )}

                <div className="space-y-3">
                  {items.map((item) => {
                    const badge = badgeEstado(item);
                    const Icon = badge.icon;
                    const terminal = ESTADOS_TERMINALES.has(item.estado);
                    const busy = busyItemId === item.id;
                    const costoArsEstimado =
                      item.precioUnitario != null && monedaFactura === "USD" && cotizacionDolar
                        ? item.precioUnitario * cotizacionDolar
                        : null;

                    return (
                      <div
                        key={item.id}
                        className={`rounded-lg border p-3 space-y-3 ${terminal ? "opacity-60 bg-muted/20" : "bg-background"}`}
                      >
                        <div className="grid grid-cols-1 sm:grid-cols-[1fr_160px] gap-3">
                          <div className="space-y-1">
                            <Label className="text-[10px] font-bold uppercase text-muted-foreground">Descripción detectada</Label>
                            <Textarea
                              value={item.textoOriginal}
                              onChange={(e) => updateItem(item.id, { textoOriginal: e.target.value })}
                              onBlur={(e) => guardarCampoItem(item, { textoOriginal: e.target.value })}
                              disabled={terminal || busy}
                              rows={2}
                              className="resize-none text-sm bg-background break-words whitespace-normal"
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-[10px] font-bold uppercase text-muted-foreground">Cód. proveedor</Label>
                            <Input
                              value={item.codigoProveedor ?? ""}
                              onChange={(e) => updateItem(item.id, { codigoProveedor: e.target.value })}
                              onBlur={(e) => guardarCampoItem(item, { codigoProveedor: e.target.value || null })}
                              disabled={terminal || busy}
                              placeholder="—"
                              className="h-9 bg-background text-sm"
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                          <div className="space-y-1">
                            <Label className="text-[10px] font-bold uppercase text-muted-foreground">Cantidad</Label>
                            <Input
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
                              className="h-9 bg-background text-sm"
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-[10px] font-bold uppercase text-muted-foreground">Costo unitario ({monedaFactura})</Label>
                            <Input
                              type="number"
                              step="0.01"
                              value={item.precioUnitario ?? ""}
                              onChange={(e) => updateItem(item.id, { precioUnitario: parseNumeroOpcional(e.target.value) })}
                              onBlur={(e) => guardarCampoItem(item, { precioUnitario: parseNumeroOpcional(e.target.value) })}
                              disabled={terminal || busy}
                              placeholder="—"
                              className="h-9 bg-background text-sm"
                            />
                            {costoArsEstimado != null && (
                              <p className="text-[10px] text-muted-foreground">
                                ≈ ${costoArsEstimado.toLocaleString("es-AR", { maximumFractionDigits: 0 })} ARS (cotización blue)
                              </p>
                            )}
                          </div>
                          <div className="col-span-2 space-y-1">
                            <Label className="text-[10px] font-bold uppercase text-muted-foreground">Coincidencia</Label>
                            <span className={`text-xs font-medium flex items-center gap-1 ${badge.cls}`}>
                              <Icon className="h-3.5 w-3.5 shrink-0" />
                              {badge.label}
                            </span>
                            {!terminal && item.productoId && (
                              <Select
                                value={String(item.productoId)}
                                onValueChange={(v) => updateItem(item.id, { productoId: Number(v) })}
                                disabled={busy}
                              >
                                <SelectTrigger className="h-8 text-xs bg-muted/20">
                                  <SelectValue placeholder="Elegir otro producto" />
                                </SelectTrigger>
                                <SelectContent>
                                  {productos.map((p) => (
                                    <SelectItem key={p.id} value={String(p.id)}>{p.nombre}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            )}
                          </div>
                        </div>

                        {!terminal && (
                          <div className="flex justify-end gap-1.5">
                            {item.productoId && (
                              <Button
                                type="button"
                                size="sm"
                                className="h-8"
                                onClick={() => confirmarItem(item)}
                                disabled={busy}
                              >
                                {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Confirmar"}
                              </Button>
                            )}
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              className="h-8"
                              onClick={() => setItemParaCrear(item)}
                              disabled={busy}
                            >
                              Nuevo producto
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              className="h-8"
                              onClick={() => ignorarItem(item)}
                              disabled={busy}
                            >
                              Ignorar
                            </Button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </>
            )}

            {items && items.length === 0 && (
              <div className="text-sm text-muted-foreground text-center py-8">
                No se detectaron líneas de producto. Probá con otra imagen.
              </div>
            )}

            <div className="flex justify-end gap-3 pt-2">
              <Button
                type="button"
                variant="outline"
                className="h-11 px-6"
                onClick={() => setOpen(false)}
                disabled={trabajando}
              >
                {items ? "Cerrar" : "Cancelar"}
              </Button>
              {!items && (
                <Button
                  type="button"
                  className="h-11 px-6 font-semibold"
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
