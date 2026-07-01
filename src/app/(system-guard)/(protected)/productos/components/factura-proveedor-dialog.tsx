"use client";

import * as React from "react";
import {
  apiService,
  type FacturaProveedor,
  type FacturaProveedorItem,
  type Proveedor,
} from "@/lib/apiService";
import type { Producto } from "@/lib/types";

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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScanText, Loader2, AlertTriangle, CheckCircle2, XCircle, HelpCircle, Sparkles } from "lucide-react";
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
  const [proveedorId, setProveedorId] = React.useState<string>("");
  const [busyItemId, setBusyItemId] = React.useState<number | null>(null);
  const [confirmandoTodos, setConfirmandoTodos] = React.useState(false);
  const [itemParaCrear, setItemParaCrear] = React.useState<FacturaProveedorItem | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (!open) {
      setFactura(null);
      setItems(null);
      setSubiendo(false);
      setProcesando(false);
      setProveedorId("");
      setItemParaCrear(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }
    apiService.getProveedores().then(setProveedores).catch(() => setProveedores([]));
    apiService.getProductos().then(setProductos).catch(() => setProductos([]));
  }, [open]);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setSubiendo(true);
    try {
      const subida = await apiService.uploadFacturaProveedor(file, proveedorId ? Number(proveedorId) : null);
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
    return {
      nombre: normalizarNombreSugerido(item.textoOriginal),
      precioCosto: item.precioUnitario ?? undefined,
      stockDisponibleUnits: item.cantidad,
    };
  }

  const haySeguros = (items ?? []).some((i) => i.estado === "COINCIDENCIA_SEGURA");
  const nombreProveedor = factura?.proveedor?.nombre ?? factura?.proveedorNombreDetectado;

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
              <DialogTitle className="text-xl font-bold italic tracking-tight">Cargar factura de proveedor</DialogTitle>
            </div>
            <DialogDescription>
              Subí una foto o PDF de la factura. El sistema detecta productos automáticamente y te
              muestra el nivel de confianza de cada coincidencia antes de tocar tu stock.
            </DialogDescription>
          </DialogHeader>

          <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto w-full">
            {!items && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-xs font-bold uppercase text-muted-foreground">Proveedor (opcional)</Label>
                  <Select value={proveedorId} onValueChange={setProveedorId} disabled={subiendo || procesando}>
                    <SelectTrigger className="h-11 bg-muted/30">
                      <SelectValue placeholder="Si no lo sabés, dejalo vacío — se intenta detectar automáticamente" />
                    </SelectTrigger>
                    <SelectContent>
                      {proveedores.map((p) => (
                        <SelectItem key={p.id} value={String(p.id)}>{p.nombre}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-3">
                  <Label className="text-xs font-bold uppercase text-muted-foreground">Archivo de la factura</Label>
                  <Input
                    ref={fileInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp,application/pdf"
                    onChange={handleFileChange}
                    disabled={subiendo || procesando}
                    className="h-11 bg-muted/30"
                  />
                  {(subiendo || procesando) && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      {subiendo ? "Subiendo factura..." : "Procesando con OCR, puede tardar unos segundos..."}
                    </div>
                  )}
                </div>
              </div>
            )}

            {items && factura && (
              <>
                <div className="rounded-lg bg-muted/30 p-3 text-xs grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <div><span className="text-muted-foreground">Proveedor: </span><span className="font-semibold">{nombreProveedor ?? "No detectado"}</span></div>
                  <div><span className="text-muted-foreground">N° factura: </span><span className="font-semibold">{factura.numeroFactura ?? "—"}</span></div>
                  <div><span className="text-muted-foreground">Moneda: </span><span className="font-semibold">{factura.moneda}</span></div>
                  <div><span className="text-muted-foreground">Total: </span><span className="font-semibold">{factura.totalDetectado ?? "—"}</span></div>
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

                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Detectado</TableHead>
                      <TableHead className="w-20">Cant.</TableHead>
                      <TableHead className="w-24">Costo</TableHead>
                      <TableHead className="w-64">Coincidencia</TableHead>
                      <TableHead className="w-72 text-right">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.map((item) => {
                      const badge = badgeEstado(item);
                      const Icon = badge.icon;
                      const terminal = ESTADOS_TERMINALES.has(item.estado);
                      const busy = busyItemId === item.id;
                      return (
                        <TableRow key={item.id} className={terminal ? "opacity-50" : undefined}>
                          <TableCell className="max-w-[220px]">
                            <div className="text-sm font-medium truncate" title={item.textoOriginal}>{item.textoOriginal}</div>
                            {item.codigoProveedor && (
                              <div className="text-[10px] text-muted-foreground">Cód. proveedor: {item.codigoProveedor}</div>
                            )}
                          </TableCell>
                          <TableCell>{item.cantidad}</TableCell>
                          <TableCell>{item.precioUnitario ?? "—"}</TableCell>
                          <TableCell>
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
                                <SelectTrigger className="h-7 text-[11px] mt-1 bg-muted/20">
                                  <SelectValue placeholder="Elegir otro producto" />
                                </SelectTrigger>
                                <SelectContent>
                                  {productos.map((p) => (
                                    <SelectItem key={p.id} value={String(p.id)}>{p.nombre}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
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
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </>
            )}

            {items && items.length === 0 && (
              <div className="text-sm text-muted-foreground text-center py-8">
                No se detectaron líneas de producto. Probá con otra imagen.
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <Button type="button" variant="outline" className="flex-1 h-11" onClick={() => setOpen(false)}>
                Cerrar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {itemParaCrear && (
        <CreateProductoDialog
          open={Boolean(itemParaCrear)}
          onOpenChange={(v) => { if (!v) setItemParaCrear(null); }}
          initialValues={initialValuesParaNuevoProducto(itemParaCrear)}
          submitFn={(payload) => apiService.createProductoDesdeFacturaItem(itemParaCrear.id, payload).then((res): ProductoCreado => ({
            id: res.producto.id,
            nombre: res.producto.nombre,
            sku: null,
            codigoBarra: res.producto.codigoBarra ?? null,
            stockDisponibleUnits: Number((res.producto as { stockDisponibleUnits?: unknown }).stockDisponibleUnits ?? 0),
          }))}
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
