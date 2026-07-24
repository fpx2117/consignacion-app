"use client";

import * as React from "react";
import { motion } from "motion/react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useSucursalStore } from "@/store/useSucursalStore";
import type {
  PedidoEsperado,
  EstadoPedidoEsperado,
} from "@/types/pedidos-esperados";

// UI
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

// Icons
import {
  ClipboardList,
  Plus,
  Loader2,
  PackageCheck,
  CalendarClock,
  XCircle,
  Eye,
  AlertCircle,
  MoreVertical,
  CalendarX2,
  CheckCheck,
  PackageSearch,
  Trash2,
  ZoomIn,
  X,
  Package,
  Hash,
  ArrowDownToLine,
  CheckCircle2,
  Clock,
  MinusCircle,
} from "lucide-react";

// Sub-components
import { PedidoEstadoBadge } from "./pedido-estado-badge";
import { PedidosFilters } from "./pedidos-filters";
import { CrearPedidoDialog } from "./crear-pedido-dialog";
import { ConfirmarPedidoDialog } from "./confirmar-pedido-dialog";
import { PostergarPedidoDialog } from "./postergar-pedido-dialog";

// ─── HELPERS ─────────────────────────────────────────────────────────────────

function formatFecha(fechaISO: string) {
  if (!fechaISO) return "—";
  const d = new Date(fechaISO);
  return d.toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatFechaRelativa(fechaISO: string) {
  if (!fechaISO) return "";
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const fecha = new Date(fechaISO);
  fecha.setHours(0, 0, 0, 0);
  const diff = Math.round(
    (fecha.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24),
  );
  if (diff === 0) return "hoy";
  if (diff === 1) return "mañana";
  if (diff === -1) return "ayer";
  if (diff < 0) return `hace ${Math.abs(diff)} días`;
  return `en ${diff} días`;
}

const ESTADOS_ACTIVOS: EstadoPedidoEsperado[] = [
  "PROGRAMADO",
  "VENCIDO",
  "PARCIAL",
  "POSTERGADO",
];
const ESTADOS_SOLO_VER: EstadoPedidoEsperado[] = ["CONFIRMADO", "CANCELADO"];

// ─── TIPOS DE FILTROS ─────────────────────────────────────────────────────────

interface Filtros {
  estado: string;
  fechaDesde: string;
  fechaHasta: string;
}

const FILTROS_DEFECTO: Filtros = {
  estado: "all",
  fechaDesde: "",
  fechaHasta: "",
};

// ─── COMPONENTE PRINCIPAL ────────────────────────────────────────────────────

export function PedidosEsperadosView() {
  const activeSucursalId = useSucursalStore((s) => s.activeSucursalId);
  const sucursalHeaders = React.useMemo<Record<string, string>>(
    () =>
      activeSucursalId
        ? { "x-sucursal-id": String(activeSucursalId) }
        : ({} as Record<string, string>),
    [activeSucursalId],
  );

  const [pedidos, setPedidos] = React.useState<PedidoEsperado[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [filtros, setFiltros] = React.useState<Filtros>(FILTROS_DEFECTO);

  // Dialogs
  const [dialogCrear, setDialogCrear] = React.useState(false);
  const [selectedPedido, setSelectedPedido] =
    React.useState<PedidoEsperado | null>(null);
  const [detallePedido, setDetallePedido] =
    React.useState<PedidoEsperado | null>(null);
  const [dialogConfirmar, setDialogConfirmar] = React.useState(false);
  const [dialogPostergar, setDialogPostergar] = React.useState(false);
  const [dialogCancelar, setDialogCancelar] = React.useState(false);
  const [dialogEliminar, setDialogEliminar] = React.useState(false);
  const [cancelandoId, setCancelandoId] = React.useState<number | null>(null);
  const [eliminandoId, setEliminandoId] = React.useState<number | null>(null);
  const [currentPage, setCurrentPage] = React.useState(1);
  const [itemsPerPage, setItemsPerPage] = React.useState(25);

  // ── Carga de datos ──────────────────────────────────────────────────────────
  const fetchPedidos = React.useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filtros.estado !== "all") {
        if (filtros.estado === "pendientes") {
          // filtro especial: dos estados
          params.append("estado", "PROGRAMADO");
          params.append("estado", "VENCIDO");
        } else {
          params.append("estado", filtros.estado);
        }
      }
      if (filtros.fechaDesde) params.append("fechaDesde", filtros.fechaDesde);
      if (filtros.fechaHasta) params.append("fechaHasta", filtros.fechaHasta);

      const res = await fetch(`/api/pedidos-esperados?${params.toString()}`, {
        headers: sucursalHeaders,
      });
      if (!res.ok) throw new Error("Error al cargar pedidos");
      const data = await res.json();
      const arr = Array.isArray(data)
        ? data
        : Array.isArray(data?.data)
          ? data.data
          : [];
      setPedidos(arr);
    } catch {
      toast.error("No se pudieron cargar los pedidos");
      setPedidos([]);
    } finally {
      setLoading(false);
    }
  }, [filtros, sucursalHeaders]);

  React.useEffect(() => {
    fetchPedidos();
  }, [fetchPedidos, activeSucursalId]);

  React.useEffect(() => {
    setCurrentPage(1);
  }, [
    filtros.estado,
    filtros.fechaDesde,
    filtros.fechaHasta,
    activeSucursalId,
  ]);

  const totalPages = Math.max(
    1,
    Math.ceil(pedidos.length / Math.max(1, itemsPerPage)),
  );
  const pageStart = (currentPage - 1) * itemsPerPage;
  const pagedPedidos = React.useMemo(
    () => pedidos.slice(pageStart, pageStart + itemsPerPage),
    [pedidos, pageStart, itemsPerPage],
  );

  React.useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [currentPage, totalPages]);

  // ── Cancelar pedido ─────────────────────────────────────────────────────────
  async function handleCancelar(pedido: PedidoEsperado) {
    setSelectedPedido(pedido);
    setDialogCancelar(true);
  }

  async function handleEliminar(pedido: PedidoEsperado) {
    setSelectedPedido(pedido);
    setDialogEliminar(true);
  }

  async function confirmCancelar() {
    if (!selectedPedido) return;
    setCancelandoId(selectedPedido.id);
    try {
      const res = await fetch(`/api/pedidos-esperados/${selectedPedido.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...sucursalHeaders,
        },
        body: JSON.stringify({ estado: "CANCELADO" }),
      });
      if (!res.ok) throw new Error();
      toast.success("Pedido cancelado");
      setDialogCancelar(false);
      fetchPedidos();
    } catch {
      toast.error("Error al cancelar el pedido");
    } finally {
      setCancelandoId(null);
    }
  }

  async function confirmEliminar() {
    if (!selectedPedido || selectedPedido.estado !== "CANCELADO") return;
    setEliminandoId(selectedPedido.id);
    try {
      const res = await fetch(`/api/pedidos-esperados/${selectedPedido.id}`, {
        method: "DELETE",
        headers: sucursalHeaders,
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok)
        throw new Error(payload?.error || "Error al eliminar pedido");
      toast.success("Pedido cancelado eliminado");
      setDialogEliminar(false);
      setSelectedPedido(null);
      fetchPedidos();
    } catch (err: unknown) {
      toast.error(
        err instanceof Error ? err.message : "No se pudo eliminar el pedido",
      );
    } finally {
      setEliminandoId(null);
    }
  }

  // ── Stats ───────────────────────────────────────────────────────────────────
  const vencidos = pedidos.filter((p) => p.estado === "VENCIDO").length;
  const activos = pedidos.filter((p) =>
    ESTADOS_ACTIVOS.includes(p.estado),
  ).length;

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="max-w-[1400px] mx-auto space-y-8 p-6 md:p-10 pb-20 text-foreground font-sans">
      {/* HEADER */}
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-border/40">
        <div className="space-y-1.5">
          <h1 className="text-3xl md:text-4xl font-black tracking-tight text-foreground flex items-center gap-3">
            <ClipboardList className="h-8 w-8 md:h-10 md:w-10 text-primary" />
            Pedidos Esperados
            {vencidos > 0 && (
              <Badge className="bg-[color:var(--status-danger)] text-[color:var(--ui-fx-white)] font-black text-sm px-2.5 py-1 rounded-xl animate-pulse">
                {vencidos} vencido{vencidos > 1 ? "s" : ""}
              </Badge>
            )}
          </h1>
          <p className="text-muted-foreground text-sm md:text-base max-w-2xl">
            Programá y confirmá la llegada de stock al inventario.
          </p>
        </div>

        <Button
          size="lg"
          className="h-10 px-5 rounded-xl font-bold shadow-lg shadow-primary/20 hover:shadow-primary/40 transition-all hover:scale-[1.02]"
          onClick={() => setDialogCrear(true)}
        >
          <Plus className="h-4 w-4 mr-2 stroke-[3px]" />
          Nuevo Pedido
        </Button>
      </header>

      {/* STATS RÁPIDOS */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <QuickStat
          label="Total pedidos"
          value={pedidos.length}
          color="default"
          icon={ClipboardList}
        />
        <QuickStat
          label="Activos"
          value={activos}
          color="blue"
          icon={PackageSearch}
        />
        <QuickStat
          label="Vencidos"
          value={vencidos}
          color={vencidos > 0 ? "red" : "default"}
          icon={CalendarX2}
        />
        <QuickStat
          label="Confirmados"
          value={pedidos.filter((p) => p.estado === "CONFIRMADO").length}
          color="emerald"
          icon={CheckCheck}
        />
      </div>

      <div className="space-y-4">
        {/* FILTROS */}
        <Card className="p-1 bg-card/50 backdrop-blur-sm border-border/60 shadow-sm rounded-2xl">
          <PedidosFilters
            estado={filtros.estado}
            fechaDesde={filtros.fechaDesde}
            fechaHasta={filtros.fechaHasta}
            onEstadoChange={(v) => setFiltros((f) => ({ ...f, estado: v }))}
            onFechaDesdeChange={(v) =>
              setFiltros((f) => ({ ...f, fechaDesde: v }))
            }
            onFechaHastaChange={(v) =>
              setFiltros((f) => ({ ...f, fechaHasta: v }))
            }
            onLimpiar={() => setFiltros(FILTROS_DEFECTO)}
          />
        </Card>

        {/* LOADING */}
        {loading && (
          <div className="h-[300px] flex flex-col items-center justify-center gap-4 bg-card/30 rounded-2xl border border-border/50">
            <Loader2 className="h-12 w-12 animate-spin text-primary opacity-50" />
            <span className="text-sm font-medium text-muted-foreground animate-pulse">
              Cargando pedidos...
            </span>
          </div>
        )}

        {/* CONTENIDO */}
        {!loading && (
          <>
            {pedidos.length === 0 ? (
              <div className="py-20">
                <EmptyState onCrear={() => setDialogCrear(true)} />
              </div>
            ) : (
              <>
                <Card className="border-border/60 bg-card/40 backdrop-blur-xl shadow-sm rounded-2xl overflow-hidden">
                  <div className="hidden md:block">
                    <Table>
                      <TableHeader className="bg-muted/30">
                        <TableRow className="hover:bg-transparent border-b border-border/60">
                          <TableHead className="pl-6 font-bold text-xs uppercase tracking-wider text-muted-foreground/70">
                            Fecha esperada
                          </TableHead>
                          <TableHead className="font-bold text-xs uppercase tracking-wider text-muted-foreground/70">
                            Estado
                          </TableHead>
                          <TableHead className="font-bold text-xs uppercase tracking-wider text-muted-foreground/70 text-center">
                            Items
                          </TableHead>
                          <TableHead className="font-bold text-xs uppercase tracking-wider text-muted-foreground/70">
                            Productos
                          </TableHead>
                          <TableHead className="font-bold text-xs uppercase tracking-wider text-muted-foreground/70">
                            Observaciones
                          </TableHead>
                          <TableHead className="font-bold text-xs uppercase tracking-wider text-muted-foreground/70 text-right pr-6">
                            Acciones
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {pagedPedidos.map((pedido, idx) => (
                          <PedidoRow
                            key={pedido.id}
                            pedido={pedido}
                            idx={idx}
                            onVer={() => setDetallePedido(pedido)}
                            onConfirmar={() => {
                              setSelectedPedido(pedido);
                              setDialogConfirmar(true);
                            }}
                            onPostergar={() => {
                              setSelectedPedido(pedido);
                              setDialogPostergar(true);
                            }}
                            onCancelar={() => handleCancelar(pedido)}
                            onEliminar={() => handleEliminar(pedido)}
                          />
                        ))}
                      </TableBody>
                    </Table>
                  </div>

                  <div className="md:hidden space-y-4 p-4">
                    {pagedPedidos.map((pedido, idx) => (
                      <MobilePedidoCard
                        key={pedido.id}
                        pedido={pedido}
                        idx={idx}
                        onVer={() => setDetallePedido(pedido)}
                        onConfirmar={() => {
                          setSelectedPedido(pedido);
                          setDialogConfirmar(true);
                        }}
                        onPostergar={() => {
                          setSelectedPedido(pedido);
                          setDialogPostergar(true);
                        }}
                        onCancelar={() => handleCancelar(pedido)}
                        onEliminar={() => handleEliminar(pedido)}
                      />
                    ))}
                  </div>
                </Card>

                <Card className="p-3 sm:p-4 border-border/60 bg-card/40 backdrop-blur-xl rounded-2xl">
                  <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
                    <p className="text-xs sm:text-sm text-muted-foreground">
                      Mostrando{" "}
                      <span className="font-bold text-foreground">
                        {pagedPedidos.length}
                      </span>{" "}
                      de{" "}
                      <span className="font-bold text-foreground">
                        {pedidos.length}
                      </span>{" "}
                      pedidos
                    </p>

                    <div className="flex items-center gap-2">
                      <label className="text-xs text-muted-foreground">
                        Por pagina
                      </label>
                      <select
                        value={String(itemsPerPage)}
                        onChange={(e) => {
                          const value = Number(e.target.value);
                          setItemsPerPage(
                            Number.isFinite(value) && value > 0 ? value : 25,
                          );
                          setCurrentPage(1);
                        }}
                        className="h-9 rounded-lg border border-border bg-background px-2 text-sm"
                      >
                        {[10, 25, 50, 100, pedidos.length]
                          .filter((v, i, arr) => v > 0 && arr.indexOf(v) === i)
                          .sort((a, b) => a - b)
                          .map((size) => (
                            <option key={size} value={size}>
                              {size === pedidos.length
                                ? `Maximo (${size})`
                                : size}
                            </option>
                          ))}
                      </select>

                      <Button
                        variant="outline"
                        size="sm"
                        className="rounded-lg"
                        disabled={currentPage <= 1}
                        onClick={() =>
                          setCurrentPage((p) => Math.max(1, p - 1))
                        }
                      >
                        Anterior
                      </Button>
                      <span className="text-xs font-bold min-w-[72px] text-center">
                        {currentPage} / {totalPages}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        className="rounded-lg"
                        disabled={currentPage >= totalPages}
                        onClick={() =>
                          setCurrentPage((p) => Math.min(totalPages, p + 1))
                        }
                      >
                        Siguiente
                      </Button>
                    </div>
                  </div>
                </Card>
              </>
            )}
          </>
        )}
      </div>

      {/* DIALOGS */}
      <CrearPedidoDialog
        open={dialogCrear}
        onOpenChange={setDialogCrear}
        onSuccess={fetchPedidos}
      />
      <ConfirmarPedidoDialog
        pedido={selectedPedido}
        open={dialogConfirmar}
        onOpenChange={setDialogConfirmar}
        onSuccess={() => {
          fetchPedidos();
          setSelectedPedido(null);
        }}
      />
      <PostergarPedidoDialog
        pedido={selectedPedido}
        open={dialogPostergar}
        onOpenChange={setDialogPostergar}
        onSuccess={() => {
          fetchPedidos();
          setSelectedPedido(null);
        }}
      />

      <PedidoDetalleDialog
        pedido={detallePedido}
        open={!!detallePedido}
        onOpenChange={(open) => !open && setDetallePedido(null)}
      />

      {/* DIALOG CANCELAR */}
      <AlertDialog open={dialogCancelar} onOpenChange={setDialogCancelar}>
        <AlertDialogContent className="rounded-2xl border-none shadow-2xl">
          <AlertDialogHeader>
            <div className="mx-auto bg-[color:var(--status-danger)] dark:bg-[color:var(--status-danger)]/30 p-3 rounded-full w-fit mb-2">
              <AlertCircle className="h-8 w-8 text-[color:var(--status-danger)]" />
            </div>
            <AlertDialogTitle className="text-xl font-bold text-center">
              ¿Cancelar pedido?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-center text-muted-foreground">
              Esta acción no se puede deshacer. El pedido quedará marcado como
              cancelado y no podrá confirmarse.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="grid grid-cols-2 gap-3 sm:flex sm:justify-center pt-2">
            <AlertDialogCancel
              className="h-11 rounded-xl mt-0"
              onClick={() => setDialogCancelar(false)}
            >
              Volver
            </AlertDialogCancel>
            <AlertDialogAction
              className="h-11 rounded-xl bg-[color:var(--status-danger)] hover:bg-[color:var(--status-danger)] text-[color:var(--ui-fx-white)] font-bold"
              onClick={(e) => {
                e.preventDefault();
                confirmCancelar();
              }}
              disabled={cancelandoId !== null}
            >
              {cancelandoId !== null ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Sí, cancelar"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={dialogEliminar} onOpenChange={setDialogEliminar}>
        <AlertDialogContent className="rounded-2xl border-none shadow-2xl">
          <AlertDialogHeader>
            <div className="mx-auto bg-[color:var(--status-danger)] dark:bg-[color:var(--status-danger)]/30 p-3 rounded-full w-fit mb-2">
              <Trash2 className="h-8 w-8 text-[color:var(--status-danger)]" />
            </div>
            <AlertDialogTitle className="text-xl font-bold text-center">
              ¿Eliminar pedido cancelado?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-center text-muted-foreground">
              Se eliminará de forma permanente y no se podrá recuperar.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="grid grid-cols-2 gap-3 sm:flex sm:justify-center pt-2">
            <AlertDialogCancel
              className="h-11 rounded-xl mt-0"
              onClick={() => setDialogEliminar(false)}
            >
              Volver
            </AlertDialogCancel>
            <AlertDialogAction
              className="h-11 rounded-xl bg-[color:var(--status-danger)] hover:bg-[color:var(--status-danger)] text-[color:var(--ui-fx-white)] font-bold"
              onClick={(e) => {
                e.preventDefault();
                confirmEliminar();
              }}
              disabled={eliminandoId !== null}
            >
              {eliminandoId !== null ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Sí, eliminar"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ─── SUB-COMPONENTS ───────────────────────────────────────────────────────────

const ITEM_ESTADO_CONFIG: Record<
  string,
  { label: string; icon: React.ElementType; className: string; dot: string }
> = {
  PENDIENTE: {
    label: "Pendiente",
    icon: Clock,
    className:
      "bg-[color:var(--theme-ocean-primary)]/10 text-[color:var(--theme-ocean-primary)] border-[color:var(--theme-ocean-primary)]/20",
    dot: "bg-[color:var(--theme-ocean-primary)]",
  },
  CONFIRMADO: {
    label: "Confirmado",
    icon: CheckCircle2,
    className:
      "bg-[color:var(--status-success-strong)]/10 text-[color:var(--status-success-strong)] border-[color:var(--status-success-strong)]/20",
    dot: "bg-[color:var(--status-success-strong)]",
  },
  PARCIAL: {
    label: "Parcial",
    icon: ArrowDownToLine,
    className:
      "bg-yellow-500/10 text-yellow-700 border-yellow-500/20 dark:text-yellow-400",
    dot: "bg-yellow-500",
  },
  CANCELADO: {
    label: "Cancelado",
    icon: MinusCircle,
    className:
      "bg-muted/40 text-muted-foreground border-border/40 line-through",
    dot: "bg-muted-foreground/50",
  },
};

function PedidoDetalleDialog({
  pedido,
  open,
  onOpenChange,
}: {
  pedido: PedidoEsperado | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [visorImagen, setVisorImagen] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!open) setVisorImagen(null);
  }, [open]);

  if (!pedido) return null;

  const totalEsperado = pedido.items.reduce(
    (a, i) => a + i.cantidadEsperada,
    0,
  );
  const totalRecibido = pedido.items.reduce(
    (a, i) => a + i.cantidadRecibida,
    0,
  );
  const pctRecibido =
    totalEsperado > 0 ? Math.round((totalRecibido / totalEsperado) * 100) : 0;

  return (
    <>
      {/* Lightbox */}
      {visorImagen && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-sm"
          onClick={() => setVisorImagen(null)}
        >
          <button
            type="button"
            onClick={() => setVisorImagen(null)}
            className="absolute top-4 right-4 text-white/70 hover:text-white bg-white/10 hover:bg-white/20 rounded-full p-2 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={visorImagen}
            alt="Imagen ampliada"
            className="max-h-[85vh] max-w-[85vw] object-contain rounded-xl shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}

      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[680px] p-0 overflow-hidden border-none shadow-2xl bg-background rounded-2xl">
          {/* HEADER */}
          <DialogHeader className="p-6 pb-4 border-b bg-gradient-to-r from-primary/5 via-primary/3 to-transparent">
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1.5">
                <div className="flex items-center gap-2.5">
                  <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                    <ClipboardList className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <DialogTitle className="text-xl font-black tracking-tight">
                      Pedido #{pedido.id}
                    </DialogTitle>
                    <DialogDescription className="text-xs mt-0.5 text-muted-foreground">
                      {formatFecha(pedido.fechaEsperada)} ·{" "}
                      {pedido.items.length} producto
                      {pedido.items.length !== 1 ? "s" : ""}
                    </DialogDescription>
                  </div>
                </div>
              </div>
              <PedidoEstadoBadge estado={pedido.estado} />
            </div>

            {/* Barra de progreso */}
            {pedido.estado !== "CANCELADO" && (
              <div className="mt-4 space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-muted-foreground uppercase tracking-wider">
                    Recepción de stock
                  </span>
                  <span className="font-black text-foreground tabular-nums">
                    {totalRecibido} / {totalEsperado} unidades ({pctRecibido}%)
                  </span>
                </div>
                <div className="h-2 rounded-full bg-muted/50 overflow-hidden">
                  <div
                    className={cn(
                      "h-full rounded-full transition-all",
                      pctRecibido === 100
                        ? "bg-[color:var(--status-success-strong)]"
                        : pctRecibido > 0
                          ? "bg-yellow-500"
                          : "bg-[color:var(--theme-ocean-primary)]",
                    )}
                    style={{ width: `${pctRecibido}%` }}
                  />
                </div>
              </div>
            )}
          </DialogHeader>

          {/* CUERPO */}
          <div className="p-5 space-y-3 max-h-[55vh] overflow-y-auto">
            {pedido.items.map((item) => {
              const estadoCfg =
                ITEM_ESTADO_CONFIG[item.estado] ?? ITEM_ESTADO_CONFIG.PENDIENTE;
              const IconEstado = estadoCfg.icon;
              const imgUrl =
                (item.producto as { imagenUrl?: string | null }).imagenUrl ??
                null;

              return (
                <div
                  key={item.id}
                  className={cn(
                    "flex items-center gap-3 p-3 rounded-xl border transition-colors",
                    item.estado === "CANCELADO"
                      ? "bg-muted/10 border-border/30 opacity-60"
                      : item.estado === "CONFIRMADO"
                        ? "bg-[color:var(--status-success-strong)]/5 border-[color:var(--status-success-strong)]/15"
                        : item.estado === "PARCIAL"
                          ? "bg-yellow-500/5 border-yellow-500/15"
                          : "bg-background border-border/40 hover:border-border/70",
                  )}
                >
                  {/* Imagen del producto */}
                  <button
                    type="button"
                    onClick={() => {
                      if (imgUrl) setVisorImagen(imgUrl);
                    }}
                    className={cn(
                      "h-14 w-14 rounded-xl shrink-0 overflow-hidden border border-border/30 bg-muted/50 flex items-center justify-center",
                      imgUrl
                        ? "cursor-zoom-in group relative hover:ring-2 hover:ring-primary/40 transition-all"
                        : "cursor-default",
                    )}
                  >
                    {imgUrl ? (
                      <div className="relative h-14 w-14">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={imgUrl}
                          alt={item.producto.nombre}
                          className="h-14 w-14 object-cover"
                        />
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/35 transition-colors flex items-center justify-center">
                          <ZoomIn className="h-4 w-4 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                      </div>
                    ) : (
                      <Package className="h-5 w-5 text-muted-foreground/50" />
                    )}
                  </button>

                  {/* Info del producto */}
                  <div className="flex-1 min-w-0 space-y-0.5">
                    <p className="font-bold text-sm text-foreground leading-tight">
                      {item.producto.nombre}
                    </p>
                    {item.producto.sku && (
                      <div className="flex items-center gap-1 text-[10px] text-muted-foreground font-mono">
                        <Hash className="h-2.5 w-2.5" />
                        {item.producto.sku}
                      </div>
                    )}
                    {/* Estado badge */}
                    <div className="pt-0.5">
                      <Badge
                        variant="outline"
                        className={cn(
                          "text-[10px] px-1.5 py-0 h-5 font-bold border gap-1 uppercase",
                          estadoCfg.className,
                        )}
                      >
                        <span
                          className={cn(
                            "h-1.5 w-1.5 rounded-full shrink-0",
                            estadoCfg.dot,
                          )}
                        />
                        <IconEstado className="h-2.5 w-2.5" />
                        {estadoCfg.label}
                      </Badge>
                    </div>
                  </div>

                  {/* Cantidades */}
                  <div className="flex items-center gap-2 shrink-0">
                    <div className="text-center min-w-[44px]">
                      <p className="text-[10px] font-bold uppercase text-muted-foreground tracking-wider">
                        Esp.
                      </p>
                      <p className="text-lg font-black tabular-nums text-foreground">
                        {item.cantidadEsperada}
                      </p>
                    </div>
                    <div
                      className={cn(
                        "h-8 w-px rounded-full",
                        item.cantidadRecibida === item.cantidadEsperada
                          ? "bg-[color:var(--status-success-strong)]/40"
                          : item.cantidadRecibida > 0
                            ? "bg-yellow-500/40"
                            : "bg-border/60",
                      )}
                    />
                    <div className="text-center min-w-[44px]">
                      <p className="text-[10px] font-bold uppercase text-muted-foreground tracking-wider">
                        Recib.
                      </p>
                      <p
                        className={cn(
                          "text-lg font-black tabular-nums",
                          item.cantidadRecibida === item.cantidadEsperada
                            ? "text-[color:var(--status-success-strong)]"
                            : item.cantidadRecibida > 0
                              ? "text-yellow-600 dark:text-yellow-400"
                              : "text-muted-foreground",
                        )}
                      >
                        {item.cantidadRecibida}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}

            {/* Observaciones */}
            {pedido.observaciones && (
              <div className="rounded-xl border border-border/50 p-3.5 bg-muted/20 mt-2">
                <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider mb-1.5">
                  Observaciones
                </p>
                <p className="text-sm text-foreground/80 italic">
                  {pedido.observaciones}
                </p>
              </div>
            )}
          </div>

          {/* FOOTER con totales */}
          <div className="px-5 py-4 border-t bg-muted/10 flex items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="text-center">
                <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">
                  Esperado
                </p>
                <p className="text-xl font-black tabular-nums text-foreground">
                  {totalEsperado}
                </p>
              </div>
              <div className="h-8 w-px bg-border/60 rounded-full" />
              <div className="text-center">
                <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">
                  Recibido
                </p>
                <p
                  className={cn(
                    "text-xl font-black tabular-nums",
                    totalRecibido === totalEsperado
                      ? "text-[color:var(--status-success-strong)]"
                      : totalRecibido > 0
                        ? "text-yellow-600 dark:text-yellow-400"
                        : "text-muted-foreground",
                  )}
                >
                  {totalRecibido}
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              className="rounded-xl h-9"
              onClick={() => onOpenChange(false)}
            >
              Cerrar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function PedidoRow({
  pedido,
  idx,
  onVer,
  onConfirmar,
  onPostergar,
  onCancelar,
  onEliminar,
}: {
  pedido: PedidoEsperado;
  idx: number;
  onVer: () => void;
  onConfirmar: () => void;
  onPostergar: () => void;
  onCancelar: () => void;
  onEliminar: () => void;
}) {
  const isVencido = pedido.estado === "VENCIDO";
  const soloVer = ESTADOS_SOLO_VER.includes(pedido.estado);
  const canDelete = pedido.estado === "CANCELADO";
  const productosNombres = pedido.items
    .map((it) => it.producto.nombre)
    .join(", ");

  return (
    <motion.tr
      initial={{ opacity: 0, y: 5 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: idx * 0.03 }}
      className={cn(
        "group border-b border-border/40 hover:bg-muted/30 transition-colors",
        isVencido && "bg-[color:var(--status-danger)]/5",
      )}
    >
      <TableCell className="pl-6 py-4">
        <div className="space-y-0.5">
          <p className="font-bold text-sm text-foreground tabular-nums">
            {formatFecha(pedido.fechaEsperada)}
          </p>
          <p
            className={cn(
              "text-[10px] font-bold",
              isVencido
                ? "text-[color:var(--status-danger)]"
                : "text-muted-foreground",
            )}
          >
            {formatFechaRelativa(pedido.fechaEsperada)}
          </p>
        </div>
      </TableCell>

      <TableCell>
        <PedidoEstadoBadge estado={pedido.estado} />
      </TableCell>

      <TableCell className="text-center">
        <span className="font-bold text-foreground tabular-nums">
          {pedido.items.length}
        </span>
      </TableCell>

      <TableCell className="max-w-[200px]">
        <p
          className="text-sm text-muted-foreground truncate"
          title={productosNombres}
        >
          {productosNombres || "—"}
        </p>
      </TableCell>

      <TableCell className="max-w-[160px]">
        {pedido.observaciones ? (
          <p
            className="text-xs text-muted-foreground truncate italic"
            title={pedido.observaciones}
          >
            {pedido.observaciones}
          </p>
        ) : (
          <span className="text-xs text-muted-foreground/40 italic">
            Sin observaciones
          </span>
        )}
      </TableCell>

      <TableCell className="text-right pr-4">
        <div className="flex items-center justify-end gap-1 opacity-80 group-hover:opacity-100">
          <Button
            variant="ghost"
            size="sm"
            className="h-8 px-3 rounded-lg text-xs font-bold text-muted-foreground hover:bg-muted"
            onClick={onVer}
          >
            <Eye className="h-3.5 w-3.5 mr-1" />
            Ver
          </Button>
          {!soloVer && (
            <>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 px-3 rounded-lg text-xs font-bold text-[color:var(--status-success-strong)] hover:bg-[color:var(--status-success-strong)]/10"
                onClick={onConfirmar}
              >
                <PackageCheck className="h-3.5 w-3.5 mr-1" />
                {pedido.estado === "PARCIAL" ? "Completar" : "Confirmar"}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 px-3 rounded-lg text-xs font-bold text-[color:var(--theme-ocean-primary)] hover:bg-[color:var(--theme-ocean-primary)]/10"
                onClick={onPostergar}
              >
                <CalendarClock className="h-3.5 w-3.5 mr-1" />
                Postergar
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 px-3 rounded-lg text-xs font-bold text-[color:var(--status-danger)] hover:bg-[color:var(--status-danger)]/10"
                onClick={onCancelar}
              >
                <XCircle className="h-3.5 w-3.5 mr-1" />
                Cancelar
              </Button>
            </>
          )}
          {canDelete && (
            <Button
              variant="ghost"
              size="sm"
              className="h-8 px-3 rounded-lg text-xs font-bold text-[color:var(--status-danger)] hover:bg-[color:var(--status-danger)]/10"
              onClick={onEliminar}
            >
              <Trash2 className="h-3.5 w-3.5 mr-1" />
              Eliminar
            </Button>
          )}
        </div>
      </TableCell>
    </motion.tr>
  );
}

function MobilePedidoCard({
  pedido,
  idx,
  onVer,
  onConfirmar,
  onPostergar,
  onCancelar,
  onEliminar,
}: {
  pedido: PedidoEsperado;
  idx: number;
  onVer: () => void;
  onConfirmar: () => void;
  onPostergar: () => void;
  onCancelar: () => void;
  onEliminar: () => void;
}) {
  const isVencido = pedido.estado === "VENCIDO";
  const soloVer = ESTADOS_SOLO_VER.includes(pedido.estado);
  const canDelete = pedido.estado === "CANCELADO";
  const productosNombres = pedido.items
    .map((it) => it.producto.nombre)
    .join(", ");

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: idx * 0.05 }}
    >
      <Card
        className={cn(
          "p-4 border-border/50 shadow-sm rounded-2xl relative overflow-hidden space-y-3",
          isVencido &&
            "border-[color:var(--status-danger)]/30 bg-[color:var(--status-danger)]/5",
        )}
      >
        <div
          className={cn(
            "absolute left-0 top-0 bottom-0 w-1.5",
            pedido.estado === "VENCIDO"
              ? "bg-[color:var(--status-danger)]"
              : pedido.estado === "PROGRAMADO"
                ? "bg-[color:var(--theme-ocean-primary)]"
                : pedido.estado === "PARCIAL"
                  ? "bg-yellow-500"
                  : pedido.estado === "CONFIRMADO"
                    ? "bg-[color:var(--status-success-strong)]"
                    : "bg-muted-foreground",
          )}
        />

        <div className="flex items-start justify-between pl-3 gap-3">
          <div className="space-y-1 flex-1">
            <div className="flex items-center gap-2">
              <PedidoEstadoBadge estado={pedido.estado} size="sm" />
              <span
                className={cn(
                  "text-[10px] font-bold",
                  isVencido
                    ? "text-[color:var(--status-danger)]"
                    : "text-muted-foreground",
                )}
              >
                {formatFechaRelativa(pedido.fechaEsperada)}
              </span>
            </div>
            <p className="font-bold text-foreground text-sm">
              {formatFecha(pedido.fechaEsperada)}
            </p>
            <p className="text-xs text-muted-foreground truncate">
              {productosNombres}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs font-bold tabular-nums">
              {pedido.items.length}{" "}
              {pedido.items.length === 1 ? "item" : "items"}
            </Badge>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-9 w-9 rounded-xl border-border/60"
                >
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                className="w-48 rounded-xl border-border/60 shadow-xl"
              >
                <DropdownMenuItem
                  className="flex items-center gap-2.5 font-semibold cursor-pointer rounded-lg"
                  onClick={onVer}
                >
                  <Eye className="h-4 w-4" />
                  Ver detalle
                </DropdownMenuItem>
                {!soloVer && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      className="flex items-center gap-2.5 font-semibold text-[color:var(--status-success-strong)] cursor-pointer rounded-lg focus:text-[color:var(--status-success-strong)] focus:bg-[color:var(--status-success-strong)] dark:focus:bg-[color:var(--status-success-strong)]/40"
                      onClick={onConfirmar}
                    >
                      <PackageCheck className="h-4 w-4" />
                      {pedido.estado === "PARCIAL" ? "Completar" : "Confirmar"}
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="flex items-center gap-2.5 font-semibold text-[color:var(--theme-ocean-primary)] cursor-pointer rounded-lg focus:text-[color:var(--theme-ocean-primary)] focus:bg-[color:var(--theme-ocean-primary)] dark:focus:bg-[color:var(--theme-ocean-primary)]/40"
                      onClick={onPostergar}
                    >
                      <CalendarClock className="h-4 w-4" />
                      Postergar
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      className="flex items-center gap-2.5 font-semibold text-[color:var(--status-danger)] cursor-pointer rounded-lg focus:text-[color:var(--status-danger)] focus:bg-[color:var(--status-danger)] dark:focus:bg-[color:var(--status-danger)]/40"
                      onClick={onCancelar}
                    >
                      <XCircle className="h-4 w-4" />
                      Cancelar
                    </DropdownMenuItem>
                  </>
                )}
                {canDelete && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      className="flex items-center gap-2.5 font-semibold text-[color:var(--status-danger)] cursor-pointer rounded-lg focus:text-[color:var(--status-danger)] focus:bg-[color:var(--status-danger)] dark:focus:bg-[color:var(--status-danger)]/40"
                      onClick={onEliminar}
                    >
                      <Trash2 className="h-4 w-4" />
                      Eliminar
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {pedido.observaciones && (
          <p className="pl-3 text-xs text-muted-foreground italic truncate">
            {pedido.observaciones}
          </p>
        )}
      </Card>
    </motion.div>
  );
}

function QuickStat({
  label,
  value,
  color,
  icon: Icon,
}: {
  label: string;
  value: number;
  color: "default" | "blue" | "emerald" | "red";
  icon: React.ElementType;
}) {
  const colors = {
    default: "bg-primary/5 text-primary",
    blue: "bg-[color:var(--theme-ocean-primary)]/10 text-[color:var(--theme-ocean-primary)]",
    emerald:
      "bg-[color:var(--status-success-strong)]/10 text-[color:var(--status-success-strong)]",
    red: "bg-[color:var(--status-danger)]/10 text-[color:var(--status-danger)]",
  };

  return (
    <Card className="p-4 border-border/50 shadow-sm bg-card/50 backdrop-blur-sm hover:bg-card/80 transition-all">
      <div className="flex items-center gap-3">
        <div className={cn("p-2.5 rounded-xl", colors[color])}>
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground/80">
            {label}
          </p>
          <h3 className="text-2xl font-black tracking-tight text-foreground tabular-nums">
            {value}
          </h3>
        </div>
      </div>
    </Card>
  );
}

function EmptyState({ onCrear }: { onCrear: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 text-muted-foreground py-10">
      <div className="p-4 rounded-2xl bg-muted/30">
        <PackageSearch className="h-12 w-12 opacity-40" />
      </div>
      <div className="space-y-1 text-center">
        <p className="text-lg font-bold text-foreground">
          No hay pedidos programados
        </p>
        <p className="text-sm text-muted-foreground">
          Creá un pedido para empezar a hacer seguimiento del stock entrante.
        </p>
      </div>
      <Button
        onClick={onCrear}
        className="mt-2 rounded-xl font-bold shadow-lg shadow-primary/20"
      >
        <Plus className="h-4 w-4 mr-2" />
        Crear primer pedido
      </Button>
    </div>
  );
}
