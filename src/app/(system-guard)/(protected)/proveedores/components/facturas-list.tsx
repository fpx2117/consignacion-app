"use client";

import * as React from "react";
import type {
  FacturaProveedor,
  Proveedor,
  EstadoFacturaProveedor,
  ListFacturasProveedorFiltros,
} from "@/lib/apiService";
import { apiService } from "@/lib/apiService";
import { motion, AnimatePresence } from "motion/react";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Eye,
  Ban,
  FileText,
  ImageOff,
  Package,
  Filter,
  PlayCircle,
} from "lucide-react";
import { FacturaDetalleDialog } from "./factura-detalle-dialog";
import { FacturaProveedorDialog } from "@/app/(system-guard)/(protected)/productos/components/factura-proveedor-dialog";
import {
  estadoFacturaBadge,
  formatMoneda,
  formatFecha,
} from "./factura-helpers";

const ESTADOS: { value: string; label: string }[] = [
  { value: "all", label: "Todos los estados" },
  { value: "PENDIENTE", label: "Pendiente" },
  { value: "PROCESANDO", label: "Procesando" },
  { value: "REQUIERE_REVISION", label: "Requiere revisión" },
  { value: "CONFIRMADA", label: "Confirmada" },
  { value: "CANCELADA", label: "Cancelada" },
  { value: "ERROR", label: "Error" },
];

interface FacturasListProps {
  proveedores?: Proveedor[];
  proveedorId?: number; // Si viene, la lista queda fijada a ese proveedor (vista detalle)
}

