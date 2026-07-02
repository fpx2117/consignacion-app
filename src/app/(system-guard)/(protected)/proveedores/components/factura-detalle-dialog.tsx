"use client";

import * as React from "react";
import type { FacturaProveedor } from "@/lib/apiService";
import { apiService, API_ROUTES } from "@/lib/apiService";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { FileText, ImageOff, Hash, Calendar, Coins, X, ZoomIn } from "lucide-react";
import { estadoFacturaBadge, formatMoneda, formatFecha } from "./factura-helpers";

// Lightbox para ver la imagen ampliada sin salir de la app (mismo patrón que
// crear-pedido-dialog.tsx) — antes esto era un <a target="_blank"> que llevaba
// directo a la URL de la API.
function ImageVisor({ src, onClose }: { src: string; onClose: () => void }) {
  React.useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-sm"
      onClick={onClose}
    >
      <button
        type="button"
        onClick={onClose}
        className="absolute top-4 right-4 text-white/70 hover:text-white bg-white/10 hover:bg-white/20 rounded-full p-2 transition-colors"
      >
        <X className="h-5 w-5" />
      </button>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt="Factura ampliada"
        className="max-h-[85vh] max-w-[85vw] object-contain rounded-xl shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      />
    </div>
  );
}

export function FacturaDetalleDialog({
  facturaId,
  trigger,
}: {
  facturaId: number;
  trigger: React.ReactNode;
}) {
  const [open, setOpen] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [factura, setFactura] = React.useState<FacturaProveedor | null>(null);
  const [visorAbierto, setVisorAbierto] = React.useState(false);

  React.useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    apiService
      .getFacturaProveedor(facturaId)
      .then((res) => {
        if (!cancelled) setFactura(res ?? null);
      })
      .catch((e) => console.error(e))
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, facturaId]);

  const proveedorNombre =
    factura?.proveedor?.nombre ?? factura?.proveedorNombreDetectado ?? "Proveedor sin asignar";
  const moneda = factura?.moneda ?? "ARS";
  const items = factura?.items ?? [];

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>

      <DialogContent className="sm:max-w-[720px] border-border/50 bg-background/95 backdrop-blur-xl p-0 gap-0 shadow-2xl rounded-[2rem] overflow-hidden max-h-[85vh] flex flex-col">
        {/* Header Visual */}
        <div className="bg-muted/30 p-6 pb-5 border-b border-border/50 relative overflow-hidden shrink-0">
          <div className="absolute top-0 right-0 p-4 opacity-5">
            <FileText className="w-24 h-24 rotate-12" />
          </div>
          <DialogHeader className="relative z-10">
            <div className="flex items-center justify-between gap-3">
              <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary shadow-inner">
                <FileText className="w-6 h-6" />
              </div>
              {factura ? estadoFacturaBadge(factura.estado) : null}
            </div>
            <DialogTitle className="text-2xl font-black tracking-tight mt-3">
              {proveedorNombre}
            </DialogTitle>
            <DialogDescription className="text-sm font-medium text-muted-foreground/80">
              Detalle reconstruido de la factura a partir de los datos guardados.
            </DialogDescription>
          </DialogHeader>

          {/* Metadatos */}
          <div className="relative z-10 mt-4 flex flex-wrap gap-3 text-xs">
            <span className="inline-flex items-center gap-1.5 rounded-lg bg-background/60 px-2.5 py-1.5 font-medium text-muted-foreground">
              <Hash className="h-3.5 w-3.5" /> {factura?.numeroFactura || "Sin N°"}
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-lg bg-background/60 px-2.5 py-1.5 font-medium text-muted-foreground">
              <Calendar className="h-3.5 w-3.5" /> {formatFecha(factura?.fecha)}
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-lg bg-background/60 px-2.5 py-1.5 font-medium text-muted-foreground">
              <Coins className="h-3.5 w-3.5" /> {moneda}
            </span>
            {factura?.totalDetectado != null && (
              <span className="inline-flex items-center gap-1.5 rounded-lg bg-primary/10 px-2.5 py-1.5 font-bold text-primary">
                Total: {formatMoneda(factura.totalDetectado, moneda)}
              </span>
            )}
          </div>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto">
          {factura?.archivoEliminado ? (
            <div className="mb-4 flex items-center gap-2 rounded-xl border border-border/50 bg-muted/40 px-4 py-3 text-xs font-medium text-muted-foreground">
              <ImageOff className="h-4 w-4 shrink-0" />
              Imagen original eliminada para ahorrar espacio. Se muestran solo los datos guardados.
            </div>
          ) : factura ? (
            <div className="mb-4 rounded-2xl border border-border/50 overflow-hidden bg-muted/20">
              {factura.archivoMime?.startsWith("image/") ? (
                <button
                  type="button"
                  onClick={() => setVisorAbierto(true)}
                  className="group relative block w-full"
                >
                  <img
                    src={API_ROUTES.FACTURAS_PROVEEDOR.ARCHIVO(factura.id)}
                    alt="Factura original"
                    className="w-full max-h-72 object-contain cursor-zoom-in"
                  />
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
                    <ZoomIn className="h-6 w-6 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                </button>
              ) : factura.archivoMime === "application/pdf" ? (
                <a
                  href={API_ROUTES.FACTURAS_PROVEEDOR.ARCHIVO(factura.id)}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center justify-center gap-2 p-6 text-sm font-medium text-primary hover:underline"
                >
                  <FileText className="h-4 w-4" /> Abrir PDF original
                </a>
              ) : null}
            </div>
          ) : null}

          {loading ? (
            <div className="space-y-2">
              {[1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-12 w-full rounded-xl" />
              ))}
            </div>
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center opacity-50 gap-2">
              <FileText className="h-10 w-10 text-muted-foreground" />
              <p className="text-sm font-medium">Esta factura no tiene ítems cargados.</p>
            </div>
          ) : (
            <div className="rounded-2xl border border-border bg-card overflow-hidden">
              <Table>
                <TableHeader className="bg-muted/30">
                  <TableRow className="border-border hover:bg-transparent">
                    <TableHead className="text-[11px] font-bold uppercase tracking-[0.1em] text-muted-foreground pl-4">
                      Descripción
                    </TableHead>
                    <TableHead className="text-[11px] font-bold uppercase tracking-[0.1em] text-muted-foreground text-right">
                      Cant.
                    </TableHead>
                    <TableHead className="text-[11px] font-bold uppercase tracking-[0.1em] text-muted-foreground text-right">
                      P. Unit.
                    </TableHead>
                    <TableHead className="text-[11px] font-bold uppercase tracking-[0.1em] text-muted-foreground text-right pr-4">
                      Total
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((item) => {
                    const anulado = item.estado === "IGNORADO";
                    return (
                      <TableRow
                        key={item.id}
                        className={`border-border hover:bg-muted/30 transition-all ${anulado ? "opacity-50" : ""}`}
                      >
                        <TableCell className="pl-4 py-3">
                          <div className={`font-medium text-sm ${anulado ? "line-through" : ""}`}>
                            {item.descripcionNormalizada || item.textoOriginal}
                          </div>
                          <div className="flex items-center gap-2 mt-0.5">
                            {item.codigoProveedor && (
                              <span className="text-[10px] font-mono text-muted-foreground">
                                #{item.codigoProveedor}
                              </span>
                            )}
                            {item.producto && (
                              <Badge variant="outline" className="h-4 border-0 px-1.5 text-[10px] bg-primary/10 text-primary">
                                {item.producto.nombre}
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm">
                          {item.cantidad}
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm text-muted-foreground">
                          {item.precioUnitario != null ? formatMoneda(item.precioUnitario, moneda) : "—"}
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm pr-4 font-semibold">
                          {item.totalLinea != null ? formatMoneda(item.totalLinea, moneda) : "—"}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </DialogContent>

      {visorAbierto && factura && (
        <ImageVisor
          src={API_ROUTES.FACTURAS_PROVEEDOR.ARCHIVO(factura.id)}
          onClose={() => setVisorAbierto(false)}
        />
      )}
    </Dialog>
  );
}
