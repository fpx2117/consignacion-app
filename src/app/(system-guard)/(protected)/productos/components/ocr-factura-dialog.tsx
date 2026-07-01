"use client";

import * as React from "react";
import { apiService, type OcrFacturaLineaDetectada, type OcrFacturaFilaConfirmacion } from "@/lib/apiService";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
} from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScanText, Loader2, AlertTriangle, Upload, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

type FilaEditable = OcrFacturaLineaDetectada & {
  incluir: boolean;
  crearNuevo: boolean;
  nombreEditado: string;
  cantidadEditada: string;
  precioEditado: string;
};

function toEditable(linea: OcrFacturaLineaDetectada): FilaEditable {
  return {
    ...linea,
    incluir: true,
    crearNuevo: linea.productoSugeridoId === null,
    nombreEditado: linea.nombreDetectado,
    cantidadEditada: String(linea.cantidadDetectada ?? 1),
    precioEditado: linea.precioDetectado !== null ? String(linea.precioDetectado) : "",
  };
}

export function OcrFacturaDialog({
  trigger,
  onCreated,
}: {
  trigger?: React.ReactNode;
  onCreated?: () => void;
}) {
  const [open, setOpen] = React.useState(false);
  const [analizando, setAnalizando] = React.useState(false);
  const [confirmando, setConfirmando] = React.useState(false);
  const [filas, setFilas] = React.useState<FilaEditable[] | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (!open) {
      setFilas(null);
      setAnalizando(false);
      setConfirmando(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }, [open]);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setAnalizando(true);
    setFilas(null);
    try {
      const resultado = await apiService.analizarFacturaOcr(file);
      if (resultado.filas.length === 0) {
        toast.warning("No se detectaron líneas de producto en la factura. Probá con otra foto más nítida.");
      }
      setFilas(resultado.filas.map(toEditable));
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Error al analizar la factura");
    } finally {
      setAnalizando(false);
    }
  }

  function updateFila(id: number, patch: Partial<FilaEditable>) {
    setFilas((prev) => prev?.map((f) => (f.id === id ? { ...f, ...patch } : f)) ?? null);
  }

  async function confirmar() {
    if (!filas) return;
    const filasIncluidas = filas.filter((f) => f.incluir);
    if (filasIncluidas.length === 0) {
      toast.error("Seleccioná al menos una fila para confirmar");
      return;
    }

    const payload: OcrFacturaFilaConfirmacion[] = filasIncluidas.map((f) => ({
      productoId: f.crearNuevo ? null : f.productoSugeridoId,
      crearNuevo: f.crearNuevo || f.productoSugeridoId === null,
      nombre: f.nombreEditado.trim(),
      cantidad: Math.max(1, Math.trunc(Number(f.cantidadEditada) || 1)),
      precioCosto: f.precioEditado.trim() ? Number(f.precioEditado) : null,
    }));

    setConfirmando(true);
    try {
      const resumen = await apiService.confirmarFacturaOcr(payload);
      const partes = [];
      if (resumen.creados > 0) partes.push(`${resumen.creados} producto(s) creado(s)`);
      if (resumen.actualizados > 0) partes.push(`${resumen.actualizados} stock actualizado(s)`);
      if (partes.length > 0) toast.success(partes.join(" · "));
      if (resumen.errores.length > 0) {
        resumen.errores.forEach((e) => toast.error(`${e.fila}: ${e.error}`));
      } else {
        setOpen(false);
      }
      onCreated?.();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Error al confirmar la carga");
    } finally {
      setConfirmando(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="ghost" size="sm" className="h-9 px-3 rounded-lg font-bold text-sm">
            <ScanText className="h-3.5 w-3.5 mr-1.5" />
            Cargar por factura (OCR)
          </Button>
        )}
      </DialogTrigger>

      <DialogContent className="sm:max-w-[800px] p-0 overflow-hidden border-none shadow-2xl bg-background">
        <DialogHeader className="p-6 pb-2 border-b bg-muted/20">
          <div className="flex items-center gap-2 text-primary">
            <ScanText className="h-5 w-5" />
            <DialogTitle className="text-xl font-bold italic tracking-tight">Cargar productos por factura (OCR)</DialogTitle>
          </div>
          <DialogDescription>
            Subí una foto o PDF de una factura de proveedor. El reconocimiento automático puede
            tener errores — revisá los datos antes de confirmar.
          </DialogDescription>
        </DialogHeader>

        <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto w-full">
          {!filas && (
            <div className="space-y-3">
              <Label className="text-xs font-bold uppercase text-muted-foreground">Archivo de la factura</Label>
              <Input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,application/pdf"
                onChange={handleFileChange}
                disabled={analizando}
                className="h-11 bg-muted/30"
              />
              {analizando && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Analizando factura, puede tardar unos segundos...
                </div>
              )}
            </div>
          )}

          {filas && filas.length > 0 && (
            <>
              <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/30 rounded-lg p-3">
                <AlertTriangle className="h-4 w-4 shrink-0 text-[color:var(--status-warning)]" />
                Revisá y corregí cada fila antes de confirmar. Las filas sin producto sugerido se
                crearán como productos nuevos.
              </div>

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-8"></TableHead>
                    <TableHead>Nombre</TableHead>
                    <TableHead className="w-24">Cantidad</TableHead>
                    <TableHead className="w-28">Costo</TableHead>
                    <TableHead className="w-56">Producto</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filas.map((fila) => (
                    <TableRow key={fila.id} className={!fila.incluir ? "opacity-40" : undefined}>
                      <TableCell>
                        <Checkbox
                          checked={fila.incluir}
                          onCheckedChange={(v) => updateFila(fila.id, { incluir: Boolean(v) })}
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          value={fila.nombreEditado}
                          onChange={(e) => updateFila(fila.id, { nombreEditado: e.target.value })}
                          className="h-9"
                          disabled={!fila.incluir}
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          value={fila.cantidadEditada}
                          onChange={(e) => updateFila(fila.id, { cantidadEditada: e.target.value })}
                          className="h-9"
                          inputMode="numeric"
                          disabled={!fila.incluir}
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          value={fila.precioEditado}
                          onChange={(e) => updateFila(fila.id, { precioEditado: e.target.value })}
                          className="h-9"
                          inputMode="decimal"
                          placeholder="0.00"
                          disabled={!fila.incluir}
                        />
                      </TableCell>
                      <TableCell>
                        {fila.crearNuevo || !fila.productoSugeridoId ? (
                          <span className="text-xs font-bold text-primary flex items-center gap-1">
                            Producto nuevo
                          </span>
                        ) : (
                          <div className="space-y-1">
                            <span className="text-xs font-medium flex items-center gap-1 text-[color:var(--status-success-strong)]">
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              {fila.productoSugeridoNombre} ({Math.round((fila.matchScore ?? 0) * 100)}%)
                            </span>
                            <button
                              type="button"
                              className="text-[10px] text-muted-foreground underline"
                              onClick={() => updateFila(fila.id, { crearNuevo: true })}
                            >
                              Crear como nuevo en su lugar
                            </button>
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </>
          )}

          {filas && filas.length === 0 && (
            <div className="text-sm text-muted-foreground text-center py-8">
              No se detectaron líneas de producto. Probá con otra imagen.
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <Button type="button" variant="outline" className="flex-1 h-11" onClick={() => setOpen(false)} disabled={confirmando}>
              Cancelar
            </Button>
            {filas && filas.length > 0 && (
              <Button
                type="button"
                className="flex-1 h-11 font-bold shadow-lg"
                onClick={confirmar}
                disabled={confirmando}
              >
                {confirmando ? <Loader2 className="h-4 w-4 animate-spin" /> : (
                  <>
                    <Upload className="h-4 w-4 mr-2" />
                    Confirmar carga
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