export function FacturasList({ proveedores, proveedorId }: FacturasListProps) {
  const [items, setItems] = React.useState<FacturaProveedor[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [estadoFilter, setEstadoFilter] = React.useState<string>("all");
  const [proveedorFilter, setProveedorFilter] = React.useState<string>(
    proveedorId != null ? String(proveedorId) : "all",
  );
  const [facturaACancelar, setFacturaACancelar] =
    React.useState<FacturaProveedor | null>(null);
  const [cancelando, setCancelando] = React.useState(false);
  // Factura a retomar: reabre la pantalla de revisión completa para una factura
  // ya analizada (en revisión) sin volver a escanear ni gastar tokens.
  const [facturaARetomar, setFacturaARetomar] = React.useState<number | null>(
    null,
  );

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const filtros: ListFacturasProveedorFiltros = {};
      if (proveedorId != null) {
        filtros.proveedorId = proveedorId;
      } else if (proveedorFilter !== "all") {
        filtros.proveedorId = Number(proveedorFilter);
      }
      if (estadoFilter !== "all")
        filtros.estado = estadoFilter as EstadoFacturaProveedor;
      const res = await apiService.listFacturasProveedor(filtros);
      setItems(res ?? []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [estadoFilter, proveedorFilter, proveedorId]);

  React.useEffect(() => {
    void load();
  }, [load]);

  const confirmarCancelacion = async () => {
    if (!facturaACancelar) return;
    setCancelando(true);
    try {
      await apiService.cancelFacturaProveedor(facturaACancelar.id);
      setFacturaACancelar(null);
      void load();
    } catch (e) {
      console.error(e);
      alert(e instanceof Error ? e.message : "No se pudo cancelar la factura");
    } finally {
      setCancelando(false);
    }
  };

  const puedeCancelar = (estado: EstadoFacturaProveedor) =>
    estado !== "CANCELADA" && estado !== "CONFIRMADA";

  return (
    <div className="space-y-6">
      {/* Filtros */}
      <div className="flex flex-col sm:flex-row items-center gap-3 w-full">
        {proveedorId == null && (
          <Select value={proveedorFilter} onValueChange={setProveedorFilter}>
            <SelectTrigger className="h-12 rounded-2xl border-input/50 bg-background/50 w-full sm:w-64">
              <div className="flex items-center gap-2">
                <Package className="h-4 w-4 text-muted-foreground" />
                <SelectValue placeholder="Proveedor" />
              </div>
            </SelectTrigger>
            <SelectContent className="rounded-xl">
              <SelectItem value="all">Todos los proveedores</SelectItem>
              {(proveedores ?? []).map((p) => (
                <SelectItem key={p.id} value={String(p.id)}>
                  {p.nombre}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        <Select value={estadoFilter} onValueChange={setEstadoFilter}>
          <SelectTrigger className="h-12 rounded-2xl border-input/50 bg-background/50 w-full sm:w-56">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <SelectValue placeholder="Estado" />
            </div>
          </SelectTrigger>
          <SelectContent className="rounded-xl">
            {ESTADOS.map((e) => (
              <SelectItem key={e.value} value={e.value}>
                {e.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-16 w-full rounded-2xl" />
          ))}
        </div>
      ) : (
        <AnimatePresence mode="wait">
          {items.length === 0 ? (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-col items-center justify-center py-20 text-center space-y-4 opacity-50"
            >
              <div className="bg-muted/50 p-6 rounded-full">
                <FileText className="h-12 w-12 text-muted-foreground" />
              </div>
              <h3 className="text-xl font-bold">No se encontraron facturas</h3>
              <p className="text-sm">
                Ajustá los filtros o subí una factura desde Productos.
              </p>
            </motion.div>
          ) : (
            <motion.div
              key="list"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="rounded-[2rem] border border-border bg-card overflow-hidden shadow-sm"
            >
              <Table>
                <TableHeader className="bg-muted/30">
                  <TableRow className="border-border hover:bg-transparent">
                    <TableHead className="py-5 pl-8 text-[11px] font-bold uppercase tracking-[0.1em] text-muted-foreground">
                      Proveedor
                    </TableHead>
                    <TableHead className="text-[11px] font-bold uppercase tracking-[0.1em] text-muted-foreground">
                      Factura
                    </TableHead>
                    <TableHead className="text-[11px] font-bold uppercase tracking-[0.1em] text-muted-foreground">
                      Total
                    </TableHead>
                    <TableHead className="text-[11px] font-bold uppercase tracking-[0.1em] text-muted-foreground">
                      Estado
                    </TableHead>
                    <TableHead className="text-right pr-8 text-[11px] font-bold uppercase tracking-[0.1em] text-muted-foreground">
                      Acciones
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((f) => {
                    const proveedorNombre =
                      f.proveedor?.nombre ??
                      f.proveedorNombreDetectado ??
                      "Sin asignar";
                    return (
                      <TableRow
                        key={f.id}
                        className="border-border hover:bg-muted/30 transition-all group"
                      >
                        <TableCell className="pl-8 py-4">
                          <div className="flex items-center gap-3">
                            <div className="h-9 w-9 rounded-xl bg-muted flex items-center justify-center text-muted-foreground group-hover:text-primary transition-colors">
                              <FileText className="h-4 w-4" />
                            </div>
                            <div>
                              <div className="font-bold text-sm text-foreground/90">
                                {proveedorNombre}
                              </div>
                              <div className="text-[10px] text-muted-foreground flex items-center gap-1 mt-0.5">
                                {formatFecha(f.fecha ?? f.createdAt)}
                                {f.archivoEliminado && (
                                  <span className="inline-flex items-center gap-1 text-muted-foreground/70">
                                    <ImageOff className="h-3 w-3" /> sin imagen
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm font-mono">
                            {f.numeroFactura || "—"}
                          </div>
                          <div className="text-[10px] text-muted-foreground mt-0.5">
                            {f._count?.items ?? f.items?.length ?? 0} ítems ·{" "}
                            {f.moneda}
                          </div>
                        </TableCell>
                        <TableCell>
                          {f.totalDetectado != null ? (
                            <span className="font-mono text-sm font-semibold">
                              {formatMoneda(f.totalDetectado, f.moneda)}
                            </span>
                          ) : (
                            <span className="text-muted-foreground/30 text-xs italic">
                              —
                            </span>
                          )}
                        </TableCell>
                        <TableCell>{estadoFacturaBadge(f.estado)}</TableCell>
                        <TableCell className="text-right pr-8">
                          <div className="flex justify-end gap-1 opacity-60 group-hover:opacity-100 transition-opacity">
                            {f.estado === "REQUIERE_REVISION" && (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-8 gap-1.5 rounded-lg px-2.5 font-semibold text-primary hover:bg-primary/10 hover:text-primary hover:shadow-sm"
                                onClick={() => setFacturaARetomar(f.id)}
                              >
                                <PlayCircle className="h-4 w-4" />
                                Retomar
                              </Button>
                            )}
                            <FacturaDetalleDialog
                              facturaId={f.id}
                              trigger={
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-8 w-8 rounded-lg text-muted-foreground hover:bg-background hover:text-foreground hover:shadow-sm"
                                >
                                  <Eye className="h-4 w-4" />
                                </Button>
                              }
                            />
                            {puedeCancelar(f.estado) && (
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-8 w-8 rounded-lg text-muted-foreground hover:bg-background hover:text-[color:var(--status-danger)] hover:shadow-sm"
                                onClick={() => setFacturaACancelar(f)}
                              >
                                <Ban className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </motion.div>
          )}
        </AnimatePresence>
      )}

      <div className="flex justify-between items-center text-xs text-muted-foreground px-4">
        <span>Mostrando {items.length} facturas</span>
      </div>

      {/* Retomar revisión: reabre la pantalla de revisión completa para la
          factura ya analizada, sin re-escanear. Al confirmar, refresca la lista. */}
      <FacturaProveedorDialog
        facturaIdInicial={facturaARetomar}
        open={facturaARetomar != null}
        onOpenChange={(open) => {
          if (!open) setFacturaARetomar(null);
        }}
        onCreated={() => void load()}
      />

      <AlertDialog
        open={facturaACancelar != null}
        onOpenChange={(open) => {
          if (!open && !cancelando) setFacturaACancelar(null);
        }}
      >
        <AlertDialogContent className="rounded-[2rem] border-border/50 bg-background/95 backdrop-blur-xl shadow-2xl">
          <AlertDialogHeader>
            <AlertDialogMedia className="bg-[color:var(--status-danger)]/10 text-[color:var(--status-danger)] rounded-2xl">
              <Ban />
            </AlertDialogMedia>
            <AlertDialogTitle className="text-xl font-black tracking-tight">
              Cancelar factura
            </AlertDialogTitle>
            <AlertDialogDescription className="text-sm">
              Se marcará como{" "}
              <span className="font-semibold text-foreground">CANCELADA</span> y
              se eliminará su imagen para ahorrar espacio. Los ítems quedan como
              historial. Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-2">
            <AlertDialogCancel
              disabled={cancelando}
              className="rounded-xl h-11 border-border/50 font-medium"
            >
              Volver
            </AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={cancelando}
              onClick={(e) => {
                e.preventDefault();
                void confirmarCancelacion();
              }}
              className="rounded-xl h-11 font-bold"
            >
              {cancelando ? "Cancelando..." : "Sí, cancelar factura"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
