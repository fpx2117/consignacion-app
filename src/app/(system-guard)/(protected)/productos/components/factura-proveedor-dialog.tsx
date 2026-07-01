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
import { ScanText, Loader2, AlertTriangle, CheckCircle2, XCircle, HelpCircle, Sparkles, Check, X, FileText, User, Building2, Hash, Calendar, CircleDollarSign, ScanLine, Package } from "lucide-react";
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
  // Mientras se resuelve el cupo (usage === null) tampoco se muestra, para
  // evitar que el botón aparezca y desaparezca en planes sin acceso.
  if (!usage?.hasFeature) return null;

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

        <DialogContent className="p-0 gap-0 flex flex-col overflow-hidden border border-[#2A2F3A] bg-[#0F1117] rounded-[28px] sm:rounded-[28px] shadow-2xl w-[90vw] max-w-[1280px] sm:max-w-[1280px] max-h-[85vh]">
          <DialogHeader className="shrink-0 border-b border-[#2A2F3A] px-8 py-7">
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
                <div className="flex items-center justify-between rounded-xl border border-[#2A2F3A] bg-[#11151C] px-4 py-3 text-sm">
                  <span className="text-muted-foreground">Escaneos usados este mes</span>
                  <span className="font-semibold tabular-nums">
                    {usage.used} / {usage.limit === -1 ? "∞" : usage.limit}
                  </span>
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
                    ? "opacity-50 cursor-not-allowed border-[#2A2F3A]"
                    : "cursor-pointer focus-visible:ring-2 focus-visible:ring-primary"
                } ${
                  dragActive
                    ? "border-primary bg-primary/5"
                    : "border-[#2A2F3A] hover:border-primary/60 hover:bg-white/[0.02]"
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
              <div className="shrink-0 rounded-2xl border border-[#2A2F3A] bg-[#0B0D12] p-6">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <div>
                    <Label className="mb-2 block text-xs font-medium text-muted-foreground">Proveedor (existente)</Label>
                    <div className="relative">
                      <User className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Select
                        value={factura.proveedorId ? String(factura.proveedorId) : "none"}
                        onValueChange={(v) => guardarCampoFactura({ proveedorId: v === "none" ? null : Number(v) })}
                        disabled={facturaBloqueada}
                      >
                        <SelectTrigger className="h-[52px] w-full rounded-xl border-[#2A2F3A] bg-[#11151C] pl-10 text-sm">
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
                        className="h-[52px] rounded-xl border-[#2A2F3A] bg-[#11151C] pl-10 text-sm"
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
                        className="h-[52px] rounded-xl border-[#2A2F3A] bg-[#11151C] pl-10 text-sm"
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
                        className="h-[52px] rounded-xl border-[#2A2F3A] bg-[#11151C] pl-10 text-sm"
                      />
                    </div>
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
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
                        className="h-[52px] rounded-xl border-[#2A2F3A] bg-[#11151C] pl-10 text-sm"
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
                        <SelectTrigger className="h-[52px] w-full rounded-xl border-[#2A2F3A] bg-[#11151C] pl-10 text-sm">
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
                        className="h-[52px] rounded-xl border-[#2A2F3A] bg-[#11151C] pl-10 text-sm"
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
                  <div className="min-h-0 flex flex-col overflow-hidden rounded-2xl border border-[#2A2F3A]">
                    {/* Encabezado de columnas (solo desktop) */}
                    <div className="hidden lg:grid shrink-0 grid-cols-[minmax(180px,1.4fr)_64px_110px_minmax(150px,1fr)_minmax(220px,1fr)] gap-3 border-b border-[#2A2F3A] bg-[#0B0D12] px-5 h-11 items-center text-xs font-medium text-muted-foreground">
                      <span>Descripción detectada</span>
                      <span>Cant.</span>
                      <span>Costo unit.{facturaEnMonedaExtranjera ? " → ARS" : ""}</span>
                      <span>Coincidencia</span>
                      <span className="text-right">Acciones</span>
                    </div>

                    <div className="overflow-y-auto max-h-[320px] divide-y divide-[#2A2F3A] [scrollbar-width:thin] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-[#2A2F3A]">
                      {items.map((item) => {
                        const badge = badgeEstado(item);
                        const terminal = ESTADOS_TERMINALES.has(item.estado);
                        const busy = busyItemId === item.id;
                        const mostrarCodigo = !codigoYaEnDescripcion(item);
                        const costoArs = puedeConvertir ? convertirAArs(item.precioUnitario) : null;

                        return (
                          <div
                            key={item.id}
                            className={`grid grid-cols-1 lg:grid-cols-[minmax(180px,1.4fr)_64px_110px_minmax(150px,1fr)_minmax(220px,1fr)] gap-3 px-5 py-3 min-h-[72px] items-center ${terminal ? "opacity-60 bg-white/[0.02]" : ""}`}
                          >
                            {/* Descripción — siempre editable: si no hay producto existente que coincida, no hay ninguna existencia previa que la fije */}
                            <div className="flex items-start gap-2 min-w-0">
                              <div className="mt-1.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                                <Package className="h-4 w-4" />
                              </div>
                              <div className="min-w-0 flex-1 space-y-1">
                                <Label className="lg:hidden text-[10px] font-bold uppercase text-muted-foreground">Descripción detectada</Label>
                                <Input
                                  value={item.textoOriginal}
                                  onChange={(e) => updateItem(item.id, { textoOriginal: e.target.value })}
                                  onBlur={(e) => guardarCampoItem(item, { textoOriginal: e.target.value })}
                                  disabled={terminal || busy}
                                  className="h-9 rounded-lg border-[#2A2F3A] bg-[#11151C] text-sm font-medium"
                                />
                                {mostrarCodigo && item.codigoProveedor && (
                                  <p className="text-[11px] font-mono text-muted-foreground">#{item.codigoProveedor}</p>
                                )}
                              </div>
                            </div>

                            {/* Cantidad */}
                            <div className="space-y-1">
                              <Label className="lg:hidden text-[10px] font-bold uppercase text-muted-foreground">Cantidad</Label>
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
                                className="h-10 rounded-lg border-[#2A2F3A] bg-[#11151C] text-sm"
                              />
                            </div>

                            {/* Costo unitario (con conversión a ARS en vivo) */}
                            <div className="space-y-1">
                              <Label className="lg:hidden text-[10px] font-bold uppercase text-muted-foreground">Costo unit. ({monedaFactura})</Label>
                              <Input
                                type="number"
                                step="0.01"
                                value={item.precioUnitario ?? ""}
                                onChange={(e) => updateItem(item.id, { precioUnitario: parseNumeroOpcional(e.target.value) })}
                                onBlur={(e) => guardarCampoItem(item, { precioUnitario: parseNumeroOpcional(e.target.value) })}
                                disabled={terminal || busy}
                                placeholder="—"
                                className="h-10 rounded-lg border-[#2A2F3A] bg-[#11151C] text-sm"
                              />
                              {costoArs != null && (
                                <p className="text-[11px] font-semibold text-primary">
                                  = {formatearArs(costoArs)} ARS
                                </p>
                              )}
                            </div>

                            {/* Coincidencia */}
                            <div className="space-y-1 min-w-0">
                              <Label className="lg:hidden text-[10px] font-bold uppercase text-muted-foreground">Coincidencia</Label>
                              <span className={`text-xs font-medium flex items-center gap-1.5 ${badge.cls}`}>
                                <span className="h-2 w-2 rounded-full bg-current shrink-0" />
                                <span className="truncate">{badge.label}</span>
                              </span>
                              {!terminal && (
                                <Select
                                  value={item.productoId ? String(item.productoId) : "none"}
                                  onValueChange={(v) => updateItem(item.id, { productoId: v === "none" ? null : Number(v) })}
                                  disabled={busy}
                                >
                                  <SelectTrigger className="h-9 w-full rounded-lg border-[#2A2F3A] bg-[#11151C] text-xs">
                                    <SelectValue placeholder="Elegir producto existente" />
                                  </SelectTrigger>
                                  <SelectContent position="popper" align="start" sideOffset={4}>
                                    <SelectItem value="none">Sin producto (crear nuevo)</SelectItem>
                                    {productos.map((p) => (
                                      <SelectItem key={p.id} value={String(p.id)}>{p.nombre}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              )}
                            </div>

                            {/* Acciones (una sola línea en desktop) */}
                            <div className="lg:justify-self-end">
                              {!terminal && (
                                <div className="flex flex-wrap gap-2 lg:flex-nowrap lg:justify-end">
                                  {item.productoId && (
                                    <Button
                                      type="button"
                                      size="sm"
                                      className="h-8 shrink-0 whitespace-nowrap"
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
                                    className="h-8 shrink-0 whitespace-nowrap"
                                    onClick={() => setItemParaCrear(item)}
                                    disabled={busy}
                                  >
                                    Nuevo producto
                                  </Button>
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="ghost"
                                    className="h-8 shrink-0 whitespace-nowrap"
                                    onClick={() => ignorarItem(item)}
                                    disabled={busy}
                                  >
                                    Ignorar
                                  </Button>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </>
              ) : (
                <div className="flex-1 min-h-0 flex items-center justify-center text-sm text-muted-foreground">
                  No se detectaron líneas de producto. Probá con otra imagen.
                </div>
              )}
            </div>
          )}

          <div className="shrink-0 flex items-center justify-between gap-3 border-t border-[#2A2F3A] px-8 py-5">
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
